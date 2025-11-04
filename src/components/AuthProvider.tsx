'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getCurrentUser, onAuthStateChange } from '@/lib/auth'
import AuthModal from './AuthModal'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthenticated, user, showAuthModal, setShowAuthModal, pendingIdea } = useAppStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
          setAuthenticated(true)
        } else {
          setUser(null)
          setAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setUser(null)
        setAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = onAuthStateChange((user) => {
      if (user) {
        setUser(user)
        setAuthenticated(true)
      } else {
        setUser(null)
        setAuthenticated(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setUser, setAuthenticated])

  const handleAuthSuccess = async () => {
    const currentUser = await getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      setAuthenticated(true)
      setShowAuthModal(false)
    }
  }

  // Always render children (allow guest browsing)
  // Auth modal is controlled by store state
  return (
    <>
      {children}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        context={pendingIdea ? 'project-creation' : 'general'}
        message={pendingIdea ? 'Sign up to save your project and continue creating' : undefined}
      />
    </>
  )
}
