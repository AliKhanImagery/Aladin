'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { X, Plus, FolderOpen, Calendar, Clock, Image as ImageIcon, Video, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import { Project } from '@/types'
import CreateProjectModal from './CreateProjectModal'
import Link from 'next/link'
import { loadUserProjects, deleteProject as deleteProjectFromDb } from '@/lib/db'
import toast from 'react-hot-toast'

export default function ProjectManager() {
  const { 
    isProjectManagerOpen, 
    setProjectManagerOpen, 
    projects, 
    setCurrentProject,
    setProjects,
    user
  } = useAppStore()
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const data = await loadUserProjects(user.id)
      setProjects(data)
    } catch (error) {
      console.error('Failed to reload projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, setProjects])

  useEffect(() => {
    if (isProjectManagerOpen && projects.length === 0) {
      loadProjects()
    }
  }, [isProjectManagerOpen, projects.length, loadProjects])

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    setProjectManagerOpen(false)
  }

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (!confirm('Deactivate this production?')) return
    if (!user?.id) return

    setDeletingId(projectId)
    try {
      const result = await deleteProjectFromDb(projectId, user.id)
      if (result.success) {
        setProjects(projects.filter(p => p.id !== projectId))
        toast.success('Production deactivated')
      }
    } catch (error) {
      toast.error('Failed to deactivate')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isProjectManagerOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-2xl p-4 md:p-8 animate-in fade-in duration-500">
      <div className="bg-[#09090b] w-full max-w-5xl h-[85vh] rounded-[3rem] border border-white/[0.08] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative">
        
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-brand-emerald/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-brand-amber/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Header */}
        <div className="flex items-center justify-between p-8 md:p-10 border-b border-white/[0.03] relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-brand-emerald" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white uppercase tracking-widest italic serif">Project Library</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Stored Records</span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <span className="text-[10px] font-black text-brand-emerald uppercase tracking-[0.2em]">{projects.length} Projects</span>
            </div>
          </div>
        </div>

          <div className="flex items-center gap-4">
            <button
              onClick={loadProjects}
              disabled={isLoading}
              className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setProjectManagerOpen(false)}
              className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 md:p-10 relative z-10 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Card */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="group relative flex flex-col items-center justify-center p-10 rounded-[2rem] border-2 border-dashed border-white/5 hover:border-brand-emerald/40 hover:bg-brand-emerald/[0.02] transition-all duration-700"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-brand-emerald group-hover:text-brand-obsidian transition-all duration-500">
                <Plus className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white/40 group-hover:text-white uppercase tracking-widest transition-colors">Create New</h3>
              <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em] mt-2">v2.6 Dashboard</p>
            </button>

            {/* Project Cards */}
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => handleOpenProject(project)}
                className="group relative flex flex-col p-8 rounded-[2.5rem] bg-white/[0.01] border border-white/[0.08] hover:border-brand-emerald/30 transition-all duration-700 cursor-pointer hover:shadow-2xl hover:shadow-brand-emerald/5"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Record ID {project.id.substring(0, 8)}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, project.id)}
                    disabled={deletingId === project.id}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/10 hover:text-red-400 hover:bg-red-400/5 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-white group-hover:text-brand-emerald transition-colors duration-500 mb-2 truncate">
                  {project.name}
                </h3>
                <p className="text-xs text-white/20 font-medium line-clamp-2 leading-relaxed mb-8">
                  {project.description || 'No project description provided.'}
                </p>

                <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/[0.03]">
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-white/10" />
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                        {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layout className="w-3 h-3 text-white/10" />
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                        {project.scenes?.length || 0} Scenes
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand-emerald group-hover:text-brand-obsidian transition-all duration-500">
                    <ChevronRight className="w-4 h-4" />
              </div>
            </div>
              </div>
            ))}
                      </div>
                    </div>

        {/* Global Access Footer */}
        <div className="p-8 md:p-10 border-t border-white/[0.03] bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex gap-4">
            <Link href="/my-images" onClick={() => setProjectManagerOpen(false)} className="px-6 py-3 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5" />
              My Images
            </Link>
            <Link href="/my-videos" onClick={() => setProjectManagerOpen(false)} className="px-6 py-3 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
              <Video className="w-3.5 h-3.5" />
              My Videos
            </Link>
                      </div>
          <span className="text-[9px] font-bold text-white/10 uppercase tracking-[0.5em]">Version 2.6.0 | Flowboard Studio</span>
        </div>
      </div>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => loadProjects()}
      />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.2); }
      `}</style>
    </div>
  )
}
