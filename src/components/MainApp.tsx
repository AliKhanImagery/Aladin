'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Layout, Grid3X3, Clock, Edit2, Play, ChevronRight } from 'lucide-react'
import IdeaTab from './tabs/IdeaTab'
import SequenceTab from './tabs/SequenceTab'
import TimelineTab from './tabs/TimelineTab'
import ClipDetailDrawer from './ClipDetailDrawer'
import GenerationStatusIndicator from './GenerationStatusIndicator'
import UserMenu from './UserMenu'
import ProjectManager from './ProjectManager'
import EditProjectNameModal from './EditProjectNameModal'

export default function MainApp() {
  const { 
    activeTab, 
    setActiveTab, 
    currentProject, 
    setProjectManagerOpen,
    user,
    isProjectManagerOpen
  } = useAppStore()
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false)

  // Helper function to truncate project name
  const truncateProjectName = (name: string) => {
    const words = name.split(' ')
    if (words.length <= 4) return name
    return words.slice(0, 4).join(' ') + '...'
  }

  const tabs = [
    { id: 'idea', label: 'Idea', icon: Layout },
    { id: 'sequence', label: 'Storyboarding', icon: Grid3X3 },
    { id: 'timeline', label: 'Video Clips', icon: Clock },
  ]

  const hasGeneratedStory = currentProject?.scenes && currentProject.scenes.length > 0

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-brand-obsidian text-white flex items-center justify-center relative">
        <div className="text-center relative z-10">
          <h2 className="text-2xl font-bold mb-4">No Project Selected</h2>
          <p className="text-gray-400 mb-6">Please select a project to continue.</p>
          <Button
            onClick={() => setProjectManagerOpen(true)}
            className="btn-primary"
          >
            Open Project Manager
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-obsidian text-white relative overflow-x-hidden">
      {/* Header Bar */}
      <header className={`sticky top-0 left-0 right-0 z-50 glass-panel border-b border-white/5 ${!hasGeneratedStory ? 'border-b-0' : ''}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left side: Logo & Title */}
            <div className="flex items-center gap-6 flex-1 min-w-0">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
                <div className="w-8 h-8 bg-brand-emerald rounded-lg flex items-center justify-center glow-emerald">
                  <Play className="w-4 h-4 text-brand-obsidian fill-brand-obsidian" />
                </div>
                <span className="text-lg font-bold tracking-tight hidden md:block">Flowboard</span>
              </div>
              
              <div className="h-4 w-[1px] bg-white/10 hidden md:block" />
              
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-widest hidden sm:block">Active Project:</span>
                <div className="flex items-center gap-2 min-w-0 group">
                  <h1 className="text-sm font-semibold text-white truncate group-hover:text-brand-emerald transition-colors">
                  {currentProject.name ? truncateProjectName(currentProject.name) : 'Untitled Project'}
                </h1>
                <button
                  onClick={() => setIsEditNameModalOpen(true)}
                    className="p-1 hover:bg-white/5 rounded transition-colors"
                  title="Rename project"
                >
                    <Edit2 className="w-3 h-3 text-gray-500 group-hover:text-brand-emerald" />
                </button>
                </div>
              </div>
            </div>

            {/* Right side: UserMenu */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setProjectManagerOpen(true)}
                className="text-xs font-medium text-gray-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"
              >
                Switch Production
              </button>
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation - Only show after story has been generated */}
      {hasGeneratedStory && (
        <nav className="sticky top-16 left-0 right-0 z-40 glass-panel border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex space-x-1 justify-center items-center h-14">
              {tabs.map((tab, idx) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                
                return (
                  <div key={tab.id} className="flex items-center">
                  <button
                    onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                      isActive
                          ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/30'
                          : 'text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                    {idx < tabs.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-white/5 mx-2" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content Viewport */}
      <main className={`max-w-7xl mx-auto px-6 py-10 relative z-10 ${!hasGeneratedStory ? 'pt-4' : ''}`}>
        <div className="animate-fade-in">
        {activeTab === 'idea' && <IdeaTab />}
        {activeTab === 'sequence' && <SequenceTab />}
        {activeTab === 'timeline' && <TimelineTab />}
      </div>
      </main>
      
      {/* Overlays & Global Components */}
      <GenerationStatusIndicator />
      <ClipDetailDrawer />
      {isProjectManagerOpen && <ProjectManager />}
      
      <EditProjectNameModal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        currentName={currentProject.name}
      />
    </div>
  )
}
