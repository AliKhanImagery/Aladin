'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { X, Mic, Music, Volume2, Sparkles, Loader2, FolderOpen, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectOption } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { AudioClip } from '@/types'
import AssetLibraryModal from '@/components/AssetLibraryModal'
import { saveUserAsset } from '@/lib/userMedia'

const AUDIO_MODELS: SelectOption[] = [
  { value: 'elevenlabs-music', label: 'Music/BGM', description: 'Generate soundtracks and background music' },
  { value: 'elevenlabs-sfx', label: 'ElevenLabs (SFX)', description: 'High quality sound effects' },
  { value: 'elevenlabs-tts', label: 'ElevenLabs (Voiceover)', description: 'High quality text-to-speech' }
]

export function AudioGenerationDrawer() {
  const { 
    isAudioDrawerOpen, 
    setAudioDrawerOpen, 
    activeAudioTrackId, 
    activeAudioTime,
    addAudioClip,
    updateAudioClip,
    currentProject
  } = useAppStore()

  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(10)
  const [model, setModel] = useState('elevenlabs-music')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)

  if (!isAudioDrawerOpen) return null

  const handleAssetUpload = async (file: File) => {
    setIsUploadingAsset(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload-file', { method: 'POST', body: formData })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      const { url } = await response.json()
      
      // Save to user_assets library as audio
      await saveUserAsset({
        name: file.name,
        type: 'audio',
        asset_url: url,
        metadata: { originalFilename: file.name, fileSize: file.size }
      })
      
    } catch (e: any) {
      console.error('Asset upload failed:', e)
      toast.error(`Upload failed: ${e.message}`)
    } finally {
      setIsUploadingAsset(false)
    }
  }

  const handleSelectFromLibrary = (url: string, name?: string) => {
    if (!activeAudioTrackId) return

    // Create a temporary audio element to get duration
    const audio = new Audio(url)
    const toastId = toast.loading('Loading audio...')
    
    audio.onloadedmetadata = () => {
        const audioDuration = audio.duration
        const clipId = crypto.randomUUID()
        const startTime = activeAudioTime ?? 0

        const newClip: AudioClip = {
            id: clipId,
            trackId: activeAudioTrackId,
            name: name || 'Audio Clip',
            assetUrl: url,
            startTime,
            duration: audioDuration,
            offset: 0,
            volume: 1,
            status: 'completed'
        }

        addAudioClip(activeAudioTrackId, newClip)
        
        const { saveProjectNow } = useAppStore.getState()
        if (currentProject) {
            saveProjectNow(currentProject.id)
        }

        toast.success('Audio added to timeline', { id: toastId })
        setIsLibraryOpen(false)
        setAudioDrawerOpen(false)
    }

    audio.onerror = () => {
        toast.error('Failed to load audio details', { id: toastId })
    }
  }

  const handleGenerate = async () => {
    if (!prompt) {
      toast.error('Please enter a prompt')
      return
    }
    
    if (!activeAudioTrackId) {
      toast.error('No active audio track selected')
      return
    }

    setIsGenerating(true)
    const toastId = toast.loading('Generating audio...')
    const clipId = crypto.randomUUID()
    const startTime = activeAudioTime ?? 0

    // Placeholder clip so the user sees "Generating…" on the timeline
    const placeholderClip: AudioClip = {
      id: clipId,
      trackId: activeAudioTrackId,
      name: prompt.substring(0, 20) + (prompt.length > 20 ? '...' : ''),
      assetUrl: '',
      startTime,
      duration,
      offset: 0,
      volume: 1,
      status: 'generating'
    }
    addAudioClip(activeAudioTrackId, placeholderClip)

    try {
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration,
          model,
          projectId: currentProject?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate audio')
      }

      const data = await response.json()

      updateAudioClip(activeAudioTrackId, clipId, {
        assetUrl: data.audioUrl,
        duration: data.duration ?? duration,
        status: 'completed'
      })

      const { saveProjectNow } = useAppStore.getState()
      if (currentProject) {
        saveProjectNow(currentProject.id)
      }

      toast.success('Audio generated successfully!', { id: toastId })
      setAudioDrawerOpen(false)
      setPrompt('')
    } catch (error: any) {
      console.error('Audio generation error:', error)
      updateAudioClip(activeAudioTrackId, clipId, { status: 'failed' })
      toast.error(`Generation failed: ${error.message}`, { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-[#1E1F22] border-l border-[#3AAFA9]/20 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#3AAFA9]/10 flex items-center justify-between bg-[#0C0C0C]/50">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Music className="w-5 h-5 text-[#00FFF0]" />
          Add Audio
        </h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setAudioDrawerOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {/* Quick Library Access */}
        <div className="bg-[#0C0C0C] rounded-xl p-4 border border-[#3AAFA9]/20 flex flex-col items-center gap-3">
            <div className="text-center">
                <h3 className="text-sm font-bold text-white">Have audio ready?</h3>
                <p className="text-xs text-gray-500">Select from your library or uploads.</p>
            </div>
            <Button 
                onClick={() => setIsLibraryOpen(true)}
                variant="outline"
                className="w-full border-[#3AAFA9]/30 hover:bg-[#3AAFA9]/10 hover:text-[#00FFF0] text-gray-300"
            >
                <FolderOpen className="w-4 h-4 mr-2" />
                Open Audio Library
            </Button>
        </div>

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#3AAFA9]/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#1E1F22] px-2 text-gray-500 font-bold tracking-wider">Or Generate New</span>
            </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase">Model</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModel('elevenlabs-music')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'elevenlabs-music' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <Music className={`w-5 h-5 ${model === 'elevenlabs-music' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-sm font-medium">Music/BGM</span>
            </button>
            <button
              onClick={() => setModel('elevenlabs-sfx')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'elevenlabs-sfx' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <Volume2 className={`w-5 h-5 ${model === 'elevenlabs-sfx' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-sm font-medium">SFX</span>
            </button>
            <button
              onClick={() => setModel('elevenlabs-tts')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'elevenlabs-tts' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <Mic className={`w-5 h-5 ${model === 'elevenlabs-tts' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-sm font-medium">Voiceover</span>
            </button>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase">
            {model === 'elevenlabs-music' || model === 'elevenlabs-sfx' ? 'Description' : 'Text to Speak'}
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              model === 'elevenlabs-music' 
                ? "Cinematic orchestral buildup, suspenseful, dark atmosphere..." 
                : model === 'elevenlabs-sfx'
                ? "Footsteps on gravel, door creaking..."
                : "Enter the dialogue for the character..."
            }
            className="min-h-[120px] bg-[#0C0C0C] border-[#3AAFA9]/20 focus:border-[#00FFF0] text-white resize-none"
          />
        </div>

        {/* Duration Slider (only for music/sfx) */}
        {(model === 'elevenlabs-music' || model === 'elevenlabs-sfx') && (
          <div className="space-y-2">
             <div className="flex items-center justify-between">
               <label className="text-xs font-medium text-gray-400 uppercase">Duration</label>
               <span className="text-xs font-mono text-[#00FFF0]">{duration}s</span>
             </div>
             <input 
               type="range" 
               min="1" 
               max="30" 
               value={duration} 
               onChange={(e) => setDuration(parseInt(e.target.value))}
               className="w-full accent-[#00FFF0]"
             />
          </div>
        )}

        {/* Info Box */}
        <div className="p-3 bg-[#00FFF0]/5 rounded-lg border border-[#00FFF0]/10">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#00FFF0] mt-0.5" />
            <p className="text-xs text-gray-300 leading-relaxed">
              {model === 'elevenlabs-music' 
                ? "Generates high-quality background music using ElevenLabs' Music model."
                : model === 'elevenlabs-sfx'
                ? "Generates cinematic sound effects using ElevenLabs' advanced audio engine."
                : "Generates realistic voiceovers using ElevenLabs' advanced TTS model."}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#3AAFA9]/10 bg-[#0C0C0C]/50">
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt}
          className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Audio
            </>
          )}
        </Button>
      </div>

      <AssetLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelect={(url, name) => handleSelectFromLibrary(url, name)}
        onUpload={handleAssetUpload}
        isUploading={isUploadingAsset}
        projectContext={currentProject}
        initialTab="audio"
        allowedTypes={['audio']}
      />
    </div>
  )
}
