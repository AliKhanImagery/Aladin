import { AudioTrack as AudioTrackType, AudioClip } from '@/types'
import { AudioClipItem } from './AudioClipItem'
import { useRef, useState } from 'react'
import { Plus, Volume2, VolumeX, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AudioTrackProps {
  track: AudioTrackType
  pixelsPerSecond: number
  onAddClip: (time: number) => void
  onClipClick: (clip: AudioClip) => void
  selectedClipId?: string
  onUpdateTrack?: (updates: Partial<AudioTrackType>) => void
}

export function AudioTrack({ 
  track, 
  pixelsPerSecond, 
  onAddClip, 
  onClipClick, 
  selectedClipId,
  onUpdateTrack 
}: AudioTrackProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    // 128px is the width of the header (32 * 4 tailwind spacing unit)
    const x = e.clientX - rect.left - 128 
    const time = Math.max(0, x / pixelsPerSecond)
    setHoverTime(time)
  }

  const handleMouseLeave = () => {
    setHoverTime(null)
  }

  return (
    <div 
       ref={trackRef}
       className="h-20 bg-[#1E1F22]/30 rounded-lg border border-[#3AAFA9]/10 relative group/track flex shrink-0"
       onMouseMove={handleMouseMove}
       onMouseLeave={handleMouseLeave}
    >
        {/* Track Header */}
        <div className="w-32 bg-[#1E1F22] border-r border-[#3AAFA9]/10 z-30 flex flex-col justify-between p-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-medium truncate w-16" title={track.name}>
                {track.name}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 text-gray-500 hover:text-white"
                onClick={() => onUpdateTrack?.({ locked: !track.locked })}
              >
                {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </Button>
            </div>
            
            <div className="flex items-center justify-between mt-1">
               <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-5 w-5", track.muted ? "text-red-400" : "text-gray-400 hover:text-white")}
                    onClick={() => onUpdateTrack?.({ muted: !track.muted })}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </Button>
                  {/* Volume slider could go here */}
               </div>
            </div>
        </div>

        {/* Track Content Area */}
        <div className="flex-1 relative overflow-hidden bg-[#0C0C0C]/50">
             {/* Clips */}
             {track.clips.map(clip => (
                 <AudioClipItem 
                    key={clip.id}
                    clip={clip}
                    pixelsPerSecond={pixelsPerSecond}
                    isSelected={selectedClipId === clip.id}
                    onClick={() => onClipClick(clip)}
                    type={track.type}
                 />
             ))}

             {/* Hover Guide */}
             {hoverTime !== null && !track.locked && (
                 <div 
                    className="absolute top-0 bottom-0 w-[1px] bg-[#00FFF0]/30 pointer-events-none z-0"
                    style={{ left: `${hoverTime * pixelsPerSecond}px` }}
                 />
             )}
             
             {/* Empty State / Add Action Overlay */}
             {!track.locked && (
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover/track:opacity-100 transition-opacity">
                  <Button 
                      className="bg-[#00FFF0]/10 border border-[#00FFF0]/30 text-[#00FFF0] hover:bg-[#00FFF0]/20 pointer-events-auto backdrop-blur-sm"
                      size="sm"
                      onClick={() => onAddClip(hoverTime || 0)}
                  >
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Audio
                  </Button>
               </div>
             )}
        </div>
    </div>
  )
}
