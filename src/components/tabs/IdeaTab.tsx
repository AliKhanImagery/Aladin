'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Sparkles, Users, Palette, Clock, Target, Square, Monitor, Smartphone } from 'lucide-react'
import { Scene, Clip } from '@/types'

export default function IdeaTab() {
  const { 
    currentProject, 
    updateProject, 
    setActiveTab, 
    addScene, 
    addClip,
    setGeneratingStory,
    setGenerationStatus,
    setGenerationProgress
  } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [targetRuntime, setTargetRuntime] = useState(60)
  const [tone, setTone] = useState('')
  const [brandCues, setBrandCues] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>(currentProject?.story?.aspectRatio || '16:9')

  // Update local state when project changes
  useEffect(() => {
    if (currentProject?.story?.aspectRatio) {
      setAspectRatio(currentProject.story.aspectRatio)
    } else if (currentProject) {
      // Set default if not present
      setAspectRatio('16:9')
      updateProject(currentProject.id, {
        story: {
          ...currentProject.story,
          aspectRatio: '16:9'
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, currentProject?.story?.aspectRatio])

  if (!currentProject) return null

  const handleAspectRatioChange = (ratio: '16:9' | '9:16' | '1:1') => {
    setAspectRatio(ratio)
    updateProject(currentProject.id, {
      story: {
        ...currentProject.story,
        aspectRatio: ratio
      }
    })
  }

  const handleGenerateStory = async () => {
    if (!currentProject?.story?.originalIdea?.trim()) {
      console.error('❌ Cannot generate: No original idea found', { currentProject })
      return
    }

    // Warn user if they have existing scenes/clips
    const hasExistingContent = currentProject.scenes && currentProject.scenes.length > 0
    if (hasExistingContent) {
      const confirmed = window.confirm(
        '⚠️ Warning: Generating a new story will delete all existing scenes and clips.\n\n' +
        `This will remove ${currentProject.scenes.length} scene(s) and all associated clips.\n\n` +
        'Are you sure you want to continue?'
      )
      if (!confirmed) {
        return
      }
    }
    
    console.log('🚀 Starting story generation...', { 
      projectId: currentProject.id,
      originalIdea: currentProject.story.originalIdea.substring(0, 50) + '...'
    })
    
    try {
      setIsGenerating(true)
      setGeneratingStory(true)
      setGenerationStatus('Analyzing your idea...')
      
      // Store the original idea locally to avoid stale reference issues
      const originalIdea = currentProject.story.originalIdea
      const projectId = currentProject.id
      const storyId = currentProject.story.id
      
      console.log('📝 Story generation params:', { projectId, storyId, originalIdeaLength: originalIdea.length })
      
      // Switch to Sequence tab to show generation in action
      setTimeout(() => {
        setActiveTab('sequence')
        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
      
      // Call OpenAI API for story generation
      setGenerationStatus('Calling Story Writer AI...')
      
      const storyResponse = await fetch('/api/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: originalIdea,
          tone: tone || undefined,
          brandCues: brandCues || undefined,
          targetRuntime,
        }),
      })

      if (!storyResponse.ok) {
        const errorData = await storyResponse.json()
        throw new Error(errorData.error || 'Failed to generate story')
      }

      const { data: storyData } = await storyResponse.json()
      
      console.log('✅ Story generated:', storyData)
      
      setGenerationStatus('Processing story structure...')

      // Update project with generated story
      const generatedStory = storyData.story || `Based on your idea: "${originalIdea}", here's a structured story.`
      
      updateProject(projectId, {
        story: {
          ...currentProject.story,
          generatedStory,
          targetRuntime,
          tone,
          brandCues: brandCues.split(',').map(cue => cue.trim()).filter(Boolean),
          aspectRatio: aspectRatio,
          rationale: 'AI-generated story structure based on your input idea'
        },
        scenes: [] // Clear existing scenes
      })

      // Switch to Sequence tab to show generation in action
      setTimeout(() => {
        setActiveTab('sequence')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100))

      // Process scenes from AI response
      const scenes = storyData.scenes || []
      const totalClips = scenes.reduce((sum: number, scene: any) => sum + (scene.clips?.length || 0), 0)
      
      setGenerationProgress({
        totalScenes: scenes.length,
        completedScenes: 0,
        totalClips: totalClips,
        completedClips: 0
      })

      // Generate scenes one by one from AI response
      for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
        const sceneData = scenes[sceneIndex]
        setGenerationStatus(`Creating Scene ${sceneIndex + 1}: ${sceneData.name}...`)
        
        const sceneId = crypto.randomUUID()
        const scene: Scene = {
          id: sceneId,
          storyId: storyId,
          order: sceneData.order || sceneIndex,
          name: sceneData.name || `Scene ${sceneIndex + 1}`,
          description: sceneData.description || '',
          type: (sceneData.type || 'establishing') as any,
          purpose: sceneData.purpose || '',
          duration: sceneData.duration || Math.floor(targetRuntime / scenes.length),
          style: {
            mood: tone || sceneData.mood || 'dramatic',
            lighting: 'natural',
            colorPalette: 'warm',
            cameraStyle: 'cinematic',
            postProcessing: []
          },
          wardrobe: [],
          location: `Location ${sceneIndex + 1}`,
          coverage: {
            sceneId: sceneId,
            requiredShots: [],
            completedShots: [],
            coverage: 0
          },
          clips: [],
          status: 'planned',
          locked: false
        }
        
        // Add scene
        console.log(`➕ Adding scene ${sceneIndex + 1}:`, { sceneId: scene.id, name: scene.name })
        addScene(scene)
        
        // Wait a bit for scene to be added
        await new Promise(resolve => setTimeout(resolve, 200))
        console.log(`✅ Scene ${sceneIndex + 1} added. Current scenes count should be ${sceneIndex + 1}`)
        
        const clipsInPreviousScenes = scenes.slice(0, sceneIndex).reduce((sum: number, s: any) => sum + (s.clips?.length || 0), 0)
        setGenerationProgress({
          totalScenes: scenes.length,
          completedScenes: sceneIndex + 1,
          totalClips: totalClips,
          completedClips: clipsInPreviousScenes
        })
        
        await new Promise(resolve => setTimeout(resolve, 400))

        // Process clips for this scene from AI response
        const sceneClips = sceneData.clips || []
        for (let clipIndex = 0; clipIndex < sceneClips.length; clipIndex++) {
          const clipData = sceneClips[clipIndex]
          setGenerationStatus(`Creating clip ${clipIndex + 1} of ${sceneClips.length} for Scene ${sceneIndex + 1}...`)
          
          // Optionally enhance clip prompts with Story Boarding Expert API
          let imagePrompt = clipData.imagePrompt || ''
          let videoPrompt = clipData.videoPrompt || ''
          
          // If prompts are basic, enhance them with Story Boarding Expert
          if (!imagePrompt || imagePrompt.length < 50) {
            try {
              const clipPromptResponse = await fetch('/api/generate-clip-prompts', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  sceneDescription: scene.description,
                  clipDescription: clipData.description || clipData.name,
                  storyContext: generatedStory,
                  tone: tone || undefined,
                  brandCues: brandCues || undefined,
                }),
              })

              if (clipPromptResponse.ok) {
                const { data: enhancedPrompts } = await clipPromptResponse.json()
                imagePrompt = enhancedPrompts.imagePrompt || imagePrompt
                videoPrompt = enhancedPrompts.videoPrompt || videoPrompt
              }
            } catch (err) {
              console.warn('Failed to enhance clip prompts:', err)
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 300))
          
          const clip: Clip = {
            id: crypto.randomUUID(),
            sceneId: sceneId,
            order: clipData.order || clipIndex,
            name: clipData.name || `Scene ${sceneIndex + 1} - Clip ${clipIndex + 1}`,
            imagePrompt: imagePrompt || `${originalIdea} - ${clipData.description || clipData.name}. ${tone ? `Tone: ${tone}.` : ''}`,
            videoPrompt: videoPrompt || `${originalIdea} - ${clipData.description || clipData.name}, dynamic motion. ${tone ? `Tone: ${tone}.` : ''}`,
            duration: 5,
            quality: 'standard',
            cameraPreset: {
              id: 'default',
              name: 'Default',
              description: clipData.cameraAngle || 'Standard framing',
              prompt: '',
              examples: []
            },
            framing: clipData.framing || clipData.cameraAngle || 'medium shot',
            characters: [],
            klingElements: [],
            status: 'pending',
            costEstimate: 0.5,
            actualCost: 0,
            version: 1,
            history: [],
            locked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastRendered: new Date()
          }
          
          // Add clip
          console.log(`➕ Adding clip ${clipIndex + 1}/${sceneClips.length} to scene ${sceneIndex + 1}:`, { 
            clipId: clip.id, 
            sceneId, 
            name: clip.name 
          })
          addClip(sceneId, clip)
          
          const currentCompletedClips = clipsInPreviousScenes + clipIndex + 1
          console.log(`✅ Clip ${clipIndex + 1}/${sceneClips.length} added to scene ${sceneIndex + 1}. Total clips: ${currentCompletedClips}/${totalClips}`)
          setGenerationProgress({
            totalScenes: scenes.length,
            completedScenes: sceneIndex + 1,
            totalClips: totalClips,
            completedClips: currentCompletedClips
          })
        }

        // Add characters if provided
        if (storyData.characters && storyData.characters.length > 0) {
          storyData.characters.forEach((charData: any) => {
            // Character addition logic would go here if needed
          })
        }
      }

      setGenerationStatus('Story pipeline generated successfully!')
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setGeneratingStory(false)
      setIsGenerating(false)
      setGenerationStatus('')
      setGenerationProgress({
        totalScenes: 0,
        completedScenes: 0,
        totalClips: 0,
        completedClips: 0
      })
    } catch (error) {
      console.error('Error generating story:', error)
      setGenerationStatus('Error generating story. Please try again.')
      setGeneratingStory(false)
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Story Development</h2>
        <p className="text-gray-400">
          Develop your idea into a structured story with scenes and characters
        </p>
      </div>

      {/* Original Idea */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#00FFF0]" />
          Your Original Idea
        </h3>
        <Textarea
          value={currentProject.story.originalIdea}
          onChange={(e) => updateProject(currentProject.id, {
            story: { ...currentProject.story, originalIdea: e.target.value }
          })}
          placeholder="Describe your scene, story, or concept..."
          className="w-full h-32 bg-[#0C0C0C] border-[#3AAFA9] text-white placeholder:text-gray-400 
                   focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/20 focus:outline-none
                   rounded-xl px-4 py-3 text-lg resize-none"
        />

        {/* Aspect Ratio Selector */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Aspect Ratio
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => handleAspectRatioChange('16:9')}
              className={`
                flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                ${aspectRatio === '16:9'
                  ? 'border-[#00FFF0] bg-[#00FFF0]/10'
                  : 'border-[#3AAFA9]/30 hover:border-[#3AAFA9] bg-[#0C0C0C]'
                }
              `}
            >
              <Monitor className={`w-6 h-6 ${aspectRatio === '16:9' ? 'text-[#00FFF0]' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${aspectRatio === '16:9' ? 'text-[#00FFF0]' : 'text-gray-400'}`}>
                16:9
              </span>
              <span className="text-xs text-gray-500">Landscape</span>
            </button>
            <button
              onClick={() => handleAspectRatioChange('9:16')}
              className={`
                flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                ${aspectRatio === '9:16'
                  ? 'border-[#00FFF0] bg-[#00FFF0]/10'
                  : 'border-[#3AAFA9]/30 hover:border-[#3AAFA9] bg-[#0C0C0C]'
                }
              `}
            >
              <Smartphone className={`w-6 h-6 ${aspectRatio === '9:16' ? 'text-[#00FFF0]' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${aspectRatio === '9:16' ? 'text-[#00FFF0]' : 'text-gray-400'}`}>
                9:16
              </span>
              <span className="text-xs text-gray-500">Portrait</span>
            </button>
            <button
              onClick={() => handleAspectRatioChange('1:1')}
              className={`
                flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                ${aspectRatio === '1:1'
                  ? 'border-[#00FFF0] bg-[#00FFF0]/10'
                  : 'border-[#3AAFA9]/30 hover:border-[#3AAFA9] bg-[#0C0C0C]'
                }
              `}
            >
              <Square className={`w-6 h-6 ${aspectRatio === '1:1' ? 'text-[#00FFF0]' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${aspectRatio === '1:1' ? 'text-[#00FFF0]' : 'text-gray-400'}`}>
                1:1
              </span>
              <span className="text-xs text-gray-500">Square</span>
            </button>
          </div>
        </div>
      </div>

      {/* Story Settings */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-[#1E1F22] rounded-xl p-4 border border-[#3AAFA9]/20">
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Target Runtime (seconds)
          </label>
          <Input
            type="number"
            value={targetRuntime}
            onChange={(e) => setTargetRuntime(Number(e.target.value))}
            className="bg-[#0C0C0C] border-[#3AAFA9] text-white"
          />
        </div>

        <div className="bg-[#1E1F22] rounded-xl p-4 border border-[#3AAFA9]/20">
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Tone & Mood
          </label>
          <Input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g., dramatic, comedic, mysterious"
            className="bg-[#0C0C0C] border-[#3AAFA9] text-white"
          />
        </div>

        <div className="bg-[#1E1F22] rounded-xl p-4 border border-[#3AAFA9]/20">
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Brand Cues
          </label>
          <Input
            value={brandCues}
            onChange={(e) => setBrandCues(e.target.value)}
            placeholder="e.g., modern, vintage, corporate"
            className="bg-[#0C0C0C] border-[#3AAFA9] text-white"
          />
        </div>
      </div>

      {/* Generate Button */}
      <div className="text-center">
        <Button
          onClick={handleGenerateStory}
          disabled={!currentProject.story.originalIdea.trim() || isGenerating}
          className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-8 py-3 rounded-xl
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Generating Story...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Story Structure
            </div>
          )}
        </Button>
      </div>

      {/* Generated Story */}
      {currentProject.story.generatedStory && (
        <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
          <h3 className="text-xl font-semibold text-white mb-4">Generated Story</h3>
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-gray-300 font-mono text-sm leading-relaxed">
              {currentProject.story.generatedStory}
            </pre>
          </div>
        </div>
      )}

      {/* Characters Section */}
      <div className="bg-[#1E1F22] rounded-2xl p-6 border border-[#3AAFA9]/20">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#00FFF0]" />
          Characters
        </h3>
        <p className="text-gray-400 mb-4">
          Characters will be automatically detected from your story. You can add face references later.
        </p>
        {currentProject.characters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No characters detected yet. Generate your story first.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {currentProject.characters.map((character) => (
              <div key={character.id} className="bg-[#0C0C0C] rounded-xl p-4">
                <h4 className="font-semibold text-white">{character.name}</h4>
                <p className="text-gray-400 text-sm">{character.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
