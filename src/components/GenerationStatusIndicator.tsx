'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Sparkles, CheckCircle2 } from 'lucide-react'

export default function GenerationStatusIndicator() {
  const { 
    isGeneratingStory, 
    generationStatus, 
    generationProgress,
    setGeneratingStory,
    setGenerationStatus,
    setGenerationProgress,
  } = useAppStore()

  const { totalScenes, completedScenes, totalClips, completedClips } = generationProgress
  const sceneProgress = totalScenes > 0 ? (completedScenes / totalScenes) * 100 : 0
  const clipProgress = totalClips > 0 ? (completedClips / totalClips) * 100 : 0
  const overallProgress = totalScenes > 0
    ? (
        totalClips > 0 
          ? ((completedScenes / totalScenes) * 50 + (completedClips / totalClips) * 50)
          : (completedScenes / totalScenes) * 100
      )
    : 0

  // Safety net: auto-dismiss the pipeline toast once everything reaches 100%
  useEffect(() => {
    if (!isGeneratingStory) return

    const scenesDone = totalScenes > 0 && completedScenes >= totalScenes
    const clipsDone = totalClips === 0 || (totalClips > 0 && completedClips >= totalClips)

    if (scenesDone && clipsDone) {
      const timer = setTimeout(() => {
        // In case the main generator forgot to clear, we hard-reset here
        setGeneratingStory(false)
        setGenerationStatus('')
        setGenerationProgress({
          totalScenes: 0,
          completedScenes: 0,
          totalClips: 0,
          completedClips: 0,
        })
      }, 1500) // small delay so user can see 100% state

      return () => clearTimeout(timer)
    }
  }, [
    isGeneratingStory,
    totalScenes,
    completedScenes,
    totalClips,
    completedClips,
    setGeneratingStory,
    setGenerationStatus,
    setGenerationProgress,
  ])

  if (!isGeneratingStory) return null

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 
                    bg-[#1E1F22] border border-[#00FFF0]/30 rounded-2xl p-6 
                    shadow-2xl backdrop-blur-sm min-w-[400px] max-w-[500px] animate-in slide-in-from-top-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Sparkles className="w-6 h-6 text-[#00FFF0] animate-pulse" />
          <div className="absolute inset-0 bg-[#00FFF0]/20 rounded-full blur-md animate-ping" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Generating Story Pipeline</h3>
          <p className="text-sm text-gray-400">{generationStatus}</p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Overall Progress</span>
          <span className="text-xs font-semibold text-[#00FFF0]">{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-[#0C0C0C] rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#00FFF0] to-[#3AAFA9] rounded-full transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${overallProgress}%` }}
          >
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              style={{
                animation: 'shimmer 2s infinite linear',
                backgroundSize: '200% 100%'
              }}
            />
          </div>
        </div>
      </div>

      {/* Scene Progress */}
      {totalScenes > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <CheckCircle2 className={`w-3 h-3 ${completedScenes === totalScenes ? 'text-green-400' : 'text-gray-500'}`} />
              Scenes: {completedScenes}/{totalScenes}
            </span>
            <span className="text-xs text-gray-400">{Math.round(sceneProgress)}%</span>
          </div>
          <div className="w-full bg-[#0C0C0C] rounded-full h-1.5">
            <div 
              className="h-full bg-[#00FFF0] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${sceneProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Clip Progress */}
      {totalClips > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Sparkles className={`w-3 h-3 ${completedClips === totalClips ? 'text-[#00FFF0]' : 'text-gray-500'}`} />
              Clips: {completedClips}/{totalClips}
            </span>
            <span className="text-xs text-gray-400">{Math.round(clipProgress)}%</span>
          </div>
          <div className="w-full bg-[#0C0C0C] rounded-full h-1.5">
            <div 
              className="h-full bg-[#00FFF0] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${clipProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Pulse animation overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#00FFF0]/0 via-[#00FFF0]/5 to-[#00FFF0]/0 animate-pulse pointer-events-none" />
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  )
}

