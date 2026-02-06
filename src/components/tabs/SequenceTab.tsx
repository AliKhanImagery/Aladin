'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Plus, Play, Edit, Lock, Unlock, Loader2, Trash2, Maximize2, Clock, Sparkles, ChevronRight } from 'lucide-react'
import ImageModal from '../ImageModal'
import { Scene, Clip } from '@/types'

export default function SequenceTab() {
  const { 
    currentProject, 
    addScene, 
    addClip, 
    deleteScene,
    deleteClip,
    setSelectedClip, 
    setDrawerOpen,
    isDrawerOpen,
    isGeneratingStory,
    generationProgress,
    clipGeneratingStatus
  } = useAppStore()

  const aspectRatioClass = (() => {
    const ratio = currentProject?.story?.aspectRatio || '16:9'
    switch (ratio) {
      case '9:16': return 'aspect-[9/16]'
      case '1:1': return 'aspect-square'
      default: return 'aspect-video'
    }
  })()

  const [isAddingScene, setIsAddingScene] = useState(false)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null)

  // Debug logging
  console.log('🎬 SequenceTab render:', {
    hasProject: !!currentProject,
    scenesCount: currentProject?.scenes?.length || 0,
    isGenerating: isGeneratingStory,
    scenes: currentProject?.scenes?.map(s => ({
      id: s.id,
      name: s.name,
      clipsCount: s.clips?.length || 0
    })) || []
  })

  if (!currentProject) return null

  const handleAddScene = () => {
    const newScene: Scene = {
      id: crypto.randomUUID(),
      storyId: currentProject.story.id,
      order: currentProject.scenes.length,
      name: `Scene ${currentProject.scenes.length + 1}`,
      description: '',
      type: 'establishing',
      purpose: '',
      duration: 10,
      style: {
        mood: '',
        lighting: '',
        colorPalette: '',
        cameraStyle: '',
        postProcessing: []
      },
      wardrobe: [],
      location: '',
      coverage: {
        sceneId: '',
        requiredShots: [],
        completedShots: [],
        coverage: 0
      },
      clips: [],
      status: 'draft',
      locked: false
    }
    
    addScene(newScene)
    setIsAddingScene(false)
  }

  const handleAddClip = (sceneId: string) => {
    const newClip: Clip = {
      id: crypto.randomUUID(),
      sceneId,
      order: 0,
      name: 'New Clip',
      imagePrompt: '',
      videoPrompt: '',
      duration: 5,
      quality: 'standard',
      cameraPreset: {
        id: 'default',
        name: 'Default',
        description: 'Standard framing',
        prompt: '',
        examples: []
      },
      framing: '',
      characters: [],
      klingElements: [],
      status: 'draft',
      costEstimate: 0,
      actualCost: 0,
      version: 1,
      history: [],
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRendered: new Date()
    }
    
    addClip(sceneId, newClip)
  }

  const handleEditClip = (clip: Clip) => {
    setSelectedClip(clip)
    setDrawerOpen(true)
  }

  const handleDeleteScene = (sceneId: string, sceneName: string) => {
    const scene = currentProject.scenes.find(s => s.id === sceneId)
    const clipsCount = scene?.clips?.length || 0
    
    const confirmed = window.confirm(
      `⚠️ Delete Scene "${sceneName}"?\n\n` +
      `This will permanently delete:\n` +
      `• The scene and all its data\n` +
      `• ${clipsCount} clip(s) in this scene\n\n` +
      `This action cannot be undone.`
    )
    
    if (confirmed) {
      deleteScene(sceneId)
    }
  }

  const handleDeleteClip = (clipId: string, clipName: string, sceneId: string) => {
    const confirmed = window.confirm(
      `⚠️ Delete Clip "${clipName}"?\n\n` +
      `This will permanently delete the clip and all its data.\n\n` +
      `This action cannot be undone.`
    )
    
    if (confirmed) {
      deleteClip(clipId)
      // Note: The store's deleteClip function will handle closing the drawer
      // if the deleted clip was the selected one
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Project Storyboard</h2>
          <p className="text-gray-400">
            Organize your storyboard into scenes and individual clips.
          </p>
        </div>
        <Button
          onClick={handleAddScene}
          className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Scene
        </Button>
      </div>

      {/* Scenes */}
      {currentProject.scenes.length === 0 && !isGeneratingStory ? (
        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Plus className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2 serif">The Stage is Empty</h3>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Your production begins with a single scene. Start building your narrative arc.
          </p>
          <Button
            onClick={handleAddScene}
            className="bg-brand-emerald hover:bg-brand-emerald/90 text-brand-obsidian font-bold px-8 py-6 rounded-2xl text-lg shadow-xl shadow-brand-emerald/20 transition-all hover:scale-105"
          >
            Create First Scene
          </Button>
        </div>
      ) : (
        <div className="space-y-0">
          {currentProject.scenes.map((scene, index) => (
            <div 
              key={scene.id} 
              className="group/scene-row flex flex-col md:flex-row gap-6 md:gap-8 py-10 border-b border-white/5 last:border-0"
            >
              {/* Sticky Rail (Left) - Compact */}
              <div className="md:w-48 lg:w-56 flex-shrink-0 md:sticky md:top-24 self-start space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black text-white/5 select-none leading-none -ml-0.5">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-brand-emerald uppercase tracking-[0.2em] mb-0.5">
                      {scene.type}
                    </span>
                    <span className="text-[9px] font-medium text-white/30 tabular-nums">
                      {scene.duration}s
                    </span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white/90 leading-tight mb-2">
                    {scene.name}
                  </h3>
                  
                  {scene.description && (
                    <p className="text-xs text-white/40 font-medium leading-relaxed line-clamp-3 hover:text-white/60 transition-colors cursor-default">
                      {scene.description}
                    </p>
                  )}
                </div>

                {/* Scene Controls (Rail) */}
                <div className="flex items-center gap-1 pt-2 opacity-0 group-hover/scene-row:opacity-100 transition-opacity duration-300">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/20 hover:text-white hover:bg-white/5 rounded-full">
                    {scene.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/20 hover:text-white hover:bg-white/5 rounded-full">
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  {!isGeneratingStory && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteScene(scene.id, scene.name)}
                      className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-full"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Visual Canvas (Right) - Massive Grid */}
              <div className="flex-1 min-w-0">
                <div className="space-y-6">
                  {/* ...Clips Grid Logic... */}
                  {scene.clips.length === 0 ? (
                    <div className={`${aspectRatioClass} w-full border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white/[0.01] hover:bg-white/[0.02] transition-colors cursor-pointer group/empty`} onClick={() => handleAddClip(scene.id)}>
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover/empty:scale-110 transition-transform duration-300">
                        <Plus className="w-6 h-6 text-white/20 group-hover/empty:text-brand-emerald" />
                      </div>
                      <p className="text-white/20 font-bold uppercase tracking-widest text-xs group-hover/empty:text-brand-emerald/60">Initialize First Shot</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {scene.clips.map((clip, clipIndex) => (
                        <div
                          key={clip.id}
                          className={`group relative ${aspectRatioClass} w-full bg-[#050505] rounded-3xl overflow-hidden border border-white/5 hover:border-brand-emerald/50 transition-all duration-500 shadow-2xl hover:shadow-brand-emerald/10 ring-1 ring-white/0 hover:ring-1 hover:ring-brand-emerald/20`}
                          style={{
                            animationDelay: `${clipIndex * 100}ms`,
                            animationFillMode: 'both'
                          }}
                        >
                          {/* Background Image Layer */}
                          <div className="absolute inset-0 z-0">
                            {clip.generatedImage || clip.generatedVideo ? (
                              <img 
                                src={clip.generatedImage || clip.generatedVideo} 
                                alt={clip.name}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] pattern-grid-lg">
                                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3 backdrop-blur-sm">
                                  <Sparkles className="w-5 h-5 text-white/20" />
                                </div>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Pending Visualization</p>
                              </div>
                            )}
                            
                            {/* Cinematic Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                          </div>

                          {/* Top HUD */}
                          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-start z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -translate-y-2 group-hover:translate-y-0">
                            <div className="flex gap-2">
                              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-[9px] font-black text-white/90 uppercase tracking-widest shadow-xl">
                                {clip.framing || 'Wide Shot'}
                              </div>
                              {clipGeneratingStatus[clip.id] && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-emerald/20 backdrop-blur-xl border border-brand-emerald/30">
                                  <Loader2 className="w-3 h-3 text-brand-emerald animate-spin" />
                                  <span className="text-[9px] font-bold text-brand-emerald uppercase tracking-wider">Rendering</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-xl">
                              <Clock className="w-3 h-3 text-white/60" />
                              <span className="text-[9px] font-bold text-white tabular-nums">{clip.duration}s</span>
                            </div>
                          </div>

                          {/* Center Action Button (Hover) */}
                          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                            <div className="pointer-events-auto transform scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 delay-75">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClip(clip);
                                }}
                                className="h-12 px-6 bg-white/10 hover:bg-brand-emerald backdrop-blur-md border border-white/20 hover:border-brand-emerald text-white hover:text-brand-obsidian rounded-full font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 group/btn transition-all shadow-xl"
                              >
                                {clip.status === 'completed' ? (
                                  <>
                                    <Edit className="w-3.5 h-3.5" />
                                    Director’s Suite
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Generate Shot
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Bottom Info Area */}
                          <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none">
                            <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 pointer-events-auto">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-lg font-bold text-white tracking-tight">{clip.name}</h5>
                                {clip.locked && <Lock className="w-3.5 h-3.5 text-brand-amber" />}
                              </div>
                              
                              <p className="text-xs text-white/60 font-medium leading-relaxed line-clamp-1 group-hover:line-clamp-2 hover:text-white/90 transition-all cursor-default">
                                {clip.imagePrompt || clip.description || 'No prompt defined for this shot.'}
                              </p>
                              
                              {/* Footer Actions */}
                              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                                <div className="flex items-center gap-4">
                                  {clip.generatedImage && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setModalImageUrl(clip.generatedImage || null);
                                        setIsImageModalOpen(true);
                                      }}
                                      className="text-[9px] font-bold text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                      Expand
                                    </button>
                                  )}
                                </div>
                                
                                {!isGeneratingStory && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClip(clip.id, clip.name, scene.id);
                                    }}
                                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add Clip Button (Inline) */}
                      {!isGeneratingStory && (
                        <div 
                          onClick={() => handleAddClip(scene.id)}
                          className={`${aspectRatioClass} w-full bg-white/[0.02] hover:bg-white/[0.04] rounded-3xl border border-white/5 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group/add`}
                        >
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover/add:bg-white/10 transition-colors">
                            <Plus className="w-5 h-5 text-white/30 group-hover/add:text-white" />
                          </div>
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover/add:text-white/50">Add Shot</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Image Modal */}
      <ImageModal
        imageUrl={modalImageUrl || ''}
        alt="Clip preview"
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false)
          setModalImageUrl(null)
        }}
      />
    </div>
  )
}
