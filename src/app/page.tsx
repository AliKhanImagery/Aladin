'use client'

import { useAppStore } from '@/lib/store'
import IdeaPromptScreen from '@/components/IdeaPromptScreen'
import MainApp from '@/components/MainApp'
import AuthProvider from '@/components/AuthProvider'

export default function Home() {
  const { currentProject } = useAppStore()

  // Auth checking is now handled entirely by AuthProvider
  // This prevents duplicate checks and ensures consistent state
  return (
    <AuthProvider>
      {!currentProject ? <IdeaPromptScreen /> : <MainApp />}
    </AuthProvider>
  )
}

