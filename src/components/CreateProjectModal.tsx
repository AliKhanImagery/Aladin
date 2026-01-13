'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { X, Sparkles, Layout } from 'lucide-react'
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
      const idea = localStorage.getItem('pendingIdea')
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
        createdBy: user?.id || 'anonymous',
        settings: {
          defaultDuration: 5,
          defaultQuality: 'standard',
          autoRetry: true,
          maxRetries: 3,
          consentRequired: true,
          offlineMode: false,
          dontGenerateImages: false 
        },
        story: {
          id: crypto.randomUUID(),
          originalIdea: localStorage.getItem('pendingIdea') || '',
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
          owner: user?.id || 'anonymous',
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
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#020617]/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="bg-[#09090b] rounded-[2.5rem] border border-white/[0.08] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-xl overflow-hidden relative">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-emerald/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex items-center justify-between p-8 border-b border-white/[0.03] relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
              <Layout className="w-6 h-6 text-brand-emerald" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">Initialize Production</h2>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Configure New Foundry Project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 relative z-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">
              Production Identity
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Project Neo-Noir Campaign"
              required
              className="h-16 bg-white/[0.02] border-white/10 text-xl font-bold tracking-tight text-white placeholder:text-white/5 
                       focus:border-brand-emerald/40 focus:ring-0 rounded-2xl px-6 transition-all duration-500"
            />
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">
              Mission Parameters (Optional)
            </label>
            <Textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Describe the objective of this production..."
              rows={4}
              className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/5 
                       focus:border-brand-emerald/40 focus:ring-0 rounded-2xl p-6 transition-all duration-500 resize-none leading-relaxed"
            />
          </div>
          
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-16 rounded-2xl border border-white/5 text-[11px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 transition-all duration-500"
            >
              Abort
            </button>
            <Button
              type="submit"
              disabled={!projectName.trim() || isCreating}
              className="flex-[2] h-16 rounded-2xl bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-700 font-black uppercase tracking-widest text-[11px] shadow-2xl group"
            >
              {isCreating ? (
                <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span>Construct Production</span>
                </div>
              )}
            </Button>
          </div>
        </form>
        
        {/* Footer Protocol */}
        <div className="px-10 py-6 bg-brand-emerald/[0.02] border-t border-white/[0.03] flex items-center justify-between">
          <span className="text-[9px] font-bold text-white/10 uppercase tracking-[0.4em]">Engine Protocol v2.6.0</span>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-brand-emerald/40" />
            <div className="w-1 h-1 rounded-full bg-brand-emerald/20" />
            <div className="w-1 h-1 rounded-full bg-brand-emerald/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
