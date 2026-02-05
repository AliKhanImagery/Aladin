'use client'

import { useAppStore } from '@/lib/store'
import { useRef, useState, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { VideoTrack } from './VideoTrack'
import { AudioTrack } from './AudioTrack'
import { AudioTrack as AudioTrackType, AudioClip, Clip } from '@/types'
import { cn } from '@/lib/utils'

export function StudioLayout() {
  const { 
    currentProject, 
    addAudioTrack, 
    updateAudioTrack, 
    addAudioClip, 
    selectedClip, 
    setSelectedClip 
  } = useAppStore()
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  
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
      // Placeholder for opening the Audio Generation Drawer
      console.log('Open audio drawer for track', trackId, 'at time', time)
      // For testing, let's add a dummy clip
      /*
      const newClip: AudioClip = {
          id: crypto.randomUUID(),
          trackId,
          name: 'Generated Audio',
          assetUrl: '',
          startTime: time,
          duration: 5,
          offset: 0,
          volume: 1
      }
      addAudioClip(trackId, newClip)
      */
  }

  const handleUpdateTrack = (trackId: string, updates: Partial<AudioTrackType>) => {
      updateAudioTrack(trackId, updates)
  }

  // Determine current video clip based on currentTime
  const currentVideoClip = useMemo(() => {
      let time = 0
      for (const clip of videoClips) {
          if (currentTime >= time && currentTime < time + clip.duration) {
              return clip
          }
          time += clip.duration
      }
      return null
  }, [videoClips, currentTime])

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#0C0C0C] rounded-xl overflow-hidden border border-[#3AAFA9]/20">
      {/* Theater Section (Top) */}
      <div className="flex-1 flex min-h-0 bg-[#0C0C0C]">
        {/* Main Preview Area */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          <div className="aspect-video w-full max-h-full bg-black rounded-lg border border-[#3AAFA9]/10 relative overflow-hidden shadow-2xl">
             {/* Video Player Placeholder */}
             {currentVideoClip?.generatedVideo ? (
                 <video 
                    src={currentVideoClip.generatedVideo}
                    className="w-full h-full object-contain"
                    // controls={false}
                    // This is a simplified preview, normally we'd sync this with currentTime
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
             <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="text-xs font-mono text-white">
                    {new Date(currentTime * 1000).toISOString().substr(11, 8)} 
                    <span className="text-gray-400"> / {new Date(totalDuration * 1000).toISOString().substr(11, 8)}</span>
                </span>
             </div>
          </div>
        </div>

        {/* Inspector / Asset Browser (Right Side) */}
        <div className="w-80 bg-[#1E1F22] border-l border-[#3AAFA9]/20 flex flex-col hidden lg:flex">
           <div className="p-4 border-b border-[#3AAFA9]/10 flex items-center justify-between">
               <h3 className="text-sm font-semibold text-white">Inspector</h3>
               <Settings className="w-4 h-4 text-gray-400" />
           </div>
           
           <div className="flex-1 p-4 overflow-y-auto">
               {selectedClip ? (
                   <div className="space-y-4">
                       <div>
                           <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Clip Name</label>
                           <p className="text-sm text-white mt-1">{selectedClip.name}</p>
                       </div>
                       <div>
                           <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Prompt</label>
                           <p className="text-xs text-gray-300 mt-1 line-clamp-4 italic">
                               "{selectedClip.videoPrompt || selectedClip.imagePrompt}"
                           </p>
                       </div>
                       {/* Add more properties here */}
                   </div>
               ) : (
                   <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                       Select a clip to view properties
                   </div>
               )}
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
      </div>

      {/* Timeline Grid (Bottom) */}
      <div className="h-[400px] bg-[#0C0C0C] border-t border-[#3AAFA9]/20 overflow-hidden flex flex-col relative">
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
                      selectedClipId={selectedClip?.id}
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
                    onClipClick={(clip) => console.log('Audio clip clicked', clip)}
                    selectedClipId="" // Audio clip selection not yet in store
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
    </div>
  )
}
