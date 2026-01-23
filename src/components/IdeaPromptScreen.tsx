'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Play, Briefcase, Zap, Film, Layout, MousePointer2, Command, ArrowRight } from 'lucide-react'
import { Project } from '@/types'
import UserMenu from './UserMenu'
import CreditsBadge from './CreditsBadge'

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

const IMAGE_MODELS = [
  { id: 'flux-2-pro', label: 'Premium', engine: 'FLUX.2 Pro' },
  { id: 'nano-banana', label: 'Fast', engine: 'Nano Banana' },
  { id: 'reeve', label: 'Artistic', engine: 'Reeve' }
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
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center transition-transform duration-700 group-hover:rotate-[360deg]">
                <Play className="w-4 h-4 text-black fill-current ml-0.5" />
              </div>
              <span className="text-xl font-bold tracking-[-0.04em] uppercase">Flowboard</span>
            </div>
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
                <div className="relative">
            <Textarea
              value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder={activePersona.placeholder}
                    className="w-full h-64 bg-transparent border-none text-white placeholder:text-white/5 
                             focus:ring-0 rounded-[2rem] p-10 text-2xl md:text-3xl font-medium tracking-tight leading-[1.1] 
                             resize-none transition-all duration-500"
                  />
                  <div className="absolute top-10 right-10 pointer-events-none opacity-10">
                    <Command className="w-6 h-6" />
                  </div>
                </div>

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
                        Script Only
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

                    <div className="h-4 w-[1px] bg-white/5" />
                    <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-emerald/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                      System Ready
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
                        <span className="text-[15px] font-black uppercase tracking-[0.1em]">Generate Project</span>
                        <ArrowRight className="w-5 h-5 transition-transform duration-700 group-hover/btn:translate-x-2" />
                      </>
                )}
              </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Persona Selector Hook */}
        <div className="w-full max-w-7xl mx-auto mt-32">
          <div className="flex items-center gap-6 mb-16 px-4">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10 whitespace-nowrap">Choose your use case</span>
            <div className="h-[1px] w-full bg-white/[0.03]" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PERSONAS.map((persona) => {
              const Icon = persona.icon
              const isActive = activePersona.id === persona.id
              return (
                <button
                  key={persona.id}
                  onClick={() => setActivePersona(persona)}
                  className={`relative p-10 rounded-[2.5rem] text-left transition-all duration-1000 group ${
                    isActive 
                      ? 'bg-white/[0.03] border-white/[0.1] shadow-2xl scale-[1.02]' 
                      : 'bg-transparent border-transparent hover:bg-white/[0.01]'
                  } border`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all duration-700 ${
                    isActive ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'bg-white/5 text-white/10 group-hover:text-white/20'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className={`text-xl font-bold tracking-tight mb-3 transition-colors duration-700 ${isActive ? 'text-white' : 'text-white/20'}`}>
                    {persona.title}
                  </h3>
                  <p className={`text-sm font-medium leading-relaxed transition-colors duration-1000 ${isActive ? 'text-white/40' : 'text-white/10'}`}>
                    {persona.hook}
                  </p>
                  
                  {isActive && (
                    <div className="absolute top-10 right-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    </div>
                  )}
                </button>
              )
            })}
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
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Flowboard © 2026</span>
        </div>
      </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;700;900&display=swap');
        .serif { font-family: 'Playfair Display', serif; }
        body { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  )
}
