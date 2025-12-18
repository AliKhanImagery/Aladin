'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Lightbulb, Grid3X3, Clock, Edit2 } from 'lucide-react'
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

  // Helper function to truncate project name to 3 words
  const truncateProjectName = (name: string) => {
    const words = name.split(' ')
    if (words.length <= 3) return name
    return words.slice(0, 3).join(' ') + '...'
  }

  const tabs = [
    { id: 'idea', label: 'Idea', icon: Lightbulb },
    { id: 'sequence', label: 'Sequence', icon: Grid3X3 },
    { id: 'timeline', label: 'Timeline & SFX', icon: Clock },
  ]

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#08080C] via-[#0C0C14] to-[#08080C] text-white flex items-center justify-center relative">
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
        <div className="text-center relative z-10">
          <h2 className="text-2xl font-bold mb-4">No Project Selected</h2>
          <p className="text-gray-400 mb-6">Please select a project to continue</p>
          <Button
            onClick={() => setProjectManagerOpen(true)}
            className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl shadow-[0_0_15px_rgba(0,255,240,0.5)] hover:shadow-[0_0_25px_rgba(0,255,240,0.8)] transition-all duration-300"
          >
            Open Project Manager
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08080C] via-[#0C0C14] to-[#08080C] text-white relative overflow-x-hidden">
      {/* Subtle neon overlay - behind everything */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none z-0" />
      
      {/* Unified Header Bar - Fixed at top to prevent content above */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-[#08080C] backdrop-blur-md border-b border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left side: UserMenu and Project Title */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <UserMenu user={user} />
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-lg font-semibold text-white truncate">
                  {currentProject.name ? truncateProjectName(currentProject.name) : 'Untitled Project'}
                </h1>
                <button
                  onClick={() => setIsEditNameModalOpen(true)}
                  className="p-1.5 hover:bg-[#1A1A24]/50 rounded-lg transition-colors hover:shadow-[0_0_5px_rgba(0,255,240,0.3)] flex-shrink-0"
                  title="Rename project"
                >
                  <Edit2 className="w-4 h-4 text-gray-400 hover:text-[#00FFF0]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-16 left-0 right-0 z-40 bg-[#08080C] backdrop-blur-md border-b border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 justify-center items-center h-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    isActive
                      ? 'border-[#00FFF0] text-[#00FFF0] shadow-[0_2px_10px_rgba(0,255,240,0.3)]'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-[#00FFF0]/50 hover:shadow-[0_2px_5px_rgba(0,255,240,0.2)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {activeTab === 'idea' && <IdeaTab />}
        {activeTab === 'sequence' && <SequenceTab />}
        {activeTab === 'timeline' && <TimelineTab />}
      </div>
      
      {/* Generation Status Indicator */}
      <GenerationStatusIndicator />
      
      {/* Clip Detail Drawer */}
      <ClipDetailDrawer />
      
      {/* Project Manager - Only show when explicitly opened */}
      {isProjectManagerOpen && <ProjectManager />}
      
      {/* Edit Project Name Modal */}
      <EditProjectNameModal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        currentName={currentProject.name}
      />
    </div>
  )
}
