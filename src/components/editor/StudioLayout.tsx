'use client'

import { useAppStore } from '@/lib/store'
import { useRef, useState, useMemo, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Plus, Settings, Info, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { VideoTrack } from './VideoTrack'
import { AudioTrack } from './AudioTrack'
import { AudioTrack as AudioTrackType, AudioClip, Clip } from '@/types'
import { cn } from '@/lib/utils'
import { AudioClipInspectorDrawer } from '@/components/drawers/AudioClipInspectorDrawer'
import ClipDetailDrawer from '@/components/ClipDetailDrawer'
import ExportModal from '@/components/ExportModal'
import toast from 'react-hot-toast'

const REORDER_TOAST = 'Project structure updated. Storyboard and timeline are in sync.'

export function StudioLayout() {
  const { 
    currentProject, 
    addAudioTrack, 
    updateAudioTrack, 
    addAudioClip, 
    updateAudioClip,
    selectedClip, 
    setSelectedClip,
    setAudioDrawerOpen,
    setDrawerOpen,
    reorderClips
  } = useAppStore()
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  // Removed local isInspectorOpen state
  const [selectedAudioClip, setSelectedAudioClip] = useState<AudioClip | null>(null)
  const [isAudioInspectorOpen, setIsAudioInspectorOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Use a ref for the timeline container to sync scrolling
  const timelineRef = useRef<HTMLDivElement>(null)

  // Derive video clips from scenes
  const videoClips = useMemo(() => {
    if (!currentProject) return []
    return [...currentProject.scenes]
      .sort((a, b) => a.order - b.order)
      .flatMap(scene => [...scene.clips].sort((a, b) => a.order - b.order))
  }, [currentProject])

  const totalDuration = videoClips.reduce((acc, clip) => acc + clip.duration, 0)

  const handleTimelineReorder = (fromFlatIndex: number, toFlatIndex: number) => {
    if (fromFlatIndex === toFlatIndex || !currentProject) return
    const fromClip = videoClips[fromFlatIndex]
    const toClip = videoClips[toFlatIndex]
    if (!fromClip || !toClip || fromClip.sceneId !== toClip.sceneId) return
    const sceneId = fromClip.sceneId
    const fromIndexInScene = videoClips.slice(0, fromFlatIndex).filter(c => c.sceneId === sceneId).length
    let toIndexInScene = videoClips.slice(0, toFlatIndex).filter(c => c.sceneId === sceneId).length
    if (fromIndexInScene < toIndexInScene) toIndexInScene -= 1
    reorderClips(sceneId, fromIndexInScene, toIndexInScene)
    toast.success(REORDER_TOAST, { id: 'reorder-structure', duration: 2500 })
  }

  // Determine current video clip based on currentTime
  const currentVideoClip = useMemo(() => {
      let time = 0
      for (const clip of videoClips) {
          if (currentTime >= time && currentTime < time + clip.duration) {
              const localTime = currentTime - time
              // Return clip with local time offset
              return { ...clip, localTime }
          }
          time += clip.duration
      }
      return null
  }, [videoClips, currentTime])
  
  // Playback Loop
  useEffect(() => {
    let animationFrameId: number
    let lastTime = performance.now()
    const audioElements: HTMLAudioElement[] = []

    // Helper to sync audio
    const syncAudio = (time: number, playing: boolean) => {
        if (!currentProject?.timeline?.audioTracks) return

        currentProject.timeline.audioTracks.forEach(track => {
            track.clips.forEach(clip => {
                // Find or create audio element
                let audio = document.getElementById(`audio-${clip.id}`) as HTMLAudioElement
                
                if (!audio) {
                    audio = document.createElement('audio')
                    audio.id = `audio-${clip.id}`
                    audio.src = clip.assetUrl
                    audio.volume = (clip.volume ?? 1) * (track.volume ?? 1)
                    audio.muted = track.muted
                    document.body.appendChild(audio)
                    audioElements.push(audio)
                }

                // Calculate clip local time
                const clipStart = clip.startTime
                const clipEnd = clip.startTime + clip.duration
                
                if (time >= clipStart && time < clipEnd) {
                    const localTime = time - clipStart + (clip.offset || 0)
                    
                    // If audio is not playing or drifted significantly, sync it
                    if (Math.abs(audio.currentTime - localTime) > 0.3) {
                        audio.currentTime = localTime
                    }
                    
                    if (playing && audio.paused) {
                        audio.play().catch(() => {})
                    } else if (!playing && !audio.paused) {
                        audio.pause()
                    }
                } else {
                    // Outside clip range
                    if (!audio.paused) {
                        audio.pause()
                        audio.currentTime = 0
                    }
                }
            })
        })
    }

    const animate = (time: number) => {
      if (!isPlaying) {
        syncAudio(currentTime, false)
        return
      }

      const deltaTime = (time - lastTime) / 1000 // Convert to seconds
      lastTime = time

      setCurrentTime(prev => {
        const nextTime = prev + deltaTime
        
        // Sync audio for the next frame
        syncAudio(nextTime, true)

        // Loop or stop at end? Let's stop at end for now.
        if (nextTime >= totalDuration) {
          setIsPlaying(false)
          syncAudio(0, false) // Reset audio
          return 0 // Reset or stay at end? Let's reset.
        }
        return nextTime
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    if (isPlaying) {
      lastTime = performance.now()
      animationFrameId = requestAnimationFrame(animate)
    } else {
      // Ensure audio is paused if not playing
      syncAudio(currentTime, false)
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      // Cleanup audio elements
      audioElements.forEach(el => {
        if (!el.paused) el.pause()
        el.remove()
      })
      // Also cleanup any we missed (created in syncAudio)
      if (currentProject?.timeline?.audioTracks) {
          currentProject.timeline.audioTracks.forEach(track => {
              track.clips.forEach(clip => {
                  const el = document.getElementById(`audio-${clip.id}`)
                  if (el) el.remove()
              })
          })
      }
    }
  }, [isPlaying, totalDuration, currentProject?.timeline?.audioTracks])

  if (!currentProject) return null

  const handleAddTrack = () => {
     const trackCount = currentProject.timeline?.audioTracks?.length || 0
     const newTrack: AudioTrackType = {
        id: crypto.randomUUID(),
        name: `Audio ${trackCount + 1}`,
        type: 'bg_music',
        clips: [],
        volume: 1,
        muted: false,
        locked: false
     }
     addAudioTrack(newTrack)
  }

  const handleAddAudioClip = (trackId: string, time: number) => {
      // Open the drawer with the correct context
      setAudioDrawerOpen(true, trackId, time)
  }

  const handleUpdateTrack = (trackId: string, updates: Partial<AudioTrackType>) => {
      updateAudioTrack(trackId, updates)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-[#0C0C0C] overflow-hidden">
      {/* Theater Section (Top) */}
      {/* Flexible height: takes available space, but has max height on desktop to ensure timeline visibility */}
      <div className="flex-1 flex min-h-0 bg-[#0C0C0C] lg:max-h-[60vh] relative">
        {/* Main Preview Area */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          <div className="aspect-video w-full max-h-full bg-black rounded-lg border border-[#3AAFA9]/10 relative overflow-hidden shadow-2xl">
             {/* Video Player Placeholder */}
             {currentVideoClip?.generatedVideo ? (
                 <video
                    src={currentVideoClip.generatedVideo}
                    preload="auto"
                    playsInline
                    className="w-full h-full object-contain"
                    // Sync video time with timeline time
                    ref={el => {
                        if (el && Math.abs(el.currentTime - (currentVideoClip.localTime || 0)) > 0.5) {
                            el.currentTime = currentVideoClip.localTime || 0
                        }
                        if (el && isPlaying && el.paused) {
                            el.play().catch(() => {})
                        } else if (el && !isPlaying && !el.paused) {
                            el.pause()
                        }
                    }}
                    muted={false} // Enable audio from video? Maybe mute if we have separate audio tracks later.
                 />
             ) : currentVideoClip?.generatedImage ? (
                 <img 
                    src={currentVideoClip.generatedImage}
                    className="w-full h-full object-contain"
                    alt="Preview"
                 />
             ) : (
                 <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-[#1E1F22]">
                   <span className="flex items-center gap-2">
                     <Play className="w-8 h-8 opacity-50" />
                     Preview Not Available
                   </span>
                 </div>
             )}
             
             {/* Overlay Info */}
             <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-10">
                <span className="text-xs font-mono text-white">
                    {new Date(currentTime * 1000).toISOString().substr(11, 8)} 
                    <span className="text-gray-400"> / {new Date(totalDuration * 1000).toISOString().substr(11, 8)}</span>
                </span>
             </div>
          </div>
        </div>
      </div>

      {/* Timeline Controls Bar */}
      <div className="h-12 bg-[#1E1F22] border-t border-[#3AAFA9]/20 flex items-center justify-between px-4 shrink-0 z-20 relative">
         <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => setCurrentTime(0)}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-[#00FFF0] hover:text-[#00FFF0]/80" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <SkipForward className="w-4 h-4" />
            </Button>
         </div>
         
         <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:text-white gap-2"
                onClick={() => setIsExportModalOpen(true)}
            >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
            </Button>

            <div className="flex items-center gap-2 w-48">
                <ZoomOut className="w-4 h-4 text-gray-400" />
                <Slider 
                value={[zoomLevel]} 
                min={0.5} 
                max={2} 
                step={0.1} 
                onValueChange={(vals) => setZoomLevel(vals[0])}
                className="flex-1"
                />
                <ZoomIn className="w-4 h-4 text-gray-400" />
            </div>

            <Button 
                variant="ghost" 
                size="icon" 
                className={cn("text-gray-400 hover:text-white")} // simplified class
                onClick={() => {
                    if (selectedClip) {
                        setDrawerOpen(true) // Use store action
                    }
                }}
                disabled={!selectedClip}
                title="Clip Inspector"
            >
                <Info className="w-4 h-4" />
            </Button>
         </div>
      </div>

      {/* Timeline Grid (Bottom) */}
      {/* Fixed height to prevent wasted space, allowing preview to maximize */}
      <div className="h-[320px] shrink-0 bg-[#0C0C0C] border-t border-[#3AAFA9]/20 overflow-hidden flex flex-col relative">
         {/* Time Ruler */}
         <div className="h-8 bg-[#1E1F22] border-b border-[#3AAFA9]/10 w-full relative shrink-0">
             {/* Ruler ticks would go here */}
         </div>

         {/* Tracks Container */}
         <div className="flex-1 overflow-y-auto overflow-x-auto p-2 space-y-2 custom-scrollbar relative">
            {/* Playhead Line */}
            <div 
                className="absolute top-0 bottom-0 w-[2px] bg-[#FF0000] z-50 pointer-events-none"
                style={{ left: `${currentTime * 40 * zoomLevel + 138}px` }} // 128px header + 10px padding
            />

            {/* Video Track */}
            <div className="h-28 bg-[#1E1F22]/50 rounded-lg border border-[#3AAFA9]/10 relative flex shrink-0">
               <div className="w-32 bg-[#1E1F22] border-r border-[#3AAFA9]/10 z-30 flex items-center px-3 shrink-0">
                  <span className="text-xs text-gray-400 font-medium">Video</span>
               </div>
               {/* Clips Area */}
               <div className="flex-1 relative overflow-hidden bg-[#0C0C0C]/30">
                   <VideoTrack 
                      clips={videoClips} 
                      zoomLevel={zoomLevel} 
                      onClipClick={(clip) => setSelectedClip(clip)}
                      onClipContextMenu={(clip) => {
                          setSelectedClip(clip)
                          setDrawerOpen(true) // Open omni drawer
                      }}
                      onClipDubbing={(clip) => {
                          setSelectedClip(clip)
                          setDrawerOpen(true, 'dub') // Open directly in dub mode
                      }}
                      selectedClipId={selectedClip?.id}
                      onReorder={handleTimelineReorder}
                   />
               </div>
            </div>
            
            {/* Audio Tracks */}
            {currentProject.timeline?.audioTracks?.map((track) => (
                <AudioTrack 
                    key={track.id} 
                    track={track}
                    pixelsPerSecond={40 * zoomLevel}
                    onAddClip={(time) => handleAddAudioClip(track.id, time)}
                    onClipClick={(clip) => setSelectedAudioClip(clip)}
                    onClipContextMenu={(clip) => {
                      setSelectedAudioClip(clip)
                      setIsAudioInspectorOpen(true)
                    }}
                    onClipMove={(clip, newStartTime) => updateAudioClip(clip.trackId, clip.id, { startTime: Math.max(0, newStartTime) })}
                    selectedClipId={selectedAudioClip?.id ?? ''}
                    onUpdateTrack={(updates) => handleUpdateTrack(track.id, updates)}
                />
            ))}
            
            {/* Add Track Button */}
            <div 
                className="h-10 flex items-center justify-center border-2 border-dashed border-[#3AAFA9]/10 rounded-lg hover:border-[#3AAFA9]/30 cursor-pointer transition-colors text-xs text-gray-500 hover:text-[#3AAFA9]"
                onClick={handleAddTrack}
            >
               <Plus className="w-4 h-4 mr-2" />
               Add Audio Track
            </div>
         </div>
      </div>

      <ClipDetailDrawer />
      <AudioClipInspectorDrawer 
        isOpen={isAudioInspectorOpen} 
        onClose={() => { setIsAudioInspectorOpen(false); setSelectedAudioClip(null) }} 
        clip={selectedAudioClip}
      />
      
      {currentProject && (
        <ExportModal 
          isOpen={isExportModalOpen} 
          onClose={() => setIsExportModalOpen(false)} 
          project={currentProject} 
          clips={videoClips} 
        />
      )}
    </div>
  )
}
