import { supabase } from './supabase'

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

    if (error) throw error
    return { data, error: null }
  } catch (error: any) {
    console.error('Sign in error:', error)
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return null
    }

    // Industry standard: First check for existing session
    // Supabase automatically loads session from localStorage if persistSession is true
    // This is fast and synchronous for localStorage, so no timeout needed
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
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
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
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
        console.warn('⚠️ Profile fetch error (user may not have profile yet):', profileError?.message)
      }
    } catch (profileErr) {
      // Profile fetch failed - continue without it
      console.warn('⚠️ Profile fetch error:', profileErr)
    }

    return {
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.user_metadata?.full_name,
      avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
    }
  } catch (error: any) {
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
    console.log('🔄 Auth state change event:', event)
    
    // Handle different auth events
    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
        // User is authenticated - get fresh user data
        if (session?.user) {
          const user = await getCurrentUser()
          callback(user)
        } else {
          callback(null)
        }
        break
      
      case 'SIGNED_OUT':
        // User explicitly logged out
        callback(null)
        break
      
      default:
        // For other events, check session status
        if (session?.user) {
          const user = await getCurrentUser()
          callback(user)
        } else {
          callback(null)
        }
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