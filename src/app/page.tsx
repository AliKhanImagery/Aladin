'use client'

import { useAppStore } from '@/lib/store'
import IdeaPromptScreen from '@/components/IdeaPromptScreen'
import MainApp from '@/components/MainApp'

export default function Home() {
  const { currentProject } = useAppStore()

  // Show idea prompt screen if no project, otherwise show main app
  if (!currentProject) {
    return <IdeaPromptScreen />
  }

  return <MainApp />
}

