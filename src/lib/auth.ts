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
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) return null

    // Get user profile from users table
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    return {
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.user_metadata?.full_name,
      avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
    }
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const user = await getCurrentUser()
      callback(user)
    } else {
      callback(null)
    }
  })
}
