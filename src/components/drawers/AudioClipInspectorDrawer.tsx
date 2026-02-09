'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { X, Volume2, Trash2, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { AudioClip } from '@/types'

interface AudioClipInspectorDrawerProps {
  isOpen: boolean
  onClose: () => void
  clip: AudioClip | null
}

export function AudioClipInspectorDrawer({ isOpen, onClose, clip }: AudioClipInspectorDrawerProps) {
  const { updateAudioClip, deleteAudioClip } = useAppStore()
  const [name, setName] = useState('')
  const [volume, setVolume] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (clip) {
      setName(clip.name)
      setVolume(clip.volume)
    }
  }, [clip])

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [isOpen])

  if (!isOpen || !clip) return null

  const handleSaveName = () => {
    if (clip.name !== name) {
      updateAudioClip(clip.trackId, clip.id, { name })
      toast.success('Name updated')
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const v = value[0] ?? 1
    setVolume(v)
    updateAudioClip(clip.trackId, clip.id, { volume: v })
  }

  const handlePlayPause = () => {
    if (!clip.assetUrl || clip.status === 'generating') return
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.currentTime = clip.offset || 0
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleDelete = () => {
    deleteAudioClip(clip.trackId, clip.id)
    toast.success('Audio clip removed')
    onClose()
  }

  const canPlay = clip.assetUrl && clip.status !== 'generating'

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed bg-[#1E1F22] border-[#3AAFA9]/20 shadow-2xl z-50 flex flex-col transition-transform duration-300',
          'inset-x-0 bottom-0 h-[100dvh] rounded-none border-t lg:border-t-0',
          'lg:inset-y-0 lg:right-0 lg:w-[500px] lg:h-[100dvh] lg:border-l lg:rounded-none',
          isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'
        )}
      >
        {clip.assetUrl && (
          <audio
            ref={audioRef}
            src={clip.assetUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />
        )}

        <div className="p-4 border-b border-[#3AAFA9]/10 flex items-center justify-between bg-[#0C0C0C]/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#00FFF0]" />
            Audio Clip
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              className="bg-[#0C0C0C] border-[#3AAFA9]/20 focus:border-[#00FFF0] text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase">Preview</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePlayPause}
                disabled={!canPlay}
                className="border-[#3AAFA9]/30 text-[#3AAFA9] hover:bg-[#3AAFA9]/10"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <span className="text-sm text-gray-400">
                {clip.status === 'generating' ? 'Generating…' : clip.status === 'failed' ? 'Failed' : `${clip.duration.toFixed(1)}s`}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase flex items-center gap-2">
              <Volume2 className="w-3 h-3" /> Volume
            </label>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[#3AAFA9]/10 bg-[#0C0C0C]/50">
          <Button
            variant="outline"
            onClick={handleDelete}
            className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove from track
          </Button>
        </div>
      </div>
    </>
  )
}
