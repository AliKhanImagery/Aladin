'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { X, Mic, Music, Volume2, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectOption } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { AudioClip } from '@/types'

const AUDIO_MODELS: SelectOption[] = [
  { value: 'stable-audio', label: 'Stable Audio (Music/SFX)', description: 'Best for music and sound effects' },
  { value: 'playai-tts', label: 'Play.ai (Voiceover)', description: 'High quality text-to-speech' }
]

export function AudioGenerationDrawer() {
  const { 
    isAudioDrawerOpen, 
    setAudioDrawerOpen, 
    activeAudioTrackId, 
    activeAudioTime,
    addAudioClip,
    currentProject
  } = useAppStore()

  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(5)
  const [model, setModel] = useState('stable-audio')
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isAudioDrawerOpen) return null

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

    try {
      // Call API
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
      
      // Create new clip
      const newClip: AudioClip = {
        id: crypto.randomUUID(),
        trackId: activeAudioTrackId,
        name: prompt.substring(0, 20) + (prompt.length > 20 ? '...' : ''),
        assetUrl: data.audioUrl,
        startTime: activeAudioTime || 0,
        duration: data.duration || duration,
        offset: 0,
        volume: 1
      }

      addAudioClip(activeAudioTrackId, newClip)
      
      toast.success('Audio generated successfully!', { id: toastId })
      setAudioDrawerOpen(false)
      setPrompt('')
      
    } catch (error: any) {
      console.error('Audio generation error:', error)
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
          Generate Audio
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
        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase">Model</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModel('stable-audio')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'stable-audio' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <Music className={`w-5 h-5 ${model === 'stable-audio' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-sm font-medium">Music / SFX</span>
            </button>
            <button
              onClick={() => setModel('playai-tts')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'playai-tts' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <Mic className={`w-5 h-5 ${model === 'playai-tts' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-sm font-medium">Voiceover</span>
            </button>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase">
            {model === 'stable-audio' ? 'Description' : 'Text to Speak'}
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              model === 'stable-audio' 
                ? "Cinematic orchestral buildup, suspenseful, dark atmosphere..." 
                : "Enter the dialogue for the character..."
            }
            className="min-h-[120px] bg-[#0C0C0C] border-[#3AAFA9]/20 focus:border-[#00FFF0] text-white resize-none"
          />
        </div>

        {/* Duration Slider (only for music/sfx) */}
        {model === 'stable-audio' && (
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
              {model === 'stable-audio' 
                ? "Generates high-quality sound effects or background music using Fal.ai's Stable Audio model."
                : "Generates realistic voiceovers using Play.ai's advanced TTS model."}
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
    </div>
  )
}
