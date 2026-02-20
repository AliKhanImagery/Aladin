import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Returns true if the error is from an aborted lock (e.g. navigation, timeout). */
function isAbortError(e: any): boolean {
  return e?.name === 'AbortError' || (typeof e?.message === 'string' && e.message.includes('aborted'))
}

/**
 * Call getSession() but catch AbortError (from Supabase's internal navigator.locks)
 * so we never surface "signal is aborted without reason" as an unhandled runtime error.
 */
export async function getSessionSafe(): Promise<{ data: { session: Session | null }; error: any }> {
  try {
    const result = await supabase.auth.getSession()
    return { data: { session: result.data?.session ?? null }, error: result.error }
  } catch (e: any) {
    if (isAbortError(e)) {
      console.warn('⚠️ getSession aborted (lock timeout or navigation)')
      return { data: { session: null }, error: null }
    }
    throw e
  }
}

export interface AuthUser {
  id: string
  email?: string
  name?: string
  avatar?: string
}

export async function signUp(email: string, password: string, fullName?: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0],
        },
      },
    })

    if (error) throw error

    // Note: User profile is automatically created by the database trigger
    // (handle_new_user function in supabase/migrations/001_initial_schema.sql)
    // The trigger runs server-side, so it works even if RLS blocks client-side checks
    // No need to manually check or insert - the trigger handles it reliably
    if (data.user) {
      // Give the trigger a moment to execute (usually instant, but wait a bit to be safe)
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('✅ User signed up successfully. Profile created by database trigger.')
    }

    return { data, error: null }
  } catch (error: any) {
    console.error('Sign up error:', error)
    return { data: null, error }
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Check for schema/database errors
      const errorMessage = error.message || ''
      const errorCode = (error as any).code || ''
      
      if (errorMessage.toLowerCase().includes('schema') || 
          errorMessage.toLowerCase().includes('querying') ||
          errorCode === '42P01') {
        console.error('❌ Database schema error during sign in:', {
          message: error.message,
          code: errorCode,
          hint: 'Database migrations may not have been run. Check Supabase setup.'
        })
        // Return a more user-friendly error
        return { 
          data: null, 
          error: {
            ...error,
            message: 'Database configuration error. Please ensure database migrations have been run.'
          }
        }
      }
      
      throw error
    }
    
    return { data, error: null }
  } catch (error: any) {
    console.error('Sign in error:', error)
    
    // Additional check for schema errors in catch block
    const errorMessage = error?.message || String(error)
    if (errorMessage.toLowerCase().includes('schema') || 
        errorMessage.toLowerCase().includes('querying')) {
      return {
        data: null,
        error: {
          message: 'Database configuration error. Please ensure database migrations have been run.',
          code: error?.code
        }
      }
    }
    
    return { data: null, error }
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error: any) {
    console.error('Sign out error:', error)
    return { error }
  }
}

// Track pending auth calls to prevent race conditions
let pendingAuthCall: Promise<AuthUser | null> | null = null

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return null
    }

    // If there's already a pending auth call, wait for it instead of creating a new one
    // This prevents race conditions with Supabase's internal locks
    if (pendingAuthCall) {
      console.log('🔄 Waiting for pending auth call...')
      return await pendingAuthCall
    }

    // Create a new auth call and store it
    pendingAuthCall = (async () => {
      try {
        // Industry standard: First check for existing session
        // Use getSessionSafe to avoid unhandled AbortError from Supabase's internal locks
        let session, sessionError
        const sessionResult = await getSessionSafe()
        session = sessionResult.data?.session
        sessionError = sessionResult.error
        if (!session && !sessionError) {
          // Possible lock timeout - retry once
          await new Promise(resolve => setTimeout(resolve, 100))
          const retryResult = await getSessionSafe()
          session = retryResult.data?.session
          sessionError = retryResult.error
        }
        
        if (sessionError) {
          console.warn('⚠️ Session check error (may be expired):', sessionError.message)
          return null
        }
        
        // If no session, user is definitely not logged in
        if (!session?.user) {
          return null
        }

        // Verify the session is still valid by getting fresh user data
        // This also triggers automatic token refresh if needed (autoRefreshToken: true)
        let user, userError
        try {
          const userResult = await supabase.auth.getUser()
          user = userResult.data?.user
          userError = userResult.error
        } catch (getUserError: any) {
          if (isAbortError(getUserError)) {
            console.warn('⚠️ getUser aborted - using session user')
            user = session.user
            userError = null
          } else {
            throw getUserError
          }
        }
        
        if (userError) {
          // Token might be expired or invalid
          console.warn('⚠️ User verification error (token may be expired):', userError.message)
          
          // If it's a token refresh error, clear the invalid session
          if (userError.message.includes('refresh') || userError.message.includes('expired')) {
            console.log('🔄 Clearing expired session...')
            await supabase.auth.signOut().catch(() => {}) // Ignore signOut errors
            return null
          }
          return null
        }
    
        if (!user) {
          return null
        }

        // Get user profile from users table
        // Don't block on this - if it fails, we still have user data from auth
        let profile = null
        try {
          const { data, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (!profileError && data) {
            profile = data
          } else {
            // Handle specific error types
            if (profileError) {
              const errorCode = profileError.code
              const errorMessage = profileError.message || ''
              
              // Check for schema/table errors
              if (errorCode === '42P01' || errorMessage.includes('does not exist') || errorMessage.includes('schema')) {
                console.error('❌ Database schema error: Users table may not exist. Please run migrations:', {
                  code: errorCode,
                  message: errorMessage,
                  hint: 'Run supabase/migrations/001_initial_schema.sql in your Supabase SQL Editor'
                })
                // Don't throw - continue without profile, user can still use the app
              } else if (errorCode === 'PGRST116') {
                // No rows returned - user profile doesn't exist yet (normal for new users)
                console.log('ℹ️ User profile not found (user may be new) - will be created automatically')
              } else {
                console.warn('⚠️ Profile fetch error (user may not have profile yet):', {
                  code: errorCode,
                  message: errorMessage,
                  hint: profileError.hint
                })
              }
            }
          }
        } catch (profileErr: any) {
          // Profile fetch failed - continue without it
          const errorMessage = profileErr?.message || String(profileErr)
          
          // Check if it's a schema-related error
          if (errorMessage.includes('schema') || errorMessage.includes('querying') || errorMessage.includes('does not exist')) {
            console.error('❌ Database schema error when fetching profile:', {
              message: errorMessage,
              hint: 'This may indicate the database migrations have not been run. Check Supabase setup.'
            })
            // Don't throw - continue without profile
          } else {
            console.warn('⚠️ Profile fetch error:', errorMessage)
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: profile?.full_name || user.user_metadata?.full_name,
          avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
        }
      } catch (innerError: any) {
        // Handle AbortError specifically
        if (innerError?.name === 'AbortError' || innerError?.message?.includes('aborted')) {
          console.warn('⚠️ Auth call aborted (likely race condition) - returning null')
          return null
        }
        throw innerError
      } finally {
        // Clear the pending call after completion
        pendingAuthCall = null
      }
    })()

    // Return the result of the pending call
    return await pendingAuthCall
  } catch (error: any) {
    // Clear pending call on error
    pendingAuthCall = null
    
    // Handle AbortError specifically without logging it as an error
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      console.warn('⚠️ Get current user aborted (likely race condition)')
      return null
    }
    
    console.error('❌ Get current user error:', error)
    return null
  }
}

export async function resetPasswordForEmail(email: string) {
  try {
    // Get the origin from environment or use current window location
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/reset-password`
      : process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
        : 'http://localhost:3000/auth/reset-password'

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (error) throw error
    return { error: null }
  } catch (error: any) {
    console.error('Reset password error:', error)
    return { error }
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error
    return { error: null }
  } catch (error: any) {
    console.error('Update password error:', error)
    return { error }
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    // Industry standard: Handle all auth events for comprehensive state management
    console.log('🔄 Auth state change event:', event, session?.user ? `User: ${session.user.email}` : 'No session')
    
    // Helper function to create user from session (used in multiple places)
    const createUserFromSession = (sessionUser: any, profile?: any): AuthUser => ({
      id: sessionUser.id,
      email: sessionUser.email || '',
      name: profile?.full_name || sessionUser.user_metadata?.full_name,
      avatar: profile?.avatar_url || sessionUser.user_metadata?.avatar_url,
    })
    
    // For SIGNED_IN events, ALWAYS try to use session user - NEVER return null
    // This is critical - if we call callback(null) for SIGNED_IN, the user will appear logged out
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      console.log('🔐 Processing SIGNED_IN event...', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id?.substring(0, 8),
        userEmail: session?.user?.email,
      })
      
      // Always try to get session if not provided
      let finalSession = session
      if (!finalSession?.user) {
        console.warn('⚠️ SIGNED_IN event but no session user in event - fetching session...')
        const { data: { session: fetchedSession }, error: fetchError } = await getSessionSafe()
        if (fetchError) {
          console.error('❌ Failed to fetch session:', fetchError.message)
        }
        if (fetchedSession?.user) {
          console.log('✅ Found session on fetch:', fetchedSession.user.email)
          finalSession = fetchedSession
        }
      }
      
      if (finalSession?.user) {
        console.log('✅ SIGNED_IN event - using session user directly (not calling getCurrentUser)')
        
        try {
          // Get profile from database if available (non-blocking, with timeout)
          let profile = null
          try {
            // Add timeout to profile fetch to prevent hanging
            const profilePromise = supabase
              .from('users')
              .select('*')
              .eq('id', finalSession.user.id)
              .single()
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Profile fetch timeout')), 1500)
            )
            
            const { data } = await Promise.race([profilePromise, timeoutPromise]) as any
            profile = data
            if (profile) {
              console.log('✅ Profile fetched from database')
            }
          } catch (profileErr: any) {
            // Profile fetch failed or timed out - continue with auth user only
            if (!profileErr?.message?.includes('timeout')) {
              console.warn('⚠️ Profile fetch failed (non-critical):', profileErr.message)
            }
            // Continue - profile is null, will use session user metadata
          }
          
          const authUser = createUserFromSession(finalSession.user, profile)
          console.log('✅ SIGNED_IN: Calling callback with user:', {
            id: authUser.id.substring(0, 8),
            email: authUser.email,
            name: authUser.name || 'no name',
          })
          callback(authUser)
          return // Exit early - don't process further
        } catch (error: any) {
          // Even if anything fails, still use session user
          console.error('❌ Exception in SIGNED_IN handler:', error.message)
          console.warn('⚠️ Using session user as fallback despite error')
          const authUser = createUserFromSession(finalSession.user)
          console.log('✅ SIGNED_IN: Calling callback with session user (fallback):', {
            id: authUser.id.substring(0, 8),
            email: authUser.email,
          })
          callback(authUser)
          return // Exit early
        }
      } else {
        // SIGNED_IN event but still no session after retry - this is very unusual
        console.error('❌ SIGNED_IN event but cannot get session user - this should not happen!')
        console.error('❌ Session state:', {
          hasSession: !!session,
          sessionKeys: session ? Object.keys(session) : [],
          eventType: event,
        })
        // CRITICAL: Do NOT call callback(null) for SIGNED_IN - this causes logout
        // Instead, wait a bit and try one more time
        console.warn('⚠️ Waiting 500ms and retrying session fetch...')
        await new Promise(resolve => setTimeout(resolve, 500))
        const { data: { session: finalRetrySession } } = await getSessionSafe()
        if (finalRetrySession?.user) {
          const authUser = createUserFromSession(finalRetrySession.user)
          console.log('✅ SIGNED_IN: Found session on final retry, calling callback with user:', authUser.email)
          callback(authUser)
          return
        }
        // Last resort - still don't call callback(null) - this would cause logout
        console.error('❌ SIGNED_IN event but no session available after all retries - skipping callback to prevent logout')
        return // Exit without calling callback - better than calling callback(null)
      }
    }
    
    try {
      // Handle other auth events
      switch (event) {
        
        case 'SIGNED_OUT':
          // User explicitly logged out
          console.log('ℹ️ SIGNED_OUT event - calling callback with null')
          callback(null)
          break
        
        default:
          // For other events, check session status
          if (session?.user) {
            console.log('✅ Other auth event - using session user directly')
            callback({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name,
              avatar: session.user.user_metadata?.avatar_url,
            })
          } else {
            console.log('ℹ️ Other auth event but no session - calling callback with null')
            callback(null)
          }
      }
    } catch (error: any) {
      // Handle any errors gracefully
      console.error('❌ Auth state change handler error (catch block):', error)
        callback(null)
    }
  })
}

export async function updateUserProfile(name: string, avatarUrl?: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return { success: false, error: { message: 'Not authenticated', code: 'UNAUTHENTICATED' } }
    }

    // Update user profile in users table
    const updates: { full_name?: string; avatar_url?: string | null } = {}
    if (name && name.trim()) {
      updates.full_name = name.trim()
    }
    if (avatarUrl !== undefined) {
      updates.avatar_url = avatarUrl || null
    }

    // Check if there are any updates to make
    if (Object.keys(updates).length === 0) {
      return { success: true } // No updates needed
    }

    console.log('Updating user profile:', { userId: user.id, updates })

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()

    if (error) {
      console.error('Update profile error:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return { success: false, error }
    }

    console.log('Profile updated successfully:', data)
    return { success: true }
  } catch (error: any) {
    console.error('Update profile error:', error)
    return { success: false, error: { message: error.message || 'Unknown error' } }
  }
}