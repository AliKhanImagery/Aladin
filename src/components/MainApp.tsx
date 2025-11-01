'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Lightbulb, Grid3X3, Clock } from 'lucide-react'
import IdeaTab from './tabs/IdeaTab'
import SequenceTab from './tabs/SequenceTab'
import TimelineTab from './tabs/TimelineTab'
import ClipDetailDrawer from './ClipDetailDrawer'
import GenerationStatusIndicator from './GenerationStatusIndicator'
import UserMenu from './UserMenu'

export default function MainApp() {
  const { 
    activeTab, 
    setActiveTab, 
    currentProject, 
    setProjectManagerOpen,
    user
  } = useAppStore()

  const tabs = [
    { id: 'idea', label: 'Idea', icon: Lightbulb },
    { id: 'sequence', label: 'Sequence', icon: Grid3X3 },
    { id: 'timeline', label: 'Timeline & SFX', icon: Clock },
  ]

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Project Selected</h2>
          <p className="text-gray-400 mb-6">Please select a project to continue</p>
          <Button
            onClick={() => setProjectManagerOpen(true)}
            className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl"
          >
            Open Project Manager
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      {/* Top Navbar with Profile Icon on Left */}
      <div className="fixed top-4 left-4 z-50">
        <UserMenu user={user} />
      </div>

      {/* Center-Aligned Floating Navbar */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div className="bg-[#1E1F22]/95 backdrop-blur-md rounded-2xl border border-[#3AAFA9]/30 shadow-2xl">
          <div className="flex items-center justify-center px-6 py-3">
            {/* Project Info - Centered */}
            <div className="flex items-center gap-4 flex-1 justify-center">
              <h1 className="text-lg font-bold text-white truncate">
                {currentProject.name}
              </h1>
              {currentProject.description && (
                <span className="hidden md:inline text-sm text-gray-400 truncate max-w-xs">
                  {currentProject.description}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Spacer for Floating Navbar */}
      <div className="h-20"></div>

      {/* Tab Navigation */}
      <div className="sticky top-20 z-30 bg-[#0C0C0C]/95 backdrop-blur-sm border-b border-[#3AAFA9]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-[#00FFF0] text-[#00FFF0]'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'idea' && <IdeaTab />}
        {activeTab === 'sequence' && <SequenceTab />}
        {activeTab === 'timeline' && <TimelineTab />}
      </div>
      
      {/* Generation Status Indicator */}
      <GenerationStatusIndicator />
      
      {/* Clip Detail Drawer */}
      <ClipDetailDrawer />
    </div>
  )
}
