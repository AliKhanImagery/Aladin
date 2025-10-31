'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { Project } from '@/types'

export default function IdeaPromptScreen() {
  const { createProject, setCurrentProject } = useAppStore()
  const [idea, setIdea] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateFromIdea = async () => {
    if (!idea.trim()) return

    setIsCreating(true)

    // Auto-generate project name from idea (first 50 chars or first sentence)
    const projectName = idea.length > 50 
      ? idea.substring(0, 50).trim() + '...'
      : idea.trim()

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: projectName,
      description: idea.length > 100 ? idea.substring(0, 100) + '...' : idea,
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
        originalIdea: idea,
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

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white flex items-center justify-center p-4">
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
    </div>
  )
}

