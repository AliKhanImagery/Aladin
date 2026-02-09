import { Clip } from '@/types'
import { cn } from '@/lib/utils'
import { Film, Image as ImageIcon, Video, MoreHorizontal, Clock, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface VideoClipItemProps {
  clip: Clip
  width: number
  isSelected: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDubbingClick?: () => void
  flatIndex?: number
  onReorder?: (fromFlatIndex: number, toFlatIndex: number) => void
}

export function VideoClipItem({ clip, width, isSelected, onClick, onContextMenu, onDubbingClick, flatIndex = 0, onReorder }: VideoClipItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData('application/x-flat-index', String(flatIndex))
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const from = e.dataTransfer.getData('application/x-flat-index')
    if (from === '' || !onReorder) return
    const fromFlat = parseInt(from, 10)
    if (fromFlat !== flatIndex) onReorder(fromFlat, flatIndex)
  }
  const hasVideo = !!clip.generatedVideo
  const hasImage = !!clip.generatedImage
  
  return (
    <div 
      className={cn(
        "h-[calc(100%-8px)] my-1 rounded-md border overflow-hidden relative group cursor-pointer transition-all flex-shrink-0 mx-[1px]",
        isSelected 
          ? "border-[#00FFF0] ring-1 ring-[#00FFF0] z-10" 
          : "border-[#3AAFA9]/20 hover:border-[#00FFF0]/50"
      )}
      style={{ width: `${width}px` }}
      onClick={onClick}
      onDragOver={onReorder ? handleDragOver : undefined}
      onDrop={onReorder ? handleDrop : undefined}
    >
      {/* Background / Preview */}
      <div className="absolute inset-0 bg-[#0C0C0C]">
        {hasVideo ? (
            <video
                src={clip.generatedVideo}
                preload="metadata"
                className="w-full h-full object-cover opacity-80"
                muted
                playsInline
            />
        ) : hasImage ? (
            <img 
                src={clip.generatedImage} 
                alt={clip.name} 
                className="w-full h-full object-cover opacity-80" 
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#1E1F22]">
                <Film className="w-6 h-6 text-gray-600" />
            </div>
        )}
      </div>

      {/* Overlay Info */}
      <div className="absolute inset-0 p-2 flex flex-col justify-between bg-gradient-to-b from-black/60 to-transparent hover:to-black/60 transition-all">
         {/* Top Row */}
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {onReorder && (
                <div
                  draggable
                  onDragStart={handleDragStart}
                  className="shrink-0 p-0.5 rounded cursor-grab active:cursor-grabbing text-white/50 hover:text-white/80 touch-none"
                  title="Drag to reorder"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-3 h-3" />
                </div>
              )}
              <span className="text-[10px] font-medium text-white truncate max-w-[85%] shadow-black text-shadow-sm">
                {clip.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {hasVideo ? (
                    <Video className="w-3 h-3 text-[#00FFF0]" />
                ) : hasImage ? (
                    <ImageIcon className="w-3 h-3 text-[#FFC44D]" />
                ) : (
                    <Clock className="w-3 h-3 text-gray-400" />
                )}
            </div>
         </div>

         {/* Bottom Row - Dubbing/Actions */}
         <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/80 hover:text-[#00FFF0] hover:bg-black/40 rounded-full"
                onClick={(e) => {
                    e.stopPropagation()
                    if (onDubbingClick) {
                        onDubbingClick()
                    } else {
                        toast('Dubbing settings coming soon', { icon: '🎙️' })
                    }
                }}
                title="Dubbing Settings"
            >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-3.5 h-3.5"
                >
                  <path d="M16 12c0 1.5-2 3-4 3s-4-1.5-4-3" />
                  <path d="M6 12c0-2.5 3-5 6-5s6 2.5 6 5" />
                  <path d="M6 12c0 2.5 3 5 6 5s6-2.5 6-5" />
                </svg>
            </Button>
         </div>
      </div>
      
      {/* Context Menu Trigger (Visible on Hover or Selected) */}
      <div className={cn(
          "absolute top-1 right-1 transition-opacity z-20",
          isSelected || "group-hover:opacity-100 opacity-0"
      )}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 bg-black/60 hover:bg-[#00FFF0] hover:text-black rounded-full text-white backdrop-blur-sm"
            onClick={(e) => {
                e.stopPropagation() // Prevent selecting the clip again
                onContextMenu(e)
            }}
          >
              <MoreHorizontal className="w-3 h-3" />
          </Button>
      </div>
    </div>
  )
}
