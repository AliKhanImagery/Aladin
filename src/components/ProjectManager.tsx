'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { X, Plus, FolderOpen, Calendar, Clock, Image, Video } from 'lucide-react'
import { Project } from '@/types'
import CreateProjectModal from './CreateProjectModal'

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function ProjectManager() {
  const { 
    isProjectManagerOpen, 
    setProjectManagerOpen, 
    projects, 
    setCurrentProject,
    createProject 
  } = useAppStore()
  
  const [activeView, setActiveView] = useState<'projects' | 'images' | 'videos'>('projects')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const handleCreateProjectSuccess = (project: Project) => {
    setCurrentProject(project)
    setProjectManagerOpen(false)
  }

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    setProjectManagerOpen(false)
  }

  // Collect all generated images from all projects
  const allImages = projects.flatMap(project => 
    project.scenes.flatMap(scene => 
      scene.clips
        .filter(clip => clip.generatedImage)
        .map(clip => ({
          clip,
          scene,
          project,
          url: clip.generatedImage!,
          name: clip.name,
          prompt: clip.imagePrompt,
          createdAt: clip.createdAt
        }))
    )
  )

  // Collect all generated videos from all projects
  const allVideos = projects.flatMap(project => 
    project.scenes.flatMap(scene => 
      scene.clips
        .filter(clip => clip.generatedVideo)
        .map(clip => ({
          clip,
          scene,
          project,
          url: clip.generatedVideo!,
          name: clip.name,
          prompt: clip.videoPrompt,
          createdAt: clip.createdAt,
          duration: clip.duration
        }))
    )
  )

  if (!isProjectManagerOpen) return null

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#08080C] via-[#0C0C14] to-[#08080C] text-white relative">
        {/* Subtle neon overlay */}
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none z-0" />
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#08080C]/95 backdrop-blur-sm border-b border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
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
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {/* Navigation Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[#00FFF0]/30 relative z-10">
          <button
            onClick={() => setActiveView('projects')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeView === 'projects'
                ? 'border-[#00FFF0] text-[#00FFF0]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Projects
          </button>
          <button
            onClick={() => setActiveView('images')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeView === 'images'
                ? 'border-[#00FFF0] text-[#00FFF0]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Image className="w-4 h-4" />
            My Images ({allImages.length})
          </button>
          <button
            onClick={() => setActiveView('videos')}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeView === 'videos'
                ? 'border-[#00FFF0] text-[#00FFF0]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            My Videos ({allVideos.length})
          </button>
        </div>

          {/* Content based on active view */}
          {activeView === 'projects' && (
            <>
              {/* Create New Project Button */}
              <div className="mb-8">
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl flex items-center gap-2
                           shadow-[0_0_15px_rgba(0,255,240,0.5)] hover:shadow-[0_0_25px_rgba(0,255,240,0.8)] transition-all duration-300"
                >
                  <Plus className="w-5 h-5" />
                  Create New Project
                </Button>
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
                        {project.updatedAt && (
                          <div className="flex items-center gap-1" title={`Last updated: ${project.updatedAt.toLocaleString()}`}>
                            <Clock className="w-3 h-3" />
                            Updated {formatRelativeTime(project.updatedAt)}
                          </div>
                        )}
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
            </>
          )}

          {/* My Images View */}
          {activeView === 'images' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Image className="w-5 h-5 text-[#00FFF0]" />
              My Images ({allImages.length})
            </h3>
            
            {allImages.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No images generated yet. Generate images in your projects to see them here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allImages.map((item) => (
                  <div
                    key={`${item.project.id}-${item.scene.id}-${item.clip.id}`}
                    className="bg-[#0C0C0C] rounded-xl overflow-hidden border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-colors group"
                  >
                    <div className="relative aspect-video bg-[#1E1F22]">
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-medium text-white mb-1 truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        {item.project.name}
                      </p>
                      <p className="text-[8px] text-gray-500 truncate leading-tight mb-1">
                        {item.prompt || 'No prompt'}
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        {item.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* My Videos View */}
          {activeView === 'videos' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-[#00FFF0]" />
              My Videos ({allVideos.length})
            </h3>
            
            {allVideos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No videos generated yet. Generate videos in your projects to see them here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allVideos.map((item) => (
                  <div
                    key={`${item.project.id}-${item.scene.id}-${item.clip.id}`}
                    className="bg-[#0C0C0C] rounded-xl overflow-hidden border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-colors group"
                  >
                    <div className="relative aspect-video bg-[#1E1F22]">
                      {item.clip.generatedImage ? (
                        <img
                          src={item.clip.generatedImage}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-12 h-12 text-gray-500" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Video className="w-8 h-8 text-[#00FFF0]" />
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {item.duration}s
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-medium text-white mb-1 truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        {item.project.name}
                      </p>
                      <p className="text-[8px] text-gray-500 truncate leading-tight mb-1">
                        {item.prompt || 'No prompt'}
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        {item.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateProjectSuccess}
      />
    </>
  )
}
