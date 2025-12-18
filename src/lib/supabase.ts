import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Validate environment variables
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase environment variables are missing!')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ MISSING')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ MISSING')
  } else {
    console.log('✅ Supabase client initialized')
    console.log('📍 Supabase URL:', supabaseUrl.substring(0, 30) + '...')
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
    flowType: 'pkce'
  }
})

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string
          created_at: string
          updated_at: string
          created_by: string
          settings: any
          story: any
          scenes: any[]
          characters: any[]
          metadata: any
          permissions: any
          budget: any
        }
        Insert: {
          id?: string
          name: string
          description: string
          created_at?: string
          updated_at?: string
          created_by: string
          settings?: any
          story?: any
          scenes?: any[]
          characters?: any[]
          metadata?: any
          permissions?: any
          budget?: any
        }
        Update: {
          id?: string
          name?: string
          description?: string
          created_at?: string
          updated_at?: string
          created_by?: string
          settings?: any
          story?: any
          scenes?: any[]
          characters?: any[]
          metadata?: any
          permissions?: any
          budget?: any
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
