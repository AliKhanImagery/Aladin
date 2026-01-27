'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Briefcase, Zap, Film, Layout, Command, ArrowRight } from 'lucide-react'
import { Project } from '@/types'
import UserMenu from './UserMenu'
import CreditsBadge from './CreditsBadge'
import Logo from './ui/Logo'

const PERSONAS = [
  {
    id: 'business',
    title: 'Business Owners',
    hook: 'Scale your content.',
    icon: Briefcase,
    placeholder: "Describe your campaign goal... Example: A professional brand story for a sustainable architecture firm, focusing on heritage and modern design."
  },
  {
    id: 'creator',
    title: 'Creators',
    hook: 'Visual ideation.',
    icon: Zap,
    placeholder: "Input your vision... Example: A high-energy tutorial exploring the golden ratio in cinematography, designed for maximum engagement."
  },
  {
    id: 'agency',
    title: 'Agencies',
    hook: 'Rapid production.',
    icon: Film,
    placeholder: "Define the project goal... Example: A series of cinematic sequences for a luxury lifestyle brand, maintaining visual consistency."
  },
  {
    id: 'editor',
    title: 'Editors',
    hook: 'Creative control.',
    icon: Layout,
    placeholder: "Describe the sequence... Example: A high-contrast abstract introduction for a documentary series on urban architecture."
  }
]

export default function IdeaPromptScreen() {
  const { 
    createProject, 
    setCurrentProject, 
    isAuthenticated,
    setShowAuthModal,
    setPendingIdea,
    pendingIdea,
    user
  } = useAppStore()
  
  const [idea, setIdea] = useState('')
  const [dontGenerateImages, setDontGenerateImages] = useState(false)
  const [selectedImageModel, setSelectedImageModel] = useState<'flux-2-pro' | 'nano-banana' | 'reeve'>('flux-2-pro')
  const [isCreating, setIsCreating] = useState(false)
  const [activePersona, setActivePersona] = useState(PERSONAS[0])
  
  useEffect(() => {
    const savedIdea = localStorage.getItem('pendingIdea')
    const savedDontGenerateImages = localStorage.getItem('pendingDontGenerateImages')
    const savedImageModel = localStorage.getItem('pendingImageModel')
    
    if (savedIdea) { setIdea(savedIdea); setPendingIdea(savedIdea); }
    else if (pendingIdea) { setIdea(pendingIdea); }
    
    if (savedDontGenerateImages === 'true') setDontGenerateImages(true)
    if (savedImageModel) setSelectedImageModel(savedImageModel as any)
  }, [setPendingIdea, pendingIdea])
  
  useEffect(() => {
    if (idea.trim()) {
      localStorage.setItem('pendingIdea', idea)
      setPendingIdea(idea)
    }
  }, [idea, setPendingIdea])

  const createProjectFromIdea = async (ideaToUse: string) => {
    if (!ideaToUse?.trim()) return
    setIsCreating(true)
    try {
      localStorage.removeItem('pendingIdea')
      localStorage.removeItem('pendingDontGenerateImages')
      localStorage.removeItem('pendingImageModel')
      setPendingIdea(null)
      const projectName = ideaToUse.length > 50 ? ideaToUse.substring(0, 50).trim() + '...' : ideaToUse.trim()
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: ideaToUse.length > 100 ? ideaToUse.substring(0, 100) + '...' : ideaToUse,
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
          dontGenerateImages: dontGenerateImages,
          imageModel: selectedImageModel
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
          aspectRatio: '16:9'
        },
        scenes: [],
        characters: [],
        metadata: { version: '1.0.0', lastModified: new Date(), totalClips: 0, totalDuration: 0, totalCost: 0 },
        permissions: { owner: user?.id || 'anonymous', collaborators: [], roles: [] },
        budget: { projectId: '', softCap: 100, hardCap: 500, currentSpend: 0, currency: 'USD', alerts: [] }
      }
      createProject(newProject)
      setCurrentProject(newProject)
      if (isAuthenticated && user?.id) {
        try {
          const { saveProject } = await import('@/lib/db')
          await saveProject(newProject, user.id)
        } catch (error) { console.error('Error saving project:', error) }
      }
      setIsCreating(false)
    } catch (error) {
      console.error('Error in createProjectFromIdea:', error)
      setIsCreating(false)
    }
  }

  const handleCreateFromIdea = async () => {
    if (!idea.trim() || isCreating) return
    if (!isAuthenticated || !user?.id) {
      localStorage.setItem('pendingIdea', idea)
      localStorage.setItem('pendingDontGenerateImages', dontGenerateImages.toString())
      localStorage.setItem('pendingImageModel', selectedImageModel)
      setPendingIdea(idea); setShowAuthModal(true); return
    }
    await createProjectFromIdea(idea)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-x-hidden selection:bg-brand-emerald selection:text-brand-obsidian">
      {/* Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-brand-emerald/5 blur-[140px] rounded-full rotate-12" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-brand-amber/5 blur-[140px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/[0.02]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <Logo size="md" />
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/pricing" className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors">
                Pricing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <CreditsBadge />
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-8 pt-12 pb-32">
        <div className="w-full max-w-5xl mx-auto">
          {/* Refined Copy Hook */}
          <div className="text-center mb-16 animate-fade-in">
            <h1 className="text-[clamp(3.5rem,9vw,7.5rem)] font-bold leading-[0.8] tracking-[-0.06em] mb-10 italic serif text-white">
              The Future of <br />
              <span className="not-italic text-brand-emerald tracking-[-0.08em]">Video Creation.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto font-medium tracking-tight leading-relaxed">
              Premium AI video production for professional creators. <br />
              Turn your ideas into high-quality visual assets in minutes.
            </p>
          </div>

          {/* Director's Console Area */}
          <div className="relative group max-w-4xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-emerald/10 to-transparent rounded-[3rem] blur-2xl opacity-20 group-focus-within:opacity-40 transition duration-1000" />
            <div className="relative glass-panel bg-white/[0.01] border-white/[0.08] rounded-[2.5rem] p-2 md:p-3 overflow-hidden shadow-2xl">
              <div className="flex flex-col gap-2">
                
                {/* Text Area */}
                <div className="relative">
                  <Textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder={activePersona.placeholder}
                    className="w-full h-48 bg-transparent border-none text-white placeholder:text-white/5 
                             focus:ring-0 rounded-[2rem] p-8 text-2xl md:text-3xl font-medium tracking-tight leading-[1.1] 
                             resize-none transition-all duration-500"
                  />
                  <div className="absolute top-8 right-8 pointer-events-none opacity-10">
                    <Command className="w-6 h-6" />
                  </div>
                </div>

                {/* Persona Selector - Integrated */}
                <div className="px-4 py-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PERSONAS.map((persona) => {
                      const Icon = persona.icon
                      const isActive = activePersona.id === persona.id
                      return (
                        <button
                          key={persona.id}
                          onClick={() => setActivePersona(persona)}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-500 border ${
                            isActive 
                              ? 'bg-white/[0.05] border-brand-emerald/30 shadow-lg shadow-brand-emerald/5' 
                              : 'bg-white/[0.01] border-white/[0.02] hover:bg-white/[0.03] hover:border-white/05'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors duration-500 ${
                            isActive ? 'bg-brand-emerald text-brand-obsidian' : 'bg-white/5 text-white/20'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[10px] font-bold tracking-tight uppercase transition-colors duration-500 ${isActive ? 'text-white' : 'text-white/30'}`}>
                            {persona.title}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="flex flex-col md:flex-row items-center justify-between p-4 gap-4 bg-white/[0.02] rounded-[1.8rem] border border-white/[0.04]">
                  <div className="flex flex-wrap items-center gap-6 px-6">
                    <div className="flex items-center gap-3 group/cb cursor-pointer">
                      <Checkbox
                        id="text-only"
                        checked={dontGenerateImages}
                        onChange={(e) => setDontGenerateImages(e.target.checked)}
                        className="w-5 h-5 rounded-full border-white/10 data-[state=checked]:bg-brand-emerald"
                      />
                      <label htmlFor="text-only" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 cursor-pointer group-hover/cb:text-white/40 transition-colors">
                        Script Only (No Images)
                      </label>
                    </div>
                    
                    <div className="h-4 w-[1px] bg-white/5" />
                    
                    {/* Model Selector */}
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/10">Engine:</span>
                      <div className="flex items-center gap-2 p-1 bg-white/[0.02] rounded-full border border-white/[0.05]">
                        {[
                          { id: 'flux-2-pro', label: 'Premium' },
                          { id: 'nano-banana', label: 'Fast' },
                          { id: 'reeve', label: 'Artistic' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedImageModel(m.id as any)}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${
                              selectedImageModel === m.id 
                                ? 'bg-white text-black shadow-lg shadow-white/5' 
                                : 'text-white/20 hover:text-white/40'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
            
                  <Button
                    onClick={handleCreateFromIdea}
                    disabled={!idea.trim() || isCreating}
                    className="w-full md:w-auto h-16 px-12 rounded-[1.4rem] bg-white text-black hover:bg-brand-emerald hover:text-white transition-all duration-700 flex items-center justify-center gap-5 group/btn overflow-hidden relative"
                  >
                    {isCreating ? (
                      <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-[15px] font-black uppercase tracking-[0.1em]">Initialize Production</span>
                        <ArrowRight className="w-5 h-5 transition-transform duration-700 group-hover/btn:translate-x-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-16 px-8 border-t border-white/[0.02]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-4 opacity-10">
            <div className="w-2 h-2 rounded-full bg-brand-emerald" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Version 2.6.0</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/10">
            Professional AI video production platform
          </div>
          <div className="opacity-10">
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">geniferAI © 2026</span>
        </div>
      </div>
      </footer>
    </div>
  )
}
