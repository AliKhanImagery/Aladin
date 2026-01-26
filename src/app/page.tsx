'use client'

import { useAppStore } from '@/lib/store'
import IdeaPromptScreen from '@/components/IdeaPromptScreen'
import MainApp from '@/components/MainApp'

export default function Home() {
  const { currentProject } = useAppStore()

  // AuthProvider is now global in layout.tsx
  return !currentProject ? <IdeaPromptScreen /> : <MainApp />
}

