'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles } from 'lucide-react'
import { Project } from '@/types'
import ProjectManager from './ProjectManager'
import UserMenu from './UserMenu'

export default function IdeaPromptScreen() {
  const { 
    createProject, 
    setCurrentProject, 
    setProjectManagerOpen,
    isAuthenticated,
    setShowAuthModal,
    setPendingIdea,
    pendingIdea,
    user
  } = useAppStore()
  const [idea, setIdea] = useState('')
  const [dontGenerateImages, setDontGenerateImages] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('🔍 IdeaPromptScreen state:', {
      ideaLength: idea.length,
      ideaTrimmed: idea.trim().length,
      isCreating,
      isAuthenticated,
      buttonDisabled: !idea.trim() || isCreating
    })
  }, [idea, isCreating, isAuthenticated])
  
  // Safeguard: Reset isCreating if it's been stuck for more than 30 seconds
  useEffect(() => {
    if (isCreating) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ isCreating has been true for 30s, resetting...')
        setIsCreating(false)
      }, 30000)
      
      return () => clearTimeout(timeout)
    }
  }, [isCreating])
  
  // Restore idea and toggle from localStorage or pendingIdea on mount
  useEffect(() => {
    const savedIdea = localStorage.getItem('pendingIdea')
    const savedDontGenerateImages = localStorage.getItem('pendingDontGenerateImages')
    
    if (savedIdea) {
      setIdea(savedIdea)
      setPendingIdea(savedIdea)
    } else if (pendingIdea) {
      setIdea(pendingIdea)
    }
    
    if (savedDontGenerateImages === 'true') {
      setDontGenerateImages(true)
    }
  }, [setPendingIdea, pendingIdea])
  
  // Also restore when auth state changes (after sign-in)
  useEffect(() => {
    if (isAuthenticated) {
      const savedIdea = localStorage.getItem('pendingIdea')
      const savedDontGenerateImages = localStorage.getItem('pendingDontGenerateImages')
      
      if (savedIdea && !idea) {
        setIdea(savedIdea)
        setPendingIdea(savedIdea)
      }
      
      if (savedDontGenerateImages === 'true') {
        setDontGenerateImages(true)
      }
    }
  }, [isAuthenticated, setPendingIdea, idea])
  
  // Save idea to localStorage as user types (for persistence)
  // Only save if idea has content and is different from what's already saved
  useEffect(() => {
    const savedIdea = localStorage.getItem('pendingIdea')
    if (idea.trim() && idea !== savedIdea) {
      localStorage.setItem('pendingIdea', idea)
      setPendingIdea(idea)
    }
  }, [idea, setPendingIdea])
  
  // Save toggle state to localStorage
  useEffect(() => {
    const savedToggle = localStorage.getItem('pendingDontGenerateImages')
    if (savedToggle !== dontGenerateImages.toString()) {
      localStorage.setItem('pendingDontGenerateImages', dontGenerateImages.toString())
    }
  }, [dontGenerateImages])

  const handleCreateFromIdea = async () => {
    console.log('🚀 handleCreateFromIdea called:', {
      ideaLength: idea.length,
      ideaTrimmed: idea.trim().length,
      isCreating,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id
    })
    
    if (!idea.trim()) {
      console.warn('⚠️ Cannot create: idea is empty')
      return
    }
    
    if (isCreating) {
      console.warn('⚠️ Already creating, ignoring click')
      return
    }

    // Check if user is authenticated - require both isAuthenticated and user object
    if (!isAuthenticated || !user || !user.id) {
      console.log('🔐 User not authenticated, showing auth modal', {
        isAuthenticated,
        hasUser: !!user,
        userId: user?.id
      })
      // Save idea and toggle state to localStorage and store
      localStorage.setItem('pendingIdea', idea)
      localStorage.setItem('pendingDontGenerateImages', dontGenerateImages.toString())
      setPendingIdea(idea)
      // Show auth modal
      setShowAuthModal(true)
      return
    }

    // User is authenticated, proceed with project creation
    console.log('✅ User authenticated, proceeding with project creation')
    try {
      await createProjectFromIdea(idea)
    } catch (error) {
      console.error('❌ Error in handleCreateFromIdea:', error)
      // Error handling is already in createProjectFromIdea, but ensure isCreating is reset
      setIsCreating(false)
    }
  }

  const createProjectFromIdea = async (ideaToUse: string) => {
    if (!ideaToUse?.trim()) {
      console.error('❌ createProjectFromIdea called with empty idea')
      setIsCreating(false)
      return
    }
    
    console.log('📝 createProjectFromIdea called with:', ideaToUse?.substring(0, 50))
    
    // Prevent duplicate calls
    if (isCreating) {
      console.warn('⚠️ Already creating, ignoring duplicate call')
      return
    }
    
    setIsCreating(true)

    try {
      // Clear pending idea and toggle from localStorage and store
      localStorage.removeItem('pendingIdea')
      localStorage.removeItem('pendingDontGenerateImages')
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
        offlineMode: false,
        dontGenerateImages: dontGenerateImages
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
      
      // Save to database if user is authenticated
      if (isAuthenticated && user?.id) {
        try {
          const { saveProject } = await import('@/lib/db')
          await saveProject(newProject, user.id)
          console.log('✅ Project saved to database:', newProject.name)
        } catch (error) {
          console.error('Error saving project to database:', error)
          // Continue anyway - project is in local state
        }
      }
      
      console.log('✅ Project creation complete, setting isCreating to false')
      setIsCreating(false)
    } catch (error) {
      console.error('❌ Error in createProjectFromIdea:', error)
      setIsCreating(false)
      throw error
    }
  }

  // Auto-continue project creation after successful auth
  useEffect(() => {
    if (isAuthenticated && pendingIdea && !isCreating && user?.id) {
      // User just authenticated and has a pending idea
      // Wait a moment to ensure auth state is fully propagated
      const timer = setTimeout(() => {
        const ideaToContinue = pendingIdea
        console.log('🔄 Auto-continuing project creation after auth:', ideaToContinue)
        
        // Clear pending idea first to prevent duplicate calls
        setPendingIdea(null)
        
        // Create project
        createProjectFromIdea(ideaToContinue).catch((error) => {
          console.error('❌ Error in auto-continue:', error)
          setIsCreating(false)
        })
      }, 300)
      
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, pendingIdea, isCreating, user?.id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08080C] via-[#0C0C14] to-[#08080C] text-white flex flex-col relative">
      {/* Subtle neon overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none z-0" />
      
      {/* Header with UserMenu */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-[#08080C]/95 backdrop-blur-md border-b border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-end h-16">
            <UserMenu user={user} />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#00FFF0]/10 rounded-full mb-6 shadow-[0_0_20px_rgba(0,255,240,0.3)] neon-pulse">
            <Sparkles className="w-10 h-10 text-[#00FFF0]" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 neon-text">StoryFlow AI</h1>
          <p className="text-sm text-gray-500">
            Transform your creative idea into a visual storyboard
          </p>
        </div>

        <div className="bg-[#1A1A24] rounded-2xl p-8 border border-[#00FFF0]/30 shadow-[0_0_15px_rgba(0,255,240,0.1)]">
          <label className="block text-lg font-semibold text-white mb-4">
            Share Your Idea
          </label>
          <Textarea
            value={idea}
            onChange={(e) => {
              const newValue = e.target.value
              console.log('📝 Textarea onChange:', { length: newValue.length, trimmed: newValue.trim().length })
              setIdea(newValue)
            }}
            onInput={(e) => {
              // Ensure state updates on input events too
              const target = e.target as HTMLTextAreaElement
              if (target.value !== idea) {
                setIdea(target.value)
              }
            }}
            placeholder="Describe your scene, story, or concept... For example: 'A young woman discovers an old camera in her attic that shows glimpses of the future when she takes photos...'"
            className="w-full h-40 bg-[#0C0C0C] border-[#00FFF0]/30 text-white placeholder:text-gray-500 
                     focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/30 focus:outline-none
                     focus:shadow-[0_0_10px_rgba(0,255,240,0.2)]
                     rounded-xl px-4 py-3 text-base resize-none transition-all duration-300"
          />
          
          {/* Don't Generate Images Toggle */}
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id="dont-generate-images"
              checked={dontGenerateImages}
              onChange={(e) => setDontGenerateImages(e.target.checked)}
            />
            <label 
              htmlFor="dont-generate-images" 
              className="text-sm text-gray-300 cursor-pointer select-none"
            >
              Don't generate images
            </label>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button
              onClick={(e) => {
                console.log('🔘 Button clicked:', { ideaLength: idea.length, ideaTrimmed: idea.trim().length, isCreating })
                handleCreateFromIdea()
              }}
              disabled={!idea.trim() || isCreating}
              className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-8 py-3 rounded-xl
                       shadow-[0_0_15px_rgba(0,255,240,0.5)] hover:shadow-[0_0_25px_rgba(0,255,240,0.8)]
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              title={!idea.trim() ? 'Please enter an idea' : isCreating ? 'Creating project...' : 'Start creating your project'}
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
      </div>
      
      {/* Project Manager */}
      <ProjectManager />
    </div>
  )
}

