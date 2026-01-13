'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getCurrentUser, onAuthStateChange } from '@/lib/auth'
import AuthModal from './AuthModal'
import ProfileSettingsModal from './ProfileSettingsModal'
import { Toaster } from 'react-hot-toast'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthenticated, user, showAuthModal, setShowAuthModal, pendingIdea } = useAppStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(false) // Start as false - don't block UI
  const [authInitialized, setAuthInitialized] = useState(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null

    // Industry standard: Check for existing session immediately on mount
    // This provides persistent login (like Facebook, Twitter, etc.)
    const initializeAuth = async () => {
      // Check if Supabase is configured
      if (typeof window !== 'undefined') {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        
        if (!supabaseUrl || !supabaseKey) {
          console.warn('⚠️ Supabase not configured - skipping auth check')
          if (mounted) {
            setUser(null)
            setAuthenticated(false)
            setAuthInitialized(true)
            setIsCheckingAuth(false)
          }
          return
        }
      }

      // Add timeout to prevent infinite loading (1 second max - fail fast)
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn('⚠️ Auth check timeout - proceeding without auth')
          setUser(null)
          setAuthenticated(false)
          setAuthInitialized(true)
          setIsCheckingAuth(false)
        }
      }, 1000)

      try {
        console.log('🔐 Checking for existing session...')
        setIsCheckingAuth(true) // Set to true when we start checking
        
        // Wrap getCurrentUser in a Promise.race to ensure it doesn't hang
        const userPromise = getCurrentUser().catch(err => {
          console.warn('⚠️ getCurrentUser error:', err)
          return null
        })
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('⚠️ getCurrentUser timeout - proceeding without user')
            resolve(null)
          }, 800) // 800ms timeout for getCurrentUser
        })
        
        const currentUser = await Promise.race([userPromise, timeoutPromise])
        
        if (timeoutId) clearTimeout(timeoutId)
        
        if (mounted) {
          if (currentUser) {
            console.log('✅ Valid session found - user is logged in:', currentUser.email)
            setUser(currentUser)
            setAuthenticated(true)
          } else {
            console.log('ℹ️ No valid session found - user is not logged in')
            setUser(null)
            setAuthenticated(false)
          }
          setAuthInitialized(true)
          setIsCheckingAuth(false)
        }
      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          setUser(null)
          setAuthenticated(false)
          setAuthInitialized(true)
          setIsCheckingAuth(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes (login, logout, token refresh, etc.)
    // This handles real-time auth events across tabs and automatic token refresh
    let subscription: { unsubscribe: () => void } | null = null
    try {
      const { data: { subscription: sub } } = onAuthStateChange((authUser) => {
        if (!mounted) {
          console.log('⚠️ Auth state change handler called but component unmounted')
          return
        }
        
        console.log('🔄 Auth state changed:', authUser ? `User logged in: ${authUser.email}` : 'User logged out')
        
        if (authUser) {
          console.log('✅ Setting user state:', { id: authUser.id.substring(0, 8), email: authUser.email })
          setUser(authUser)
          setAuthenticated(true)
          console.log('✅ User state updated in store')
        } else {
          console.log('ℹ️ Clearing user state')
          setUser(null)
          setAuthenticated(false)
        }
      })
      subscription = sub
      console.log('✅ Auth state change listener set up successfully')
    } catch (error) {
      console.warn('⚠️ Failed to set up auth state listener:', error)
    }

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      if (subscription) subscription.unsubscribe()
    }
  }, [setUser, setAuthenticated])

  const handleAuthSuccess = async () => {
    try {
      console.log('✅ Auth success callback called')
      
      // Close modal first to give immediate feedback
      setShowAuthModal(false)
      
      // Immediately check session and set user state - don't wait for auth state change handler
      // This ensures the UI updates even if the auth state change handler has issues
      try {
        const { supabase } = await import('@/lib/supabase')
        
        // Wait a short moment for Supabase to process the sign-in internally
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Get session directly - this is the most reliable approach
        console.log('🔐 handleAuthSuccess: Checking session directly...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.warn('⚠️ handleAuthSuccess: Session check error:', sessionError.message)
        }
        
        if (session?.user) {
          console.log('✅ handleAuthSuccess: Session found:', {
            userId: session.user.id.substring(0, 8),
            email: session.user.email,
          })
          
          // Get profile from database if available (non-blocking, with timeout)
          let profile = null
          try {
            const profilePromise = supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Profile fetch timeout')), 1500)
            )
            
            const { data } = await Promise.race([profilePromise, timeoutPromise]) as any
            profile = data
            if (profile) {
              console.log('✅ handleAuthSuccess: Profile fetched')
            }
          } catch (profileErr: any) {
            // Profile fetch failed or timed out - continue with auth user only
            if (!profileErr?.message?.includes('timeout')) {
              console.warn('⚠️ handleAuthSuccess: Profile fetch failed (non-critical):', profileErr.message)
            }
          }
          
          const authUser = {
            id: session.user.id,
            email: session.user.email || '',
            name: profile?.full_name || session.user.user_metadata?.full_name,
            avatar: profile?.avatar_url || session.user.user_metadata?.avatar_url,
          }
          
          console.log('✅ handleAuthSuccess: Setting user state directly:', {
            id: authUser.id.substring(0, 8),
            email: authUser.email,
          })
          setUser(authUser)
          setAuthenticated(true)
          
          // Verify the state was set
          await new Promise(resolve => setTimeout(resolve, 100))
          const store = useAppStore.getState()
          if (store.user && store.user.id === authUser.id) {
            console.log('✅ handleAuthSuccess: User state confirmed in store:', store.user.email)
          } else {
            console.error('❌ handleAuthSuccess: User state NOT confirmed in store! Retrying...')
            // Try setting again
            setUser(authUser)
            setAuthenticated(true)
            
            // Check one more time
            await new Promise(resolve => setTimeout(resolve, 100))
            const store2 = useAppStore.getState()
            if (store2.user) {
              console.log('✅ handleAuthSuccess: User state set on retry:', store2.user.email)
            } else {
              console.error('❌ handleAuthSuccess: User state still not set after retry!')
            }
          }
          
          console.log('✅ Auth success callback completed - user logged in:', authUser.email)
          return // Success - exit
        } else {
          console.warn('⚠️ handleAuthSuccess: No session found after sign-in')
          // Wait a bit longer and check again (auth state change handler might be processing)
          let attempts = 0
          const maxAttempts = 10 // 1 second
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100))
            const store = useAppStore.getState()
            if (store.user) {
              console.log('✅ handleAuthSuccess: User state set by auth state change handler:', store.user.email)
              return
            }
            attempts++
          }
          
          console.error('❌ handleAuthSuccess: User state not set after all attempts')
        }
      } catch (error: any) {
        // Handle any errors gracefully
        console.error('❌ Error in handleAuthSuccess:', error.message || error)
        // Don't throw - modal is already closed
      }
      
      console.log('✅ Auth success callback completed')
    } catch (error: any) {
      // Handle AbortError gracefully
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        console.warn('⚠️ Auth success callback aborted (likely race condition)')
      } else {
        console.error('❌ Error in handleAuthSuccess:', error)
      }
      // Ensure modal is closed even on error
      setShowAuthModal(false)
    }
  }

  // Don't block UI - check auth in background
  // Always render children immediately - never show loading screen

  // Always render children (allow guest browsing)
  // Auth modal is controlled by store state
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000, // Default 4 seconds for all toasts
          style: {
            background: '#1E1F22',
            color: '#fff',
            border: '1px solid rgba(58, 175, 169, 0.3)',
          },
          success: {
            duration: 3000, // 3 seconds for success messages
            iconTheme: {
              primary: '#00FFF0',
              secondary: '#1E1F22',
            },
          },
          error: {
            duration: 5000, // 5 seconds for error messages
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1E1F22',
            },
          },
          loading: {
            duration: Infinity, // Loading toasts stay until manually dismissed
          },
        }}
      />
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        context={pendingIdea ? 'project-creation' : 'general'}
        message={pendingIdea ? 'Sign up to save your project and continue creating' : undefined}
      />
      <ProfileSettingsModal />
    </>
  )
}
