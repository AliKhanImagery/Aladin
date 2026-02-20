'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { X, Mic, Music, Volume2, Sparkles, Loader2, FolderOpen, Upload, User, Play, Pause, Plus, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectOption } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { AudioClip } from '@/types'
import AssetLibraryModal from '@/components/AssetLibraryModal'
import { saveUserAsset } from '@/lib/userMedia'
import { getSessionSafe } from '@/lib/auth'
import Link from 'next/link'

const AUDIO_MODELS: SelectOption[] = [
  { value: 'elevenlabs-music', label: 'Music/BGM', description: 'Generate soundtracks and background music' },
  { value: 'elevenlabs-sfx', label: 'ElevenLabs (SFX)', description: 'High quality sound effects' },
  { value: 'elevenlabs-tts', label: 'ElevenLabs (Voiceover)', description: 'High quality text-to-speech' },
  { value: 'voice-changer', label: 'Voice Changer', description: 'Audio input → ElevenLabs or internal characters' }
]

interface Voice {
  id: string
  name: string
  provider_voice_id: string
  preview_url: string | null
  ref_text?: string | null
}

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
  
  // Voice Character State (Dialogue = F5; only "My Cast" with preview_url)
  const [userVoices, setUserVoices] = useState<Voice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('')
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [playingPreview, setPlayingPreview] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  // Voice Changer (Dialogue only): record → ASR → F5 in character voice
  const [isRecording, setIsRecording] = useState(false)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceChangerTranscript, setVoiceChangerTranscript] = useState('')
  const [isVoiceChangerConverting, setIsVoiceChangerConverting] = useState(false)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const selectedVoice = userVoices.find((v) => v.id === selectedVoiceId) ?? null
  const canGenerateDialogue = selectedVoice && selectedVoice.preview_url

  // ElevenLabs BYOA: voices from user's API key
  interface ELVoice { voice_id: string; name: string; preview_url: string | null; source_id?: string; source_name?: string; category?: string }
  const [elVoices, setElVoices] = useState<ELVoice[]>([])
  const [elLoading, setElLoading] = useState(false)
  const [elConnected, setElConnected] = useState(false)
  const [selectedElVoiceId, setSelectedElVoiceId] = useState<string>('')
  const [selectedElVoiceSourceId, setSelectedElVoiceSourceId] = useState<string | undefined>(undefined)
  const [playingElPreview, setPlayingElPreview] = useState<string | null>(null)
  const [elVoiceTab, setElVoiceTab] = useState<'stock' | 'cloned'>('stock')
  const [voiceChangerSourceTab, setVoiceChangerSourceTab] = useState<'elevenlabs' | 'cast'>('elevenlabs')

  const filteredElVoices = elVoices.filter(v => {
      if (elVoiceTab === 'stock') return v.category === 'premade'
      return v.category !== 'premade'
  })

  useEffect(() => {
    if (isAudioDrawerOpen && (model === 'voice-changer' || model === 'fal-f5-tts')) {
        fetchUserVoices()
    }
  }, [isAudioDrawerOpen, model])

  useEffect(() => {
    if (isAudioDrawerOpen && (model === 'elevenlabs-tts' || model === 'voice-changer')) {
      let cancelled = false
      const run = async () => {
        setElLoading(true)
        try {
          const { data: { session } } = await getSessionSafe()
          const token = session?.access_token
          if (!token) return
          const res = await fetch('/api/user/voices/elevenlabs', { headers: { Authorization: `Bearer ${token}` } })
          const data = await res.json().catch(() => ({}))
          if (!cancelled) {
            setElConnected(!!data.connected)
            setElVoices(data.voices || [])
          }
        } catch {
          if (!cancelled) setElVoices([])
        } finally {
          if (!cancelled) setElLoading(false)
        }
      }
      run()
      return () => { cancelled = true }
    }
  }, [isAudioDrawerOpen, model])

  const fetchUserVoices = async () => {
      try {
          setIsLoadingVoices(true)
          const { data: { session } } = await getSessionSafe()
          const token = session?.access_token
          if (!token) {
            setUserVoices([])
            return
          }
          const response = await fetch('/api/user/voices', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (response.ok) {
              const data = await response.json()
              setUserVoices(data.voices || [])
          }
      } catch (error) {
          console.error('Failed to fetch voices', error)
      } finally {
          setIsLoadingVoices(false)
      }
  }

  const handlePlayPreview = (url: string | null, id: string) => {
      if (!url) return;
      
      if (playingPreview === id) {
          audioElement?.pause()
          setPlayingPreview(null)
          return
      }

      if (audioElement) {
          audioElement.pause()
      }

      const audio = new Audio(url)
      audio.onended = () => setPlayingPreview(null)
      audio.play()
      setAudioElement(audio)
      setPlayingPreview(id)
  }

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      recorder.onstop = () => {
        if (chunks.length) setRecordingBlob(new Blob(chunks, { type: mime }))
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      recorder.start(200)
      setRecordingBlob(null)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s >= 29) {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
            mediaRecorderRef.current?.stop()
            setIsRecording(false)
            return 30
          }
          return s + 1
        })
      }, 1000)
      setIsRecording(true)
    } catch (e: any) {
      toast.error(e.message || 'Could not access microphone')
    }
  }

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
  }

  const handleVoiceChangerConvert = async () => {
    if (!activeAudioTrackId || !selectedVoice?.preview_url) {
      toast.error('Select a character first.')
      return
    }
    const blob = recordingBlob
    const text = voiceChangerTranscript.trim()
    if (!blob && !text) {
      toast.error('Record a clip or enter text to convert.')
      return
    }
    if (blob && blob.size === 0) {
      toast.error('Recording is empty.')
      return
    }
    setIsVoiceChangerConverting(true)
    const toastId = toast.loading(selectedVoice ? `Transcribing… then speaking in ${selectedVoice.name}'s voice…` : 'Converting…')
    const clipId = crypto.randomUUID()
    const startTime = activeAudioTime ?? 0
    const placeholderClip: AudioClip = {
      id: clipId,
      trackId: activeAudioTrackId,
      name: 'Voice conversion',
      assetUrl: '',
      startTime,
      duration: 5,
      offset: 0,
      volume: 1,
      status: 'generating',
    }
    addAudioClip(activeAudioTrackId, placeholderClip)
    try {
      if (blob && blob.size > 0) {
        const formData = new FormData()
        formData.append('file', blob, 'recording.webm')
        formData.append('ref_audio_url', selectedVoice.preview_url)
        if (selectedVoice.ref_text) formData.append('ref_text', selectedVoice.ref_text)
        if (voiceChangerTranscript.trim()) formData.append('transcript', voiceChangerTranscript.trim())
        const url = new URL('/api/audio/voice-changer', window.location.origin)
        if (currentProject?.id) url.searchParams.set('projectId', currentProject.id)
        const response = await fetch(url.toString(), { method: 'POST', body: formData })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || 'Voice conversion failed')
        }
        const data = await response.json()
        if (data.transcript) setVoiceChangerTranscript(data.transcript)
        updateAudioClip(activeAudioTrackId, clipId, {
          assetUrl: data.audioUrl,
          duration: data.duration ?? 5,
          status: 'completed',
        })
      } else {
        const response = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            model: 'fal-f5-tts',
            ref_audio_url: selectedVoice.preview_url,
            ref_text: selectedVoice.ref_text ?? undefined,
            projectId: currentProject?.id,
          }),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || 'Generation failed')
        }
        const data = await response.json()
        updateAudioClip(activeAudioTrackId, clipId, {
          assetUrl: data.audioUrl,
          duration: data.duration ?? 5,
          status: 'completed',
        })
      }
      const { saveProjectNow } = useAppStore.getState()
      if (currentProject) saveProjectNow(currentProject.id)
      toast.success('Added to timeline', { id: toastId })
      setRecordingBlob(null)
      setVoiceChangerTranscript('')
      setAudioDrawerOpen(false)
    } catch (error: any) {
      updateAudioClip(activeAudioTrackId, clipId, { status: 'failed' })
      toast.error(error.message || 'Conversion failed', { id: toastId })
    } finally {
      setIsVoiceChangerConverting(false)
    }
  }

  const handleElevenLabsSTS = async () => {
    if (!activeAudioTrackId) {
      toast.error('Select an audio track first.')
      return
    }
    if (!selectedElVoiceId) {
      toast.error('Select a target voice first.')
      return
    }
    const blob = recordingBlob
    if (!blob || blob.size === 0) {
      toast.error('Please record audio first.')
      return
    }

    setIsVoiceChangerConverting(true)
    const toastId = toast.loading('Transforming voice (Speech-to-Speech)...')
    const clipId = crypto.randomUUID()
    const startTime = activeAudioTime ?? 0
    
    // Placeholder clip
    const placeholderClip: AudioClip = {
      id: clipId,
      trackId: activeAudioTrackId,
      name: 'Voice Transformation',
      assetUrl: '',
      startTime,
      duration: recordingSeconds || 5,
      offset: 0,
      volume: 1,
      status: 'generating',
    }
    addAudioClip(activeAudioTrackId, placeholderClip)

    try {
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        formData.append('voice_id', selectedElVoiceId)
        if (selectedElVoiceSourceId) {
            formData.append('integration_id', selectedElVoiceSourceId)
        }
        
        const { data: { session } } = await getSessionSafe()
        const token = session?.access_token
        if (!token) throw new Error('Unauthorized')

        const url = new URL('/api/audio/voice-changer/elevenlabs', window.location.origin)
        if (currentProject?.id) url.searchParams.set('projectId', currentProject.id)

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData 
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            const message = err.error || err.details || (response.status === 401 ? 'Invalid API key' : response.status === 429 ? 'ElevenLabs quota exceeded' : 'Transformation failed')
            throw new Error(message)
        }

        const data = await response.json()
        
        updateAudioClip(activeAudioTrackId, clipId, {
            assetUrl: data.audioUrl,
            duration: data.duration ?? recordingSeconds,
            status: 'completed',
        })
        
        const { saveProjectNow } = useAppStore.getState()
        if (currentProject) saveProjectNow(currentProject.id)
        
        toast.success('Voice transformed!', { id: toastId })
        setRecordingBlob(null)
        setAudioDrawerOpen(false)

    } catch (error: any) {
        console.error('STS error', error)
        updateAudioClip(activeAudioTrackId, clipId, { status: 'failed' })
        toast.error(error.message || 'Transformation failed', { id: toastId })
    } finally {
        setIsVoiceChangerConverting(false)
    }
  }

  const handleVoiceChangerTransform = async () => {
    if (voiceChangerSourceTab === 'elevenlabs' && selectedElVoiceId) {
      return handleElevenLabsSTS()
    }
    if (voiceChangerSourceTab === 'cast' && selectedVoiceId && selectedVoice?.preview_url) {
      return handleVoiceChangerConvert()
    }
    toast.error('Select a target voice (ElevenLabs or My Cast) first.')
  }

  const handleGenerate = async () => {
    if (model === 'voice-changer') {
        return handleVoiceChangerTransform()
    }
    if (!prompt) {
      toast.error('Please enter a prompt')
      return
    }
    
    if (!activeAudioTrackId) {
      toast.error('No active audio track selected')
      return
    }

    if (model === 'fal-f5-tts') {
      if (!canGenerateDialogue) {
        toast.error('Select a character or add one in Voice Lab.')
        return
      }
    }
    if (model === 'elevenlabs-tts' && !selectedElVoiceId) {
         toast.error('Please select an ElevenLabs voice')
      return
    }

    setIsGenerating(true)
    const toastMsg = model === 'fal-f5-tts' && selectedVoice ? `Speaking in ${selectedVoice.name}'s voice…` : 'Generating audio...'
    const toastId = toast.loading(toastMsg)
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
      const payload: Record<string, unknown> = {
          prompt,
          duration,
          model,
          projectId: currentProject?.id
      }

      if (model === 'fal-f5-tts' && selectedVoice) {
          payload.ref_audio_url = selectedVoice.preview_url
          payload.ref_text = selectedVoice.ref_text ?? undefined
      }
      if (model === 'elevenlabs-tts') {
          payload.voiceId = selectedElVoiceId
          payload.integrationId = selectedElVoiceSourceId
      }

      const { data: { session } } = await getSessionSafe()
      const token = session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to generate audio')
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setModel('elevenlabs-music')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'elevenlabs-music' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <Music className={`w-5 h-5 ${model === 'elevenlabs-music' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-xs font-medium">Music</span>
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
              <span className="text-xs font-medium">SFX</span>
            </button>
            <button
              onClick={() => setModel('voice-changer')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'voice-changer' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <RefreshCcw className={`w-5 h-5 ${model === 'voice-changer' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-xs font-medium">Voice Changer</span>
            </button>
            <button
              onClick={() => setModel('elevenlabs-tts')}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                model === 'elevenlabs-tts' 
                  ? 'bg-[#00FFF0]/10 border-[#00FFF0] text-white' 
                  : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/50'
              }`}
            >
              <User className={`w-5 h-5 ${model === 'elevenlabs-tts' ? 'text-[#00FFF0]' : ''}`} />
              <span className="text-xs font-medium">Voiceover</span>
            </button>
          </div>
        </div>

        {/* ElevenLabs voice row (Voiceover only) */}
        {model === 'elevenlabs-tts' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-400 uppercase">ElevenLabs Voice</label>
                <div className="flex bg-[#0C0C0C] rounded-lg p-0.5 border border-[#3AAFA9]/20">
                    <button
                        onClick={() => setElVoiceTab('stock')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                            elVoiceTab === 'stock' 
                                ? 'bg-[#3AAFA9]/20 text-[#00FFF0]' 
                                : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        Stock
                    </button>
                    <button
                        onClick={() => setElVoiceTab('cloned')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                            elVoiceTab === 'cloned' 
                                ? 'bg-[#3AAFA9]/20 text-[#00FFF0]' 
                                : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        Clones
                    </button>
                </div>
            </div>
            <div className="flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-[#3AAFA9]/30 scrollbar-track-transparent">
              <button
                type="button"
                onClick={() => {
                    setSelectedElVoiceId('')
                    setSelectedElVoiceSourceId(undefined)
                }}
                className={`shrink-0 w-[100px] min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors ${
                  selectedElVoiceId === ''
                    ? 'bg-[#00FFF0]/10 border-[#00FFF0]/40 text-white'
                    : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/40 hover:text-gray-300'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider font-medium">None</span>
              </button>
              {elLoading ? (
                <div className="shrink-0 w-[100px] min-h-[88px] rounded-xl border border-[#3AAFA9]/20 bg-[#0C0C0C] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#00FFF0]" />
                </div>
              ) : !elConnected ? (
                <button
                  type="button"
                  onClick={() => useAppStore.getState().setShowProfileSettingsModal(true, 'connections')}
                  className="shrink-0 w-[100px] min-h-[88px] rounded-xl border border-dashed border-[#3AAFA9]/30 bg-[#0C0C0C]/50 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-[#00FFF0]/40 hover:text-[#00FFF0] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider font-medium">Connect</span>
                </button>
              ) : filteredElVoices.length === 0 ? (
                  <div className="shrink-0 w-[200px] min-h-[88px] rounded-xl border border-dashed border-[#3AAFA9]/20 bg-[#0C0C0C]/30 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <p className="text-xs text-gray-500">
                          {elVoiceTab === 'stock' ? 'No stock voices available.' : 'No clones found.'}
                      </p>
                      {elVoiceTab === 'cloned' && (
                          <p className="text-[10px] text-gray-600">
                              Create voices in ElevenLabs to use them here.
                          </p>
                      )}
                  </div>
              ) : (
                filteredElVoices.map((v) => (
                  <button
                    key={v.voice_id}
                    type="button"
                    onClick={() => {
                        setSelectedElVoiceId(v.voice_id)
                        setSelectedElVoiceSourceId(v.source_id)
                    }}
                    className={`shrink-0 w-[100px] min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors overflow-hidden relative ${
                      selectedElVoiceId === v.voice_id
                        ? 'bg-[#00FFF0]/10 border-[#00FFF0]/40 text-white'
                        : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-300 hover:border-[#3AAFA9]/40'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFF0]/20 to-[#3AAFA9]/20 flex items-center justify-center border border-[#00FFF0]/30 shrink-0">
                      <User className="w-4 h-4 text-[#00FFF0]" />
                    </div>
                    <span className="text-xs font-medium truncate w-full px-1 text-center" title={v.name}>{v.name}</span>
                    {v.preview_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-white/10 shrink-0 absolute top-1 right-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (playingElPreview === v.voice_id) {
                            setPlayingElPreview(null)
                            return
                          }
                          const audio = new Audio(v.preview_url!)
                          audio.onended = () => setPlayingElPreview(null)
                          audio.play()
                          setPlayingElPreview(v.voice_id)
                        }}
                      >
                        {playingElPreview === v.voice_id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </Button>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Voice Changer: unified target voice (ElevenLabs | My Cast) + recorder */}
        {model === 'voice-changer' && (
          <>
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-medium text-gray-400 uppercase">Target Voice</label>
              <div className="flex bg-[#0C0C0C] rounded-lg p-0.5 border border-[#3AAFA9]/20">
                <button
                  type="button"
                  onClick={() => setVoiceChangerSourceTab('elevenlabs')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                    voiceChangerSourceTab === 'elevenlabs' ? 'bg-[#3AAFA9]/20 text-[#00FFF0]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  ElevenLabs
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceChangerSourceTab('cast')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                    voiceChangerSourceTab === 'cast' ? 'bg-[#3AAFA9]/20 text-[#00FFF0]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  My Cast
                </button>
              </div>
              {voiceChangerSourceTab === 'elevenlabs' && elConnected && !elLoading && (
                <div className="flex bg-[#0C0C0C] rounded-lg p-0.5 border border-[#3AAFA9]/20 w-fit">
                  <button type="button" onClick={() => setElVoiceTab('stock')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${elVoiceTab === 'stock' ? 'bg-[#3AAFA9]/20 text-[#00FFF0]' : 'text-gray-500 hover:text-gray-300'}`}>Stock</button>
                  <button type="button" onClick={() => setElVoiceTab('cloned')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${elVoiceTab === 'cloned' ? 'bg-[#3AAFA9]/20 text-[#00FFF0]' : 'text-gray-500 hover:text-gray-300'}`}>Clones</button>
                </div>
              )}
              <div className="flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-[#3AAFA9]/30 scrollbar-track-transparent">
                {voiceChangerSourceTab === 'elevenlabs' ? (
                  <>
                    <button type="button" onClick={() => { setSelectedElVoiceId(''); setSelectedElVoiceSourceId(undefined) }} className={`shrink-0 w-[100px] min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors ${selectedElVoiceId === '' ? 'bg-[#00FFF0]/10 border-[#00FFF0]/40 text-white' : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/40 hover:text-gray-300'}`}>
                      <span className="text-[10px] uppercase tracking-wider font-medium">None</span>
                    </button>
                    {elLoading ? (
                      <div className="shrink-0 w-[100px] min-h-[88px] rounded-xl border border-[#3AAFA9]/20 bg-[#0C0C0C] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#00FFF0]" /></div>
                    ) : !elConnected ? (
                      <button type="button" onClick={() => useAppStore.getState().setShowProfileSettingsModal(true, 'connections')} className="shrink-0 w-[100px] min-h-[88px] rounded-xl border border-dashed border-[#3AAFA9]/30 bg-[#0C0C0C]/50 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-[#00FFF0]/40 hover:text-[#00FFF0] transition-colors">
                        <Plus className="w-5 h-5" /><span className="text-[10px] uppercase tracking-wider font-medium">Connect</span>
                      </button>
                    ) : (
                      <>
                        {filteredElVoices.map((v) => (
                          <button key={v.voice_id} type="button" onClick={() => { setSelectedElVoiceId(v.voice_id); setSelectedElVoiceSourceId(v.source_id) }} className={`shrink-0 w-[100px] min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors overflow-hidden relative ${selectedElVoiceId === v.voice_id ? 'bg-[#00FFF0]/10 border-[#00FFF0]/40 text-white' : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-300 hover:border-[#3AAFA9]/40'}`}>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFF0]/20 to-[#3AAFA9]/20 flex items-center justify-center border border-[#00FFF0]/30 shrink-0"><User className="w-4 h-4 text-[#00FFF0]" /></div>
                            <span className="text-xs font-medium truncate w-full px-1 text-center" title={v.name}>{v.name}</span>
                            {v.preview_url && <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-white/10 shrink-0 absolute top-1 right-1" onClick={(e) => { e.stopPropagation(); if (playingElPreview === v.voice_id) { setPlayingElPreview(null); return } const audio = new Audio(v.preview_url!); audio.onended = () => setPlayingElPreview(null); audio.play(); setPlayingElPreview(v.voice_id) }}>{playingElPreview === v.voice_id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</Button>}
                          </button>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setSelectedVoiceId('')} className={`shrink-0 w-[100px] min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors ${selectedVoiceId === '' ? 'bg-[#00FFF0]/10 border-[#00FFF0]/40 text-white' : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-400 hover:border-[#3AAFA9]/40 hover:text-gray-300'}`}>
                      <span className="text-[10px] uppercase tracking-wider font-medium">None</span>
                    </button>
                    {isLoadingVoices ? <div className="shrink-0 w-[100px] min-h-[88px] rounded-xl border border-[#3AAFA9]/20 bg-[#0C0C0C] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#00FFF0]" /></div> : userVoices.filter((v) => v.preview_url).map((voice) => (
                      <button key={voice.id} type="button" onClick={() => setSelectedVoiceId(voice.id)} className={`shrink-0 w-[100px] min-h-[88px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors overflow-hidden ${selectedVoiceId === voice.id ? 'bg-[#00FFF0]/10 border-[#00FFF0]/40 text-white' : 'bg-[#0C0C0C] border-[#3AAFA9]/20 text-gray-300 hover:border-[#3AAFA9]/40'}`}>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFF0]/20 to-[#3AAFA9]/20 flex items-center justify-center border border-[#00FFF0]/30 shrink-0"><User className="w-4 h-4 text-[#00FFF0]" /></div>
                        <span className="text-xs font-medium truncate w-full px-1 text-center" title={voice.name}>{voice.name}</span>
                        {voice.preview_url && <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-white/10 shrink-0" onClick={(e) => { e.stopPropagation(); handlePlayPreview(voice.preview_url, voice.id) }}>{playingPreview === voice.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</Button>}
                      </button>
                    ))}
                    <Link href="/dashboard/voices" target="_blank" className="shrink-0 w-[100px] min-h-[88px] rounded-xl border border-dashed border-[#3AAFA9]/30 bg-[#0C0C0C]/50 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-[#00FFF0]/40 hover:text-[#00FFF0] transition-colors">
                      <Plus className="w-5 h-5" /><span className="text-[10px] uppercase tracking-wider font-medium">Add</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Input Source</label>
              <div className="space-y-3 rounded-xl border border-[#3AAFA9]/20 bg-[#0C0C0C] p-4">
                <p className="text-xs text-gray-500">Record a clip to transform into the selected voice.</p>
                <div className="flex items-center gap-2">
                  {!isRecording ? (
                    <Button type="button" variant="outline" className="w-full border-[#3AAFA9]/30 hover:bg-[#3AAFA9]/10" onClick={startRecording} disabled={isVoiceChangerConverting}>
                      <Mic className="w-4 h-4 mr-2" />{recordingBlob ? 'Re-record (max 30s)' : 'Start Recording (max 30s)'}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" className="w-full border-red-500/50 hover:bg-red-500/10 text-red-400" onClick={stopRecording}>Stop Recording · {recordingSeconds}s</Button>
                  )}
                </div>
                {voiceChangerSourceTab === 'cast' && (
                  <Input placeholder="Transcript (optional — filled after conversion)" value={voiceChangerTranscript} onChange={(e) => setVoiceChangerTranscript(e.target.value)} className="bg-[#1E1F22] border-[#3AAFA9]/20 text-white text-sm" />
                )}
                {recordingBlob && (
                  <div className="text-xs text-[#00FFF0] flex items-center gap-2 bg-[#00FFF0]/10 p-2 rounded border border-[#00FFF0]/20">
                    <div className="w-2 h-2 rounded-full bg-[#00FFF0] animate-pulse" />Recording ready ({Math.ceil((recordingBlob?.size ?? 0) / 1024)} KB)
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Prompt Input — Type to speak */}
        {model !== 'voice-changer' && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase">
            {model === 'elevenlabs-music' || model === 'elevenlabs-sfx' ? 'Description' : 'Type to speak'}
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
        )}

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

        {/* Or say it in their voice (Dialogue only) */}
        {false && model === 'fal-f5-tts' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase">Or say it in their voice</label>
            <div className="space-y-3 rounded-xl border border-[#3AAFA9]/20 bg-[#0C0C0C] p-4">
            <p className="text-xs text-gray-500">Record a clip, then convert it to the selected character’s voice.</p>
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#3AAFA9]/30 hover:bg-[#3AAFA9]/10"
                  onClick={startRecording}
                  disabled={!canGenerateDialogue || isVoiceChangerConverting}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Record (max 30s)
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-500/50 hover:bg-red-500/10 text-red-400"
                  onClick={stopRecording}
                >
                  Stop · {recordingSeconds}s
                </Button>
              )}
            </div>
            <Input
              placeholder="Transcript (optional — filled after conversion)"
              value={voiceChangerTranscript}
              onChange={(e) => setVoiceChangerTranscript(e.target.value)}
              className="bg-[#1E1F22] border-[#3AAFA9]/20 text-white text-sm"
            />
            <Button
              type="button"
              onClick={handleVoiceChangerConvert}
              disabled={(!recordingBlob && !voiceChangerTranscript.trim()) || !canGenerateDialogue || isVoiceChangerConverting}
              className="w-full bg-[#3AAFA9] hover:bg-[#3AAFA9]/90 text-white"
            >
              {isVoiceChangerConverting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Converting…
                </>
              ) : (
                'Convert to character voice'
              )}
            </Button>
            </div>
          </div>
        )}

        {/* (Standalone STS block removed — use Voice Changer mode) */}
        {false && (model === 'elevenlabs-sts') && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase">Input Source</label>
            <div className="space-y-3 rounded-xl border border-[#3AAFA9]/20 bg-[#0C0C0C] p-4">
            <p className="text-xs text-gray-500">Record a clip to transform into the selected voice (STS).</p>
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[#3AAFA9]/30 hover:bg-[#3AAFA9]/10"
                  onClick={startRecording}
                  disabled={isVoiceChangerConverting}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  {recordingBlob ? 'Re-record (max 30s)' : 'Start Recording (max 30s)'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-red-500/50 hover:bg-red-500/10 text-red-400"
                  onClick={stopRecording}
                >
                  Stop Recording · {recordingSeconds}s
                </Button>
              )}
            </div>
            {recordingBlob && (
                <div className="text-xs text-[#00FFF0] flex items-center gap-2 bg-[#00FFF0]/10 p-2 rounded border border-[#00FFF0]/20">
                    <div className="w-2 h-2 rounded-full bg-[#00FFF0] animate-pulse" />
                    Recording ready ({Math.ceil((recordingBlob?.size ?? 0) / 1024)} KB)
                </div>
            )}
            </div>
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
                : model === 'voice-changer'
                ? "Transform your recorded voice into ElevenLabs or internal cast characters while keeping your emotion and pacing."
                : "Generates realistic voiceovers using ElevenLabs' advanced TTS model."}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#3AAFA9]/10 bg-[#0C0C0C]/50">
        <Button 
          onClick={handleGenerate}
          disabled={
              isGenerating || 
              isVoiceChangerConverting ||
              (model === 'voice-changer' && voiceChangerSourceTab === 'elevenlabs' && (!selectedElVoiceId || !recordingBlob)) ||
              (model === 'voice-changer' && voiceChangerSourceTab === 'cast' && (!(selectedVoiceId && selectedVoice?.preview_url) || (!recordingBlob && !voiceChangerTranscript.trim()))) ||
              ((model === 'elevenlabs-tts') && !selectedElVoiceId) ||
              (model !== 'voice-changer' && !prompt)
          }
          className="w-full bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
        >
          {isGenerating || isVoiceChangerConverting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {model === 'voice-changer' ? 'Transforming...' : 'Generating...'}
            </>
          ) : (
            <>
              {model === 'voice-changer' ? <RefreshCcw className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              {model === 'voice-changer' ? 'Transform Voice' : 'Generate Audio'}
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
