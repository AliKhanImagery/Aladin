'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { X } from 'lucide-react'
import { Project } from '@/types'
import { useAppStore } from '@/lib/store'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (project: Project) => void
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { createProject, user } = useAppStore()
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Auto-generate project name from current idea
  useEffect(() => {
    if (isOpen && !projectName) {
      const idea = localStorage.getItem('currentIdea')
      if (idea) {
        const words = idea.split(' ').slice(0, 3).join(' ')
        setProjectName(`${words} - ${new Date().toLocaleDateString()}`)
      }
    }
  }, [isOpen, projectName])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProjectName('')
      setProjectDescription('')
      setIsCreating(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return
    
    setIsCreating(true)
    
    try {
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: projectDescription,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'current-user', // TODO: Get from auth
        settings: {
          defaultDuration: 5,
          defaultQuality: 'standard',
          autoRetry: true,
          maxRetries: 3,
          consentRequired: true,
          offlineMode: false,
          dontGenerateImages: false // Default to generating images for manually created projects
        },
        story: {
          id: crypto.randomUUID(),
          originalIdea: localStorage.getItem('currentIdea') || '',
          generatedStory: '',
          targetRuntime: 60,
          actualRuntime: 0,
          tone: '',
          brandCues: [],
          styleTokens: [],
          rationale: '',
          aspectRatio: '16:9'
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
    
      // Save to database if user is authenticated
      if (user?.id) {
        try {
          const { saveProject } = await import('@/lib/db')
          await saveProject(newProject, user.id)
          console.log('✅ Project saved to database:', newProject.name)
        } catch (error) {
          console.error('Error saving project to database:', error)
          // Continue anyway - project is in local state
        }
      }
      
      createProject(newProject)
      onSuccess(newProject)
      onClose()
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/30 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#3AAFA9]/20">
          <h2 className="text-xl font-bold text-white">Create New Project</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Name *
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              required
              className="bg-[#0C0C0C] border-[#3AAFA9]/30 text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <Textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Describe your project..."
              rows={3}
              className="bg-[#0C0C0C] border-[#3AAFA9]/30 text-white placeholder:text-gray-500 focus:border-[#00FFF0] focus:outline-none"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-[#3AAFA9]/30 text-gray-300 hover:bg-[#3AAFA9]/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!projectName.trim() || isCreating}
              className="flex-1 bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

