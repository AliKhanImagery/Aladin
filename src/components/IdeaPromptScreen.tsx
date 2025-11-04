'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Sparkles, FolderOpen } from 'lucide-react'
import { Project } from '@/types'
import ProjectManager from './ProjectManager'

export default function IdeaPromptScreen() {
  const { 
    createProject, 
    setCurrentProject, 
    setProjectManagerOpen,
    isAuthenticated,
    setShowAuthModal,
    setPendingIdea,
    pendingIdea
  } = useAppStore()
  const [idea, setIdea] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  
  // Restore idea from localStorage or pendingIdea on mount
  useEffect(() => {
    const savedIdea = localStorage.getItem('pendingIdea')
    if (savedIdea) {
      setIdea(savedIdea)
      setPendingIdea(savedIdea)
    } else if (pendingIdea) {
      setIdea(pendingIdea)
    }
  }, [setPendingIdea, pendingIdea])

  const handleCreateFromIdea = async () => {
    if (!idea.trim()) return

    // Check if user is authenticated
    if (!isAuthenticated) {
      // Save idea to localStorage and store
      localStorage.setItem('pendingIdea', idea)
      setPendingIdea(idea)
      // Show auth modal
      setShowAuthModal(true)
      return
    }

    // User is authenticated, proceed with project creation
    await createProjectFromIdea(idea)
  }

  const createProjectFromIdea = async (ideaToUse: string) => {
    setIsCreating(true)

    // Clear pending idea from localStorage and store
    localStorage.removeItem('pendingIdea')
    setPendingIdea(null)

    // Auto-generate project name from idea (first 50 chars or first sentence)
    const projectName = ideaToUse.length > 50 
      ? ideaToUse.substring(0, 50).trim() + '...'
      : ideaToUse.trim()

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: projectName,
      description: ideaToUse.length > 100 ? ideaToUse.substring(0, 100) + '...' : ideaToUse,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'current-user',
      settings: {
        defaultDuration: 5,
        defaultQuality: 'standard',
        autoRetry: true,
        maxRetries: 3,
        consentRequired: true,
        offlineMode: false
      },
      story: {
        id: crypto.randomUUID(),
        originalIdea: ideaToUse,
        generatedStory: '',
        targetRuntime: 60,
        actualRuntime: 0,
        tone: '',
        brandCues: [],
        styleTokens: [],
        rationale: '',
        aspectRatio: '16:9' // Default aspect ratio
      },
      scenes: [],
      characters: [],
      metadata: {
        version: '1.0.0',
        lastModified: new Date(),
        totalClips: 0,
        totalDuration: 0,
        totalCost: 0
      },
      permissions: {
        owner: 'current-user',
        collaborators: [],
        roles: []
      },
      budget: {
        projectId: '',
        softCap: 100,
        hardCap: 500,
        currentSpend: 0,
        currency: 'USD',
        alerts: []
      }
    }

    // Auto-create project
    createProject(newProject)
    setCurrentProject(newProject)
    setIsCreating(false)
  }

  // Auto-continue project creation after successful auth
  useEffect(() => {
    if (isAuthenticated && pendingIdea && !isCreating) {
      // User just authenticated and has a pending idea
      const ideaToContinue = pendingIdea
      createProjectFromIdea(ideaToContinue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, pendingIdea, isCreating])

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white flex items-center justify-center p-4 relative">
      {/* Projects Button - Top Right */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setProjectManagerOpen(true)}
          className="text-gray-400 hover:text-[#00FFF0] hover:bg-[#00FFF0]/10 flex items-center gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Projects</span>
        </Button>
      </div>
      
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#00FFF0]/10 rounded-full mb-6">
            <Sparkles className="w-10 h-10 text-[#00FFF0]" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">StoryFlow AI</h1>
          <p className="text-xl text-gray-400 mb-2">From Idea to Frame</p>
          <p className="text-sm text-gray-500">
            Transform your creative idea into a visual storyboard
          </p>
        </div>

        <div className="bg-[#1E1F22] rounded-2xl p-8 border border-[#3AAFA9]/20">
          <label className="block text-lg font-semibold text-white mb-4">
            Share Your Idea
          </label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your scene, story, or concept... For example: 'A young woman discovers an old camera in her attic that shows glimpses of the future when she takes photos...'"
            className="w-full h-40 bg-[#0C0C0C] border-[#3AAFA9] text-white placeholder:text-gray-500 
                     focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/20 focus:outline-none
                     rounded-xl px-4 py-3 text-base resize-none"
          />
          
          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleCreateFromIdea}
              disabled={!idea.trim() || isCreating}
              className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-8 py-3 rounded-xl
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Creating Project...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start Creating
                </div>
              )}
            </Button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Your project will be automatically saved with your idea</p>
        </div>
      </div>
      
      {/* Project Manager */}
      <ProjectManager />
    </div>
  )
}

