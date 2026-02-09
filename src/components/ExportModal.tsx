'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Download, X, Loader2, FileJson, Film, FileVideo, CheckCircle2, Clapperboard } from 'lucide-react'
import { Project, Clip, AudioTrack } from '@/types'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import toast from 'react-hot-toast'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project
  clips: Clip[]
}

const TIMELINE_VIDEO_WIDTH = 1920
const TIMELINE_VIDEO_HEIGHT = 1080
const TIMELINE_FPS = 30
const TIMELINE_VIDEO_BITRATE = 8_000_000 // 8 Mbps for 1080p

function getClipDurationSec(clip: Clip): number {
  const d = clip.duration ?? (clip as any).generationMetadata?.duration
  return typeof d === 'number' && d >= 1 && d <= 30 ? d : 5
}

export default function ExportModal({ isOpen, onClose, project, clips }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportTimelineStep, setExportTimelineStep] = useState<string | null>(null)
  const [timelineWebmFallback, setTimelineWebmFallback] = useState<{ blob: Blob; filename: string } | null>(null)

  if (!isOpen) return null

  // Export complete timeline as single video (clips in order; unrendered = placeholder)
  const handleExportTimelineVideo = async () => {
    if (!project || clips.length === 0) return
    setTimelineWebmFallback(null)
    setIsExporting(true)
    setExportTimelineStep('Preparing...')
    const toastId = toast.loading('Building timeline video...')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = TIMELINE_VIDEO_WIDTH
      canvas.height = TIMELINE_VIDEO_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')
      const stream = canvas.captureStream(TIMELINE_FPS)
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: TIMELINE_VIDEO_BITRATE,
        audioBitsPerSecond: 0,
      })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      recorder.start(200)

      const drawPlaceholder = (clip: Clip) => {
        ctx.fillStyle = '#0C0C0C'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(58, 175, 169, 0.2)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#888'
        ctx.font = '24px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(clip.name || 'Clip', canvas.width / 2, canvas.height / 2 - 20)
        ctx.font = '16px system-ui, sans-serif'
        ctx.fillText('Not rendered', canvas.width / 2, canvas.height / 2 + 20)
      }

      const drawImageForDuration = (url: string, durationMs: number): Promise<void> => {
        return new Promise((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            setTimeout(resolve, durationMs)
          }
          img.onerror = () => {
            drawPlaceholder({ name: 'Image failed', duration: 5 } as Clip)
            setTimeout(resolve, durationMs)
          }
          img.src = url
        })
      }

      const drawVideoForDuration = (url: string): Promise<void> => {
        return new Promise((resolve) => {
          const video = document.createElement('video')
          video.muted = true
          video.playsInline = true
          video.setAttribute('playsinline', '')
          video.crossOrigin = 'anonymous'
          video.preload = 'auto'
          const stopDrawing = () => {
            resolve()
          }
          const draw = () => {
            if (video.ended) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              stopDrawing()
              return
            }
            try {
              if (video.readyState >= 2) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              }
            } catch {
              // ignore single-frame errors
            }
            requestAnimationFrame(draw)
          }
          video.oncanplay = () => {
            video.currentTime = 0
            video.play().then(() => {
              draw()
            }).catch(() => {
              draw()
            })
          }
          video.onended = () => {
            // ensure last frame is drawn; draw loop will exit on next rAF
          }
          video.onerror = () => {
            drawPlaceholder({ name: 'Video failed', duration: 5 } as Clip)
            setTimeout(stopDrawing, 5000)
          }
          video.src = url
        })
      }

      const runPlaceholder = (clip: Clip, durationMs: number): Promise<void> => {
        return new Promise((resolve) => {
          drawPlaceholder(clip)
          setTimeout(resolve, durationMs)
        })
      }

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const durationSec = getClipDurationSec(clip)
        const durationMs = durationSec * 1000
        setExportTimelineStep(`Clip ${i + 1}/${clips.length}: ${(clip.name || 'Clip').slice(0, 20)}...`)
        if (clip.generatedVideo) {
          await drawVideoForDuration(clip.generatedVideo)
        } else if (clip.generatedImage) {
          await drawImageForDuration(clip.generatedImage, durationMs)
        } else {
          await runPlaceholder(clip, durationMs)
        }
      }

      recorder.stop()
      await new Promise<void>((r) => { recorder.onstop = () => r() })
      const webmBlob = new Blob(chunks, { type: mime })
      const sanitized = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project'

      setExportTimelineStep('Encoding MP4...')
      toast.loading('Encoding to MP4...', { id: toastId })
      let finalBlob: Blob = webmBlob
      let extension = 'webm'
      try {
        if (typeof SharedArrayBuffer === 'undefined') {
          throw new Error('MP4_UNAVAILABLE')
        }
        const { FFmpeg } = await import('@ffmpeg/ffmpeg')
        await import('@ffmpeg/util')
        const ffmpeg = new FFmpeg()
        await ffmpeg.load()
        await ffmpeg.writeFile('input.webm', new Uint8Array(await webmBlob.arrayBuffer()))
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18',
          '-movflags', '+faststart',
          'output.mp4'
        ])
        const mp4Data = await ffmpeg.readFile('output.mp4') as Uint8Array
        // Copy into a Blob-friendly buffer (avoids SharedArrayBuffer/ArrayBuffer type mismatch)
        finalBlob = new Blob([mp4Data.slice()], { type: 'video/mp4' })
        extension = 'mp4'
      } catch (encodeErr) {
        console.warn('MP4 encode failed:', encodeErr)
        setTimelineWebmFallback({ blob: webmBlob, filename: `${sanitized}_timeline.webm` })
        const msg = (encodeErr as Error)?.message === 'MP4_UNAVAILABLE'
          ? 'MP4 export isn’t supported in this browser. Try Chrome or Edge on desktop.'
          : 'MP4 encoding failed. Try another browser or download as WebM below.'
        toast.error(msg, { id: toastId, duration: 5000 })
      }

      if (extension === 'mp4') {
        saveAs(finalBlob, `${sanitized}_timeline.mp4`)
        toast.success('Timeline exported as MP4', { id: toastId })
        setExportTimelineStep(null)
        onClose()
      } else {
        setExportTimelineStep(null)
      }
    } catch (err: any) {
      console.error('Timeline export error:', err)
      toast.error(err?.message || 'Timeline export failed', { id: toastId })
      setExportTimelineStep(null)
    } finally {
      setIsExporting(false)
    }
  }

  // Helper: get file extension from URL for audio (default .mp3)
  function getAudioExtension(url: string): string {
    try {
      const path = new URL(url).pathname
      const match = path.match(/\.(mp3|wav|m4a|ogg|aac|webm)(?:\?|$)/i)
      return match ? match[1].toLowerCase() : 'mp3'
    } catch {
      return 'mp3'
    }
  }

  // Export to ZIP: clips (videos + images) + all audio (SFX, BG music, voiceover)
  const handleExportZip = async () => {
    if (!project) return

    const audioTracks: AudioTrack[] = project.timeline?.audioTracks ?? []
    const hasClipMedia = clips.some(c => c.generatedVideo || c.generatedImage)
    const hasAudio = audioTracks.some(t => t.clips?.some(c => c.assetUrl && c.status !== 'generating' && c.status !== 'failed'))
    if (!hasClipMedia && !hasAudio) {
      toast.error('No project media to export. Add clips or audio first.')
      return
    }

    setIsExporting(true)
    const toastId = toast.loading('Preparing project media for export...')

    try {
      const zip = new JSZip()
      const sanitizedProjectName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project'
      const root = zip.folder(sanitizedProjectName)
      if (!root) throw new Error('Failed to create zip folder')

      let processedCount = 0

      // --- Clips: videos in clips/, images in images/ ---
      const clipsFolder = root.folder('clips')
      const imagesFolder = root.folder('images')
      const exportableClips = clips.filter(c => c.generatedVideo || c.generatedImage)

      await Promise.all(exportableClips.map(async (clip, index) => {
        const safeClipName = (clip.name || `Clip${index}`).replace(/[^a-z0-9]/gi, '_')
        const prefix = `${String(index + 1).padStart(2, '0')}_${safeClipName}`

        if (clip.generatedVideo && clipsFolder) {
          try {
            const res = await fetch(clip.generatedVideo)
            if (!res.ok) return
            const blob = await res.blob()
            clipsFolder.file(`${prefix}.mp4`, blob)
            processedCount++
          } catch (err) {
            console.error(`Failed to export clip video ${clip.name}:`, err)
          }
        }
        if (clip.generatedImage && imagesFolder) {
          try {
            const res = await fetch(clip.generatedImage)
            if (!res.ok) return
            const blob = await res.blob()
            imagesFolder.file(`${prefix}.png`, blob)
            processedCount++
          } catch (err) {
            console.error(`Failed to export clip image ${clip.name}:`, err)
          }
        }
      }))

      // --- Audio: SFX, BG music, voiceover in audio/sfx, audio/bg_music, audio/voiceover ---
      const audioRoot = root.folder('audio')
      if (audioRoot && audioTracks.length > 0) {
        const sfxFolder = audioRoot.folder('sfx')
        const bgFolder = audioRoot.folder('bg_music')
        const voiceFolder = audioRoot.folder('voiceover')
        for (const track of audioTracks) {
          const sub = track.type === 'sfx' ? sfxFolder : track.type === 'bg_music' ? bgFolder : voiceFolder
          if (!sub || !track.clips?.length) continue
          let indexInTrack = 0
          for (const ac of track.clips) {
            if (!ac.assetUrl || ac.status === 'generating' || ac.status === 'failed') continue
            try {
              const res = await fetch(ac.assetUrl)
              if (!res.ok) continue
              const blob = await res.blob()
              const ext = getAudioExtension(ac.assetUrl)
              const safeName = (ac.name || `audio_${indexInTrack}`).replace(/[^a-z0-9]/gi, '_')
              sub.file(`${String(indexInTrack + 1).padStart(2, '0')}_${safeName}.${ext}`, blob)
              processedCount++
              indexInTrack++
            } catch (err) {
              console.error(`Failed to export audio ${ac.name}:`, err)
            }
          }
        }
      }

      if (processedCount === 0) {
        throw new Error('Could not download any assets. Links may have expired.')
      }

      toast.loading('Compressing archive...', { id: toastId })
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${sanitizedProjectName}_export.zip`)
      toast.success(`Exported ${processedCount} assets successfully!`, { id: toastId })
      onClose()
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(`Export failed: ${error.message}`, { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#020617]/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-[#0C0C0C] w-full max-w-2xl rounded-2xl border border-[#3AAFA9]/20 shadow-2xl flex flex-col overflow-hidden relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#3AAFA9]/10 bg-[#1E1F22]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00FFF0]/10 border border-[#00FFF0]/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-[#00FFF0]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Export Project</h2>
              <p className="text-xs text-gray-400">Download your project assets and metadata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ZIP Export (Working) */}
            <div 
              className={`
                group relative p-5 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden
                ${isExporting 
                  ? 'bg-[#00FFF0]/5 border-[#00FFF0]/30' 
                  : 'bg-[#1E1F22]/30 border-[#3AAFA9]/10 hover:bg-[#1E1F22] hover:border-[#00FFF0]/50 hover:shadow-lg hover:shadow-[#00FFF0]/5'}
              `}
              onClick={!isExporting ? handleExportZip : undefined}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#00FFF0]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  {isExporting && !exportTimelineStep ? <Loader2 className="w-5 h-5 text-[#00FFF0] animate-spin" /> : <Film className="w-5 h-5 text-[#00FFF0]" />}
                </div>
                {isExporting && !exportTimelineStep && <span className="text-[10px] bg-[#00FFF0]/20 text-[#00FFF0] px-2 py-1 rounded-full font-medium">Processing</span>}
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#00FFF0] transition-colors">Asset Archive (ZIP)</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Download all project media as a .zip: clip videos, images, SFX, and background audio in organized folders.
              </p>
              
              <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>Clips, images, SFX & BG audio</span>
              </div>
            </div>

            {/* Timeline as single video */}
            <div
              className={`
                group relative p-5 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden
                ${isExporting
                  ? 'bg-[#00FFF0]/5 border-[#00FFF0]/30'
                  : 'bg-[#1E1F22]/30 border-[#3AAFA9]/10 hover:bg-[#1E1F22] hover:border-[#00FFF0]/50 hover:shadow-lg hover:shadow-[#00FFF0]/5'}
              `}
              onClick={!isExporting ? handleExportTimelineVideo : undefined}
            >
              <div className="absolute top-3 right-3 z-10">
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full font-bold uppercase tracking-wider" title="Export quality and performance may vary">Beta</span>
              </div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#00FFF0]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  {isExporting && exportTimelineStep ? <Loader2 className="w-5 h-5 text-[#00FFF0] animate-spin" /> : <Clapperboard className="w-5 h-5 text-[#00FFF0]" />}
                </div>
                {isExporting && exportTimelineStep && <span className="text-[10px] bg-[#00FFF0]/20 text-[#00FFF0] px-2 py-1 rounded-full font-medium truncate max-w-[120px]" title={exportTimelineStep}>{exportTimelineStep}</span>}
              </div>
              <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#00FFF0] transition-colors">Complete Timeline (1 Video)</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Stitch all clips in order into one MP4. Rendered clips are included; unrendered clips appear as placeholders. Encoded as H.264 MP4 when available.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>All clips in order</span>
              </div>
            </div>

            {/* FCPXML (Placeholder) */}
            <div className="group relative p-5 rounded-xl border border-[#3AAFA9]/10 bg-[#1E1F22]/30 opacity-60 cursor-not-allowed">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <FileVideo className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-full font-medium">Coming Soon</span>
              </div>
              <h3 className="text-lg font-bold text-gray-400 mb-1">Final Cut Pro (XML)</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Export timeline structure for editing in Final Cut Pro X.
              </p>
            </div>

            {/* AAF (Placeholder) */}
            <div className="group relative p-5 rounded-xl border border-[#3AAFA9]/10 bg-[#1E1F22]/30 opacity-60 cursor-not-allowed">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <FileVideo className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-full font-medium">Coming Soon</span>
              </div>
              <h3 className="text-lg font-bold text-gray-400 mb-1">Premiere Pro (AAF)</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Export timeline sequence for Adobe Premiere Pro.
              </p>
            </div>

            {/* JSON (Placeholder) */}
            <div className="group relative p-5 rounded-xl border border-[#3AAFA9]/10 bg-[#1E1F22]/30 opacity-60 cursor-not-allowed">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <FileJson className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-full font-medium">Coming Soon</span>
              </div>
              <h3 className="text-lg font-bold text-gray-400 mb-1">Raw Data (JSON)</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Export full project data structure in JSON format.
              </p>
            </div>

          </div>
        </div>

        {/* MP4 unavailable: offer WebM download */}
        {timelineWebmFallback && (
          <div className="px-6 pb-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-amber-200/90">
                MP4 wasn’t available. You can download the timeline as WebM here, or try Chrome/Edge on desktop for MP4.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20 shrink-0"
                onClick={() => {
                  if (!timelineWebmFallback) return
                  saveAs(timelineWebmFallback.blob, timelineWebmFallback.filename)
                  setTimelineWebmFallback(null)
                  toast.success('Downloaded as WebM')
                }}
              >
                Download as WebM instead
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-[#1E1F22]/30 border-t border-[#3AAFA9]/10 flex justify-end">
          <Button 
            variant="ghost" 
            onClick={() => { setTimelineWebmFallback(null); onClose() }}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
