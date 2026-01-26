'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, FolderOpen, Plus, Calendar, Clock, Trash2, RefreshCw, ArrowLeft, Layout, ChevronRight } from 'lucide-react'
import { loadUserProjects, deleteProject as deleteProjectFromDb } from '@/lib/db'
import { useAppStore } from '@/lib/store'
import { Project } from '@/types'
import toast from 'react-hot-toast'
import Link from 'next/link'
import CreateProjectModal from '@/components/CreateProjectModal'
import Logo from '@/components/ui/Logo'

export default function MyProjectsPage() {
  const router = useRouter()
  const { user, isAuthenticated, setCurrentProject, projects, setProjects } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const loadProjects = useCallback(async (silent = false) => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }
    
    if (!silent) setIsLoading(true)
    
    try {
      const data = await loadUserProjects(user.id)
      setProjects(data)
    } catch (error: any) {
      console.error('❌ Production Error:', error)
      toast.error(error?.message || 'Failed to sync productions')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, setProjects])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    if (user?.id) {
      loadProjects()
    }
  }, [isAuthenticated, router, user?.id, loadProjects])

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    router.push('/')
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to deactivate this production? This cannot be undone.')) {
      return
    }

    if (!user?.id) return

    setDeletingId(projectId)
    try {
      const result = await deleteProjectFromDb(projectId, user.id)
      if (result.success) {
        setProjects(projects.filter(p => p.id !== projectId))
        toast.success('Production deactivated')
      } else {
        throw new Error(result.error?.message || 'Failed to deactivate production')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to deactivate production')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-brand-obsidian text-white flex flex-col relative overflow-x-hidden selection:bg-brand-emerald selection:text-brand-obsidian">
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-brand-emerald/5 blur-[140px] rounded-full rotate-12" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-brand-amber/5 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

        {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo size="sm" />
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
              <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-brand-emerald" />
              <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">Productions</h1>
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{projects.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-6 rounded-full bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[10px] flex items-center gap-2"
                >
              <Plus className="w-3.5 h-3.5" />
              New Production
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
              className="w-10 h-10 rounded-full border border-white/5 hover:bg-white/10 text-white/40 hover:text-white"
                >
              <X className="w-5 h-5" />
                </Button>
          </div>
        </div>
      </header>

        {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12 relative z-10">
          {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-white/20">
            <div className="w-12 h-12 border-2 border-brand-emerald/30 border-t-brand-emerald rounded-full animate-spin mb-6" />
            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Syncing Production Ledger...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] flex items-center justify-center mb-8">
              <FolderOpen className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-4 italic serif text-white/60">No Active Productions.</h2>
            <p className="text-sm text-white/20 font-medium leading-relaxed mb-10">
              The studio is awaiting its first orchestration. <br />
              Initialize a production to begin the creative process.
            </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
              className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-500 font-black uppercase tracking-widest text-[11px]"
              >
              Initialize First Production
              </Button>
            </div>
          ) : (
          <div className="grid gap-6">
            {projects.map((project) => (
                <div
                  key={project.id}
                className="group relative flex flex-col glass-panel bg-white/[0.01] border-white/[0.08] rounded-[2rem] overflow-hidden transition-all duration-700 hover:border-brand-emerald/30 hover:shadow-2xl hover:shadow-brand-emerald/5"
                >
                <div className="flex flex-col md:flex-row items-stretch">
                  <div className="flex-1 p-8 md:p-10 flex flex-col justify-between cursor-pointer" onClick={() => handleOpenProject(project)}>
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Active Identity</span>
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight text-white group-hover:text-brand-emerald transition-colors duration-500 mb-3">
                        {project.name}
                      </h2>
                      {project.description && (
                        <p className="text-sm text-white/30 font-medium leading-relaxed line-clamp-2 max-w-2xl">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-8 mt-10 pt-8 border-t border-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-3.5 h-3.5 text-white/10" />
                        <div>
                          <p className="text-[9px] font-black text-white/10 uppercase tracking-widest leading-none">Initialized</p>
                          <p className="text-[11px] font-bold text-white/40 mt-1">{new Date(project.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Layout className="w-3.5 h-3.5 text-white/10" />
                        <div>
                          <p className="text-[9px] font-black text-white/10 uppercase tracking-widest leading-none">Sequences</p>
                          <p className="text-[11px] font-bold text-white/40 mt-1">{project.scenes?.length || 0} Blocks</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-3.5 h-3.5 text-white/10" />
                        <div>
                          <p className="text-[9px] font-black text-white/10 uppercase tracking-widest leading-none">Last Synced</p>
                          <p className="text-[11px] font-bold text-white/40 mt-1">{new Date(project.updatedAt || project.createdAt).toLocaleDateString()}</p>
                          </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:w-64 bg-white/[0.01] border-l border-white/[0.03] p-8 flex flex-col justify-center items-center gap-4">
                      <Button
                        onClick={() => handleOpenProject(project)}
                      className="w-full h-14 rounded-xl bg-white/5 border border-white/10 hover:bg-brand-emerald hover:text-brand-obsidian hover:border-brand-emerald text-white font-black uppercase tracking-widest text-[10px] transition-all duration-500 group/btn"
                      >
                      <span>Open Production</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        disabled={deletingId === project.id}
                      className="w-full h-10 rounded-xl text-[9px] font-black text-white/10 hover:text-red-400 hover:bg-red-400/5 uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2"
                      >
                      <Trash2 className="w-3 h-3" />
                      Deactivate
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </main>

      <footer className="py-16 px-8 border-t border-white/[0.03] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 text-white/10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-brand-emerald opacity-40" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Protocol 2.6.0</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em]">
            geniferAI Studio | Production Ledger
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">geniferAI © 2026</span>
          </div>
        </div>
      </footer>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => loadProjects(false)}
      />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;700;900&display=swap');
        .serif { font-family: 'Playfair Display', serif; }
        body { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  )
}
