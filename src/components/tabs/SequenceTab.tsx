'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Plus, Play, Edit, Lock, Unlock, Loader2, Trash2, Maximize2, Clock } from 'lucide-react'
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
          <h2 className="text-3xl font-bold text-white mb-2">Storyboard Sequence</h2>
          <p className="text-gray-400">
            Organize your story into scenes with individual clips
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
        <div className="text-center py-16 bg-[#1E1F22] rounded-2xl border border-[#3AAFA9]/20">
          <div className="w-16 h-16 bg-[#0C0C0C] rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-[#00FFF0]" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Scenes Yet</h3>
          <p className="text-gray-400 mb-6">
            Start by adding your first scene to build your storyboard
          </p>
          <Button
            onClick={handleAddScene}
            className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-6 py-2 rounded-xl"
          >
            Create First Scene
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {currentProject.scenes.map((scene, index) => (
            <div 
              key={scene.id} 
              className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20 animate-in fade-in slide-in-from-left-4"
              style={{
                animationDelay: `${index * 150}ms`,
                animationDuration: '500ms',
                animationFillMode: 'both'
              }}
            >
              {/* Scene Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[#00FFF0] rounded-full flex items-center justify-center text-black font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{scene.name}</h3>
                    <p className="text-sm text-gray-400">{scene.type} • {scene.duration}s</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                  >
                    {scene.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  {!isGeneratingStory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteScene(scene.id, scene.name)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Scene Description */}
              {scene.description && (
                <p className="text-gray-300 mb-4">{scene.description}</p>
              )}

              {/* Clips */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-white">Clips</h4>
                  {!isGeneratingStory && (
                    <Button
                      onClick={() => handleAddClip(scene.id)}
                      variant="outline"
                      size="sm"
                      className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Clip
                    </Button>
                  )}
                </div>

                {scene.clips.length === 0 ? (
                  <div className="text-center py-8 bg-[#0C0C0C] rounded-xl">
                    {isGeneratingStory ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 text-[#00FFF0] animate-spin" />
                        <p className="text-gray-400 text-sm">Generating clips...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-500 mb-4">No clips in this scene yet</p>
                        <Button
                          onClick={() => handleAddClip(scene.id)}
                          variant="outline"
                          size="sm"
                          className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black"
                        >
                          Add First Clip
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scene.clips.map((clip, clipIndex) => (
                      <div
                        key={clip.id}
                        className="bg-[#0C0C0C] rounded-xl p-4 border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-all animate-in fade-in slide-in-from-bottom-4 relative group"
                        style={{
                          animationDelay: `${clipIndex * 80}ms`,
                          animationDuration: '400ms',
                          animationFillMode: 'both'
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 
                            className="font-medium text-white cursor-pointer flex-1"
                            onClick={() => handleEditClip(clip)}
                          >
                            {clip.name}
                          </h5>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {clip.locked && <Lock className="w-3 h-3 text-yellow-400" />}
                              <span className="text-xs text-gray-400">{clip.duration}s</span>
                            </div>
                            {!isGeneratingStory && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteClip(clip.id, clip.name, scene.id)
                                }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Generation Status Chip */}
                        {clipGeneratingStatus[clip.id] && (
                          <div className="mb-2 flex items-center gap-1 px-2 py-0.5 bg-[#00FFF0]/10 border border-[#00FFF0]/30 rounded-full w-fit">
                            <Clock className="w-2.5 h-2.5 text-[#00FFF0]" />
                            <span className="text-[10px] text-[#00FFF0] font-medium">
                              Generating {clipGeneratingStatus[clip.id]}
                            </span>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <div 
                            className="h-20 bg-[#1E1F22] rounded-lg flex items-center justify-center cursor-pointer relative group"
                            onClick={() => handleEditClip(clip)}
                          >
                            {clip.generatedVideo ? (
                              <>
                                <img 
                                  src={clip.generatedImage || clip.generatedVideo} 
                                  alt={clip.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditClip(clip)
                                  }}
                                  className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 rounded-full border border-[#00FFF0]/50 backdrop-blur-sm"
                                  aria-label="Play video"
                                >
                                  <Play className="w-5 h-5 text-[#00FFF0]" />
                                </Button>
                              </>
                            ) : clip.generatedImage ? (
                              <>
                                <img 
                                  src={clip.generatedImage} 
                                  alt={clip.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setModalImageUrl(clip.generatedImage || null)
                                    setIsImageModalOpen(true)
                                  }}
                                  className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 rounded-full border border-[#00FFF0]/50 backdrop-blur-sm"
                                  aria-label="Expand image preview"
                                >
                                  <Maximize2 className="w-5 h-5 text-[#00FFF0]" />
                                </Button>
                              </>
                            ) : (
                              <div className="text-center text-gray-500">
                                <Play className="w-6 h-6 mx-auto mb-1" />
                                <p className="text-xs">Preview Pending</p>
                              </div>
                            )}
                          </div>
                          
                          <div 
                            className="text-xs text-gray-400 cursor-pointer"
                            onClick={() => handleEditClip(clip)}
                          >
                            <p className="truncate">{clip.imagePrompt || 'No prompt'}</p>
                            <p className="text-[#FFC44D]">${clip.costEstimate.toFixed(2)}</p>
                          </div>
                          
                          <Button
                            size="sm"
                            className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-medium"
                            onClick={() => handleEditClip(clip)}
                          >
                            {clip.status === 'completed' ? 'Regenerate' : 'Generate'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
