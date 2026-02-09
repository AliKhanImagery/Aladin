import { Clip } from '@/types'
import { VideoClipItem } from './VideoClipItem'
import { useRef, useEffect } from 'react'

interface VideoTrackProps {
  clips: Clip[]
  zoomLevel: number
  onClipClick: (clip: Clip) => void
  onClipContextMenu?: (clip: Clip) => void
  onClipDubbing?: (clip: Clip) => void
  selectedClipId?: string
  onReorder?: (fromFlatIndex: number, toFlatIndex: number) => void
}

export const BASE_PIXELS_PER_SECOND = 40

export function VideoTrack({ clips, zoomLevel, onClipClick, onClipContextMenu, onClipDubbing, selectedClipId, onReorder }: VideoTrackProps) {
  return (
    <div className="flex h-full items-center pl-2">
      {clips.map((clip, flatIndex) => (
        <VideoClipItem 
           key={clip.id} 
           clip={clip} 
           width={clip.duration * BASE_PIXELS_PER_SECOND * zoomLevel}
           isSelected={selectedClipId === clip.id}
           onClick={() => onClipClick(clip)}
           onContextMenu={() => onClipContextMenu && onClipContextMenu(clip)}
           onDubbingClick={() => onClipDubbing && onClipDubbing(clip)}
           flatIndex={flatIndex}
           onReorder={onReorder}
        />
      ))}
      {/* Spacer at the end */}
      <div className="w-40 flex-shrink-0 h-full border-l border-dashed border-[#3AAFA9]/10 bg-transparent flex items-center justify-center">
         <span className="text-xs text-gray-600">End of Timeline</span>
      </div>
    </div>
  )
}
