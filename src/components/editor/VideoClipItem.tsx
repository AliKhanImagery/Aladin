import { Clip } from '@/types'
import { cn } from '@/lib/utils'
import { Film, Image as ImageIcon, Video, MoreHorizontal, Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VideoClipItemProps {
  clip: Clip
  width: number
  isSelected: boolean
  onClick: () => void
}

export function VideoClipItem({ clip, width, isSelected, onClick }: VideoClipItemProps) {
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
    >
      {/* Background / Preview */}
      <div className="absolute inset-0 bg-[#0C0C0C]">
        {hasVideo ? (
            <video 
                src={clip.generatedVideo} 
                className="w-full h-full object-cover opacity-80" 
                muted // Muted to allow autoplay if needed, though we just show frame
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
      <div className="absolute inset-0 p-2 flex flex-col justify-between bg-gradient-to-b from-black/60 to-transparent">
         <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-white truncate max-w-[80%] shadow-black text-shadow-sm">
                {clip.name}
            </span>
            <div className="flex items-center gap-1">
                {hasVideo ? (
                    <Video className="w-3 h-3 text-[#00FFF0]" />
                ) : hasImage ? (
                    <ImageIcon className="w-3 h-3 text-[#FFC44D]" />
                ) : (
                    <Clock className="w-3 h-3 text-gray-400" />
                )}
            </div>
         </div>
      </div>
      
      {/* Context Menu Trigger (Visible on Hover) */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 bg-black/50 hover:bg-black/80 rounded-full text-white">
              <MoreHorizontal className="w-3 h-3" />
          </Button>
      </div>
    </div>
  )
}
