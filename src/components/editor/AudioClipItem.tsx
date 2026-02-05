import { AudioClip } from '@/types'
import { cn } from '@/lib/utils'
import { Music, Mic, Volume2 } from 'lucide-react'

interface AudioClipItemProps {
  clip: AudioClip
  pixelsPerSecond: number
  isSelected: boolean
  onClick: () => void
  type: 'bg_music' | 'sfx' | 'voiceover'
}

export function AudioClipItem({ clip, pixelsPerSecond, isSelected, onClick, type }: AudioClipItemProps) {
  const getIcon = () => {
    switch (type) {
      case 'bg_music': return <Music className="w-3 h-3" />
      case 'voiceover': return <Mic className="w-3 h-3" />
      default: return <Volume2 className="w-3 h-3" />
    }
  }

  const getColorClass = () => {
    switch (type) {
      case 'bg_music': return "bg-blue-900/40 border-blue-500/50 text-blue-200 hover:bg-blue-800/50"
      case 'voiceover': return "bg-purple-900/40 border-purple-500/50 text-purple-200 hover:bg-purple-800/50"
      default: return "bg-emerald-900/40 border-emerald-500/50 text-emerald-200 hover:bg-emerald-800/50"
    }
  }

  const width = clip.duration * pixelsPerSecond
  const left = clip.startTime * pixelsPerSecond

  return (
    <div 
      className={cn(
        "absolute top-1 bottom-1 rounded-md border overflow-hidden cursor-pointer transition-all flex items-center px-2 gap-2 z-10",
        getColorClass(),
        isSelected && "ring-1 ring-white border-white z-20 shadow-md"
      )}
      style={{ 
        width: `${width}px`,
        left: `${left}px`
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
       {getIcon()}
       <span className="text-[10px] font-medium truncate select-none">{clip.name}</span>
    </div>
  )
}
