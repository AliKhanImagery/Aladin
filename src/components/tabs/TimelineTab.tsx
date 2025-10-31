'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download, Volume2, VolumeX, Settings } from 'lucide-react'

export default function TimelineTab() {
  const { currentProject } = useAppStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasLipsync, setHasLipsync] = useState(false)
  const [hasSFX, setHasSFX] = useState(false)

  if (!currentProject) return null

  // Get all clips from all scenes
  const allClips = currentProject.scenes.flatMap(scene => 
    scene.clips.map(clip => ({ ...clip, sceneName: scene.name }))
  )

  const totalDuration = allClips.reduce((total, clip) => total + clip.duration, 0)
  const totalCost = allClips.reduce((total, clip) => total + clip.actualCost, 0)

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Timeline & SFX</h2>
          <p className="text-gray-400">
            Review your final timeline and add audio effects
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Duration</p>
            <p className="text-lg font-semibold text-white">{totalDuration}s</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Cost</p>
            <p className="text-lg font-semibold text-[#FFC44D]">${totalCost.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Timeline Controls */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Timeline Controls</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-4 py-2 rounded-xl"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black px-4 py-2 rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Timeline Track */}
        <div className="bg-[#0C0C0C] rounded-xl p-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {allClips.length === 0 ? (
              <div className="text-center py-16 w-full">
                <div className="w-16 h-16 bg-[#1E1F22] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 text-[#00FFF0]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Clips Yet</h3>
                <p className="text-gray-400">
                  Generate some clips in the Sequence tab to see them here
                </p>
              </div>
            ) : (
              allClips.map((clip, index) => (
                <div
                  key={clip.id}
                  className="bg-[#1E1F22] rounded-lg p-3 min-w-[200px] border border-[#3AAFA9]/20 hover:border-[#00FFF0]/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white text-sm truncate">{clip.name}</h4>
                    <span className="text-xs text-gray-400">{clip.duration}s</span>
                  </div>
                  
                  <div className="h-16 bg-[#0C0C0C] rounded mb-2 flex items-center justify-center">
                    {clip.generatedVideo ? (
                      <video 
                        src={clip.generatedVideo}
                        className="w-full h-full object-cover rounded"
                        muted
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <Play className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs">Pending</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{clip.sceneName}</span>
                    <span className="text-[#FFC44D]">${clip.actualCost.toFixed(2)}</span>
                  </div>
                  
                  {/* SFX Controls */}
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`p-1 h-6 w-6 ${hasLipsync ? 'text-[#00FFF0]' : 'text-gray-400'}`}
                      onClick={() => setHasLipsync(!hasLipsync)}
                    >
                      <Volume2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`p-1 h-6 w-6 ${hasSFX ? 'text-[#00FFF0]' : 'text-gray-400'}`}
                      onClick={() => setHasSFX(!hasSFX)}
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Audio Settings */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#00FFF0]" />
            Lipsync Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Auto-detect speech</span>
              <Button
                size="sm"
                variant={hasLipsync ? "default" : "outline"}
                className={hasLipsync ? "bg-[#00FFF0] text-black" : "border-[#3AAFA9] text-[#3AAFA9]"}
                onClick={() => setHasLipsync(!hasLipsync)}
              >
                {hasLipsync ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              Automatically detect speech patterns and sync with video
            </div>
          </div>
        </div>

        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00FFF0]" />
            Sound Effects
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Background music</span>
              <Button
                size="sm"
                variant={hasSFX ? "default" : "outline"}
                className={hasSFX ? "bg-[#00FFF0] text-black" : "border-[#3AAFA9] text-[#3AAFA9]"}
                onClick={() => setHasSFX(!hasSFX)}
              >
                {hasSFX ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              Add ambient sounds and background music
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black p-4 h-auto flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            <span className="font-medium">FCPXML</span>
            <span className="text-xs text-gray-400">Final Cut Pro</span>
          </Button>
          
          <Button
            variant="outline"
            className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black p-4 h-auto flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            <span className="font-medium">AAF</span>
            <span className="text-xs text-gray-400">Premiere Pro</span>
          </Button>
          
          <Button
            variant="outline"
            className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black p-4 h-auto flex-col"
          >
            <Download className="w-6 h-6 mb-2" />
            <span className="font-medium">JSON</span>
            <span className="text-xs text-gray-400">Raw Data</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
