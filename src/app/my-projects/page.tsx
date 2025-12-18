'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, FolderOpen, Plus, Calendar, Clock, Trash2 } from 'lucide-react'
import { loadUserProjects, deleteProject as deleteProjectFromDb } from '@/lib/db'
import { useAppStore } from '@/lib/store'
import { Project } from '@/types'
import toast from 'react-hot-toast'
import CreateProjectModal from '@/components/CreateProjectModal'

export default function MyProjectsPage() {
  const router = useRouter()
  const { user, isAuthenticated, setCurrentProject, createProject, projects, setProjects } = useAppStore()
  const [dbProjects, setDbProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    if (user?.id) {
      loadProjects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, user?.id])

  const loadProjects = async () => {
    if (!user?.id) {
      console.log('⚠️ loadProjects: No user ID available')
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    console.log('📁 loadProjects: Starting, user ID:', user.id)
    
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000)
      })

      const dataPromise = loadUserProjects(user.id)
      
      const data = await Promise.race([dataPromise, timeoutPromise])
      
      console.log('📁 loadProjects: Received data, count:', data.length)
      setDbProjects(data)
      // Also update the store with loaded projects
      setProjects(data)
      if (data.length === 0) {
        console.log('⚠️ No projects found. Create your first project!')
      }
    } catch (error: any) {
      console.error('❌ loadProjects: Error caught:', error)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      toast.error(error?.message || 'Failed to load projects')
      setDbProjects([])
    } finally {
      console.log('📁 loadProjects: Setting isLoading to false')
      setIsLoading(false)
    }
  }

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    router.push('/')
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    if (!user?.id) return

    setDeletingId(projectId)
    try {
      const result = await deleteProjectFromDb(projectId, user.id)
      if (result.success) {
        setDbProjects(dbProjects.filter(p => p.id !== projectId))
        toast.success('Project deleted')
      } else {
        throw new Error(result.error?.message || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateProjectSuccess = (project: Project) => {
    // Reload projects to show the new one
    loadProjects()
    // Optionally navigate to the project
    // setCurrentProject(project)
    // router.push('/')
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      <div className="min-h-screen bg-[#0C0C0C] text-white">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#0C0C0C]/95 backdrop-blur-sm border-b border-[#3AAFA9]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-6 h-6 text-[#00FFF0]" />
                <h1 className="text-3xl font-bold text-white">My Projects</h1>
                <span className="text-gray-400 text-sm">({dbProjects.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-4 py-2 rounded-xl flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="w-8 h-8 border-2 border-[#00FFF0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>Loading projects...</p>
            </div>
          ) : dbProjects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No projects yet.</p>
              <p className="text-sm mt-2">Create your first project to get started!</p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-6 bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {dbProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-[#0C0C0C] rounded-xl p-6 border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => handleOpenProject(project)}>
                      <h4 className="text-lg font-semibold text-white mb-2">
                        {project.name}
                      </h4>
                      {project.description && (
                        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {project.scenes?.length || 0} scenes
                        </div>
                        {project.updatedAt && (
                          <div className="text-gray-600">
                            Updated {new Date(project.updatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenProject(project)}
                        className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                      >
                        Open
                      </Button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        disabled={deletingId === project.id}
                        className="p-2 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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

