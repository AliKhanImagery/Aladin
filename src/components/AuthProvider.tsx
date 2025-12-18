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
        if (!mounted) return
        
        console.log('🔄 Auth state changed:', authUser ? 'User logged in' : 'User logged out')
        
        if (authUser) {
          setUser(authUser)
          setAuthenticated(true)
        } else {
          setUser(null)
          setAuthenticated(false)
        }
      })
      subscription = sub
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
      
      // Wait a moment for Supabase to fully process the auth state
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const currentUser = await getCurrentUser()
      if (currentUser) {
        console.log('✅ Auth success - user logged in:', currentUser.email)
        setUser(currentUser)
        setAuthenticated(true)
        setShowAuthModal(false)
        
        // Give the store a moment to update before continuing
        // This ensures the auth state is propagated to all components
        await new Promise(resolve => setTimeout(resolve, 100))
        
        console.log('✅ Auth state updated, ready for auto-continue')
      } else {
        console.warn('⚠️ Auth success but getCurrentUser returned null')
        // Still close modal and set auth state to false
        setShowAuthModal(false)
        setUser(null)
        setAuthenticated(false)
      }
    } catch (error) {
      console.error('❌ Error in handleAuthSuccess:', error)
      // Close modal even on error
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
          style: {
            background: '#1E1F22',
            color: '#fff',
            border: '1px solid rgba(58, 175, 169, 0.3)',
          },
          success: {
            iconTheme: {
              primary: '#00FFF0',
              secondary: '#1E1F22',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1E1F22',
            },
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
