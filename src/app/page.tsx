'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import IdeaPromptScreen from '@/components/IdeaPromptScreen'
import MainApp from '@/components/MainApp'
import AuthProvider from '@/components/AuthProvider'
import { getCurrentUser, onAuthStateChange } from '@/lib/auth'

export default function Home() {
  const { currentProject, setUser, setAuthenticated, user } = useAppStore()

  useEffect(() => {
    // Check auth on mount
    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
        setAuthenticated(true)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange((authUser) => {
      if (authUser) {
        setUser(authUser)
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

  return (
    <AuthProvider>
      {!currentProject ? <IdeaPromptScreen /> : <MainApp />}
    </AuthProvider>
  )
}

