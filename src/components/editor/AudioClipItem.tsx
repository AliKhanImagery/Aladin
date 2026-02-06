import { useRef, useCallback } from 'react'
import { AudioClip } from '@/types'
import { cn } from '@/lib/utils'
import { Music, Mic, Volume2, MoreHorizontal, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioClipItemProps {
  clip: AudioClip
  pixelsPerSecond: number
  isSelected: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onMoveClip?: (newStartTime: number) => void
  type: 'bg_music' | 'sfx' | 'voiceover'
}

export function AudioClipItem({ clip, pixelsPerSecond, isSelected, onClick, onContextMenu, onMoveClip, type }: AudioClipItemProps) {
  const dragStartXRef = useRef(0)
  const dragStartTimeRef = useRef(0)
  const didDragRef = useRef(false)
  const isDraggingRef = useRef(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !onMoveClip || clip.status === 'generating') return
      if ((e.target as HTMLElement).closest?.('button') != null) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragStartXRef.current = e.clientX
      dragStartTimeRef.current = clip.startTime
      didDragRef.current = false
      isDraggingRef.current = true
    },
    [clip.startTime, clip.status, onMoveClip]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !onMoveClip) return
      const newStartTime = Math.max(
        0,
        dragStartTimeRef.current + (e.clientX - dragStartXRef.current) / pixelsPerSecond
      )
      didDragRef.current = true
      onMoveClip(newStartTime)
    },
    [onMoveClip, pixelsPerSecond]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (didDragRef.current) {
        didDragRef.current = false
        return
      }
      onClick()
    },
    [onClick]
  )

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
  const isGenerating = clip.status === 'generating'
  const isFailed = clip.status === 'failed'

  return (
    <div 
      className={cn(
        "absolute top-1 bottom-1 rounded-md border overflow-hidden transition-all flex items-center px-2 gap-2 z-10 group",
        getColorClass(),
        isSelected && "ring-1 ring-white border-white z-20 shadow-md",
        isGenerating && "opacity-90",
        isFailed && "border-red-500/50 bg-red-900/30",
        onMoveClip && "cursor-grab active:cursor-grabbing"
      )}
      style={{ 
        width: `${width}px`,
        left: `${left}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
       {getIcon()}
       <span className="text-[10px] font-medium truncate select-none flex-1">
         {isGenerating ? 'Generating…' : isFailed ? 'Failed' : clip.name}
       </span>
       {/* Status indicator */}
       {isGenerating && (
         <Loader2 className="w-3 h-3 shrink-0 animate-spin text-white/80" aria-hidden />
       )}
       {isFailed && (
         <AlertCircle className="w-3 h-3 shrink-0 text-red-300" aria-hidden />
       )}
       
       {/* Context Menu Trigger */}
       <div className={cn(
          "transition-opacity z-20",
          isSelected || "opacity-0 group-hover:opacity-100"
       )}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 hover:bg-white/20 hover:text-white rounded-full text-white/70"
            onClick={(e) => {
                e.stopPropagation() 
                onContextMenu(e)
            }}
          >
              <MoreHorizontal className="w-3 h-3" />
          </Button>
       </div>
    </div>
  )
}
