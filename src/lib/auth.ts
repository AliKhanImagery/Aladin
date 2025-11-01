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

    // Create user profile in users table
    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName || email.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (profileError && profileError.code !== '23505') {
        // Ignore duplicate key errors (user already exists)
        console.error('Error creating user profile:', profileError)
      }
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
