'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Plus, FolderOpen, Calendar, Clock } from 'lucide-react'
import { Project } from '@/types'

export default function ProjectManager() {
  const { 
    isProjectManagerOpen, 
    setProjectManagerOpen, 
    projects, 
    setCurrentProject,
    createProject 
  } = useAppStore()
  
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Auto-generate project name from current idea
  useEffect(() => {
    if (isProjectManagerOpen && !newProjectName) {
      const idea = localStorage.getItem('currentIdea')
      if (idea) {
        const words = idea.split(' ').slice(0, 3).join(' ')
        setNewProjectName(`${words} - ${new Date().toLocaleDateString()}`)
      }
    }
  }, [isProjectManagerOpen, newProjectName])

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    
    setIsCreating(true)
    
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      description: newProjectDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'current-user', // TODO: Get from auth
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
        originalIdea: localStorage.getItem('currentIdea') || '',
        generatedStory: '',
        targetRuntime: 60,
        actualRuntime: 0,
        tone: '',
        brandCues: [],
        styleTokens: [],
        rationale: ''
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
    
    // Simulate API call
    setTimeout(() => {
      createProject(newProject)
      setNewProjectName('')
      setNewProjectDescription('')
      setIsCreating(false)
      setProjectManagerOpen(false)
    }, 1000)
  }

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    setProjectManagerOpen(false)
  }

  if (!isProjectManagerOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setProjectManagerOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-[#1E1F22] rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Project Manager</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setProjectManagerOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Create New Project */}
        <div className="mb-8 p-6 bg-[#0C0C0C] rounded-xl border border-[#3AAFA9]/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#00FFF0]" />
            Create New Project
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project Name
              </label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name..."
                className="bg-[#1E1F22] border-[#3AAFA9] text-white placeholder:text-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (Optional)
              </label>
              <Textarea
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Describe your project..."
                className="bg-[#1E1F22] border-[#3AAFA9] text-white placeholder:text-gray-400"
                rows={3}
              />
            </div>
            
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreating}
              className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </div>

        {/* Existing Projects */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#00FFF0]" />
            Your Projects
          </h3>
          
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No projects yet. Create your first project above!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-[#0C0C0C] rounded-xl p-6 border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-colors cursor-pointer"
                  onClick={() => handleOpenProject(project)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        {project.name}
                      </h4>
                      {project.description && (
                        <p className="text-gray-400 text-sm mb-3">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {project.createdAt.toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {project.scenes.length} scenes
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                    >
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
