import { Clip } from '@/types'
import { VideoClipItem } from './VideoClipItem'
import { useRef, useEffect } from 'react'

interface VideoTrackProps {
  clips: Clip[]
  zoomLevel: number
  onClipClick: (clip: Clip) => void
  selectedClipId?: string
}

export const BASE_PIXELS_PER_SECOND = 40

export function VideoTrack({ clips, zoomLevel, onClipClick, selectedClipId }: VideoTrackProps) {
  // We want to scroll to the selected clip if it changes, potentially
  
  return (
    <div className="flex h-full items-center pl-2">
      {clips.map((clip) => (
        <VideoClipItem 
           key={clip.id} 
           clip={clip} 
           width={clip.duration * BASE_PIXELS_PER_SECOND * zoomLevel}
           isSelected={selectedClipId === clip.id}
           onClick={() => onClipClick(clip)}
        />
      ))}
      {/* Spacer at the end */}
      <div className="w-40 flex-shrink-0 h-full border-l border-dashed border-[#3AAFA9]/10 bg-transparent flex items-center justify-center">
         <span className="text-xs text-gray-600">End of Timeline</span>
      </div>
    </div>
  )
}
