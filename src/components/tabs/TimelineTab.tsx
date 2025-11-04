'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download, Volume2, VolumeX, Settings } from 'lucide-react'

export default function TimelineTab() {
  const { currentProject } = useAppStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [hasLipsync, setHasLipsync] = useState(false)
  const [hasSFX, setHasSFX] = useState(false)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  if (!currentProject) return null

  // Get all clips from all scenes
  const allClips = currentProject.scenes.flatMap(scene => 
    scene.clips.map(clip => ({ ...clip, sceneName: scene.name }))
  )

  const totalDuration = allClips.reduce((total, clip) => total + clip.duration, 0)
  const totalCost = allClips.reduce((total, clip) => total + clip.actualCost, 0)

  // Get clips with different states
  const clipsWithVideo = allClips.filter(clip => clip.generatedVideo)
  const clipsWithImage = allClips.filter(clip => clip.generatedImage && !clip.generatedVideo)
  const clipsWithScript = allClips.filter(clip => !clip.generatedImage && !clip.generatedVideo)

  // Get current clip based on index (works with all clips)
  const currentClip = allClips[currentClipIndex] || null
  const currentClipType = currentClip 
    ? (currentClip.generatedVideo ? 'video' : currentClip.generatedImage ? 'image' : 'script')
    : null

  // Auto-advance for non-video clips
  useEffect(() => {
    if (isPlaying && currentClipType !== 'video') {
      const timer = setTimeout(() => {
        if (currentClipIndex < allClips.length - 1) {
          setCurrentClipIndex(currentClipIndex + 1)
        } else {
          setIsPlaying(false)
          setCurrentClipIndex(0)
        }
      }, 3000) // Show each clip for 3 seconds

      return () => clearTimeout(timer)
    }
  }, [isPlaying, currentClipIndex, currentClipType, allClips.length])

  // Handle play/pause - works for all clip types
  const handlePlayPause = () => {
    // If current clip has video, play/pause it
    if (currentClipType === 'video' && videoRef.current && currentClip?.generatedVideo) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else {
        videoRef.current.play().catch(error => {
          console.error('Error playing video:', error)
          setIsPlaying(false)
        })
        setIsPlaying(true)
      }
    } else if (currentClipType !== 'video') {
      // For non-video clips (image or script), toggle play state (auto-advance handled by useEffect)
      setIsPlaying(!isPlaying)
    }
  }

  // Handle video end - move to next clip
  const handleVideoEnd = () => {
    if (currentClipIndex < allClips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1)
      setCurrentTime(0)
    } else {
      // Reached end of timeline
      setIsPlaying(false)
      setCurrentClipIndex(0)
      setCurrentTime(0)
    }
  }

  // Update current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  // Seek to specific time
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Calculate current time in timeline context
  const calculateTimelineTime = () => {
    let time = 0
    for (let i = 0; i < currentClipIndex; i++) {
      time += allClips[i]?.duration || 0
    }
    return time + currentTime
  }

  // Handle timeline scrubbing
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || allClips.length === 0) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    const percentage = Math.max(0, Math.min(1, clickX / width))
    const targetTime = percentage * totalDuration

    // Find which clip this time corresponds to
    let accumulatedTime = 0
    for (let i = 0; i < allClips.length; i++) {
      const clipDuration = allClips[i].duration || 0
      if (targetTime <= accumulatedTime + clipDuration) {
        setCurrentClipIndex(i)
        if (videoRef.current && allClips[i].generatedVideo) {
          videoRef.current.currentTime = targetTime - accumulatedTime
          setCurrentTime(targetTime - accumulatedTime)
        } else {
          setCurrentTime(0)
        }
        break
      }
      accumulatedTime += clipDuration
    }
  }

  // Sync video element with current clip
  useEffect(() => {
    if (videoRef.current && currentClip?.generatedVideo && currentClipType === 'video') {
      videoRef.current.src = currentClip.generatedVideo
      videoRef.current.load()
      
      if (isPlaying) {
        videoRef.current.play().catch(error => {
          console.error('Error playing video:', error)
          setIsPlaying(false)
        })
      } else {
        videoRef.current.pause()
      }
    } else if (videoRef.current) {
      // Clear video source if clip doesn't have video or switching away from video
      videoRef.current.src = ''
      videoRef.current.load()
      // Don't set isPlaying to false here - let it stay in play state for auto-advance
    }
  }, [currentClipIndex, currentClip, currentClipType, isPlaying])

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

      {/* Video Preview Window */}
      {allClips.length > 0 && (
        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-xl font-semibold text-white mb-4">Video Preview</h3>
          <div className="relative bg-[#0C0C0C] rounded-xl overflow-hidden min-h-[300px] max-h-[500px] flex items-center justify-center">
            {currentClip && (
              <>
                {/* Video State */}
                {currentClipType === 'video' && currentClip.generatedVideo ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    onEnded={handleVideoEnd}
                    onTimeUpdate={handleTimeUpdate}
                    muted={isMuted}
                    playsInline
                  />
                ) : currentClipType === 'image' && currentClip.generatedImage ? (
                  /* Image State */
                  <img
                    src={currentClip.generatedImage}
                    alt={currentClip.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  /* Script State - Show video prompt as script lines */
                  <div className="w-full h-full p-8 flex items-center justify-center overflow-y-auto">
                    <div className="max-w-3xl w-full">
                      <div className="bg-[#1E1F22] rounded-lg p-6 border border-[#3AAFA9]/20">
                        <div className="flex items-center gap-2 mb-4">
                          <Play className="w-5 h-5 text-[#00FFF0]/50" />
                          <h4 className="text-lg font-medium text-white">{currentClip.name}</h4>
                        </div>
                        
                        {/* Video Prompt as Script */}
                        {currentClip.videoPrompt ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Video Script / Prompt</p>
                              <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/10">
                                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">
                                  {currentClip.videoPrompt}
                                </p>
                              </div>
                            </div>
                            
                            {/* Image Prompt if available */}
                            {currentClip.imagePrompt && (
                              <div>
                                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Image Prompt</p>
                                <div className="bg-[#0C0C0C] rounded-lg p-4 border border-[#3AAFA9]/10">
                                  <p className="text-sm text-gray-300 leading-relaxed">
                                    {currentClip.imagePrompt}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            <div className="pt-2 border-t border-[#3AAFA9]/20">
                              <p className="text-xs text-gray-500">
                                💡 Generate image or video from the prompts above to see preview
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-sm text-gray-400 mb-2">No script/prompt available</p>
                            <p className="text-xs text-gray-500">This clip needs a video or image prompt</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Controls Overlay - Show for all clip types */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3 mb-3">
                <Button
                  onClick={handlePlayPause}
                  size="sm"
                  className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1 text-xs text-white">
                  {formatTime(calculateTimelineTime())} / {formatTime(totalDuration)}
                </div>
                
                <div className="text-xs text-gray-400">
                  Clip {currentClipIndex + 1} of {allClips.length}
                  {currentClipType === 'script' && ' (Script)'}
                  {currentClipType === 'image' && ' (Image)'}
                  {currentClipType === 'video' && ' (Video)'}
                </div>
                
                {currentClipType === 'video' && (
                  <Button
                    onClick={() => setIsMuted(!isMuted)}
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              
              {/* Progress Bar - Clickable for all types */}
              <div 
                ref={timelineRef}
                className="w-full h-2 bg-[#0C0C0C] rounded-full cursor-pointer relative group"
                onClick={handleTimelineClick}
              >
                <div 
                  className="h-full bg-[#00FFF0] rounded-full transition-all"
                  style={{ width: `${(calculateTimelineTime() / totalDuration) * 100}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#00FFF0] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${(calculateTimelineTime() / totalDuration) * 100}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="absolute bottom-20 left-4 right-4 flex items-center justify-between">
              <Button
                onClick={() => {
                  setCurrentClipIndex(Math.max(0, currentClipIndex - 1))
                  setIsPlaying(false)
                }}
                  disabled={currentClipIndex === 0}
                  size="sm"
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  ← Previous
                </Button>
                
                <div className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                  Clip {currentClipIndex + 1} of {allClips.length}
                </div>
                
                <Button
                  onClick={() => {
                    setCurrentClipIndex(Math.min(allClips.length - 1, currentClipIndex + 1))
                    setIsPlaying(false)
                  }}
                  disabled={currentClipIndex === allClips.length - 1}
                  size="sm"
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  Next →
                </Button>
              </div>
            )}
          </div>
          
          {/* Current Clip Info */}
          {currentClip && (
            <div className="mt-4 p-3 bg-[#0C0C0C] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{currentClip.name}</p>
                  <p className="text-xs text-gray-400">{currentClip.sceneName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentClipType === 'video' && '📹 Video'}
                    {currentClipType === 'image' && '🖼️ Image'}
                    {currentClipType === 'script' && '📝 Script Only'}
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {currentClipType === 'video' 
                    ? `${formatTime(currentTime)} / ${formatTime(currentClip.duration || 0)}`
                    : `${formatTime(currentClip.duration || 0)}s`
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Controls */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Timeline Controls</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlayPause}
              disabled={allClips.length === 0 || currentClipType !== 'video'}
              className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            {currentClipIndex > 0 && (
              <Button
                onClick={() => setCurrentClipIndex(Math.max(0, currentClipIndex - 1))}
                variant="outline"
                className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black px-4 py-2 rounded-xl"
              >
                ← Prev
              </Button>
            )}
            {currentClipIndex < allClips.length - 1 && (
              <Button
                onClick={() => setCurrentClipIndex(Math.min(allClips.length - 1, currentClipIndex + 1))}
                variant="outline"
                className="border-[#3AAFA9] text-[#3AAFA9] hover:bg-[#3AAFA9] hover:text-black px-4 py-2 rounded-xl"
              >
                Next →
              </Button>
            )}
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
