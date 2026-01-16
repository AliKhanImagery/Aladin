'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Sparkles, 
  Users, 
  Palette, 
  Clock, 
  Target, 
  Square, 
  Monitor, 
  Smartphone,
  Package,
  MapPin,
  CheckCircle2,
  Image as ImageIcon,
  ChevronRight,
  Layers,
  Layout
} from 'lucide-react'
import { Scene, Clip, IdeaAnalysis, AssetContext } from '@/types'
import IdeaAnalysisScreen from '@/components/IdeaAnalysisScreen'
import toast from 'react-hot-toast'

// Helper function to derive color palette from brand cues (legacy - kept for fallback)
function deriveColorPalette(brandCues: string[]): string {
  const cues = brandCues.map(c => c.toLowerCase()).join(' ')
  
  if (cues.includes('warm') || cues.includes('sunset') || cues.includes('golden')) {
    return 'warm'
  }
  if (cues.includes('cool') || cues.includes('ocean') || cues.includes('blue')) {
    return 'cool'
  }
  if (cues.includes('vibrant') || cues.includes('colorful')) {
    return 'vibrant'
  }
  return 'warm'
}

// AI-Powered visual style generation function
async function generateVisualStyle(
  brandCues: string[],
  tone: string[],
  sceneType: string,
  sceneOrder: number,
  totalScenes: number,
  clipOrder: number,
  totalClipsInScene: number,
  scenePurpose: string
) {
  try {
    const response = await fetch('/api/generate-visual-style', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brandCues,
        tone,
        sceneType,
        sceneOrder,
        totalScenes,
        clipOrder,
        totalClipsInScene,
        scenePurpose
      }),
    })

    if (!response.ok) {
      console.warn('AI style generation failed, using fallback')
      return {
        mood: tone.join(', ') || 'dramatic',
        lighting: 'natural',
        colorPalette: deriveColorPalette(brandCues),
        cameraStyle: 'cinematic',
        postProcessing: []
      }
    }

    const { data } = await response.json()
    return data.style
  } catch (error) {
    console.warn('AI style generation error, using fallback:', error)
    return {
      mood: tone.join(', ') || 'dramatic',
      lighting: 'natural',
      colorPalette: deriveColorPalette(brandCues),
      cameraStyle: 'cinematic',
      postProcessing: []
    }
  }
}

// Helper function to match assets to clip based on description (legacy - kept for fallback)
function matchAssetsToClip(clipDescription: string, assetContext: AssetContext) {
  const lowerDescription = clipDescription.toLowerCase()
  
  const matchedCharacters = assetContext.characters.filter(char => 
    lowerDescription.includes(char.name.toLowerCase()) ||
    (char.role === 'protagonist' && (
      lowerDescription.includes('he ') || 
      lowerDescription.includes('she ') || 
      lowerDescription.includes('they ') ||
      lowerDescription.includes('the protagonist') ||
      lowerDescription.includes('the main character')
    ))
  )

  // If still no characters and only one character exists, match them for any action
  if (matchedCharacters.length === 0 && assetContext.characters.length === 1) {
    matchedCharacters.push(assetContext.characters[0])
  }
  
  return {
    characters: matchedCharacters,
    products: assetContext.products.filter(product => 
      lowerDescription.includes(product.name.toLowerCase())
    ),
    locations: assetContext.locations.filter(location => 
      lowerDescription.includes(location.name.toLowerCase())
    )
  }
}

// AI-Powered character matching function
async function matchAssetsToClipAI(
  clipDescription: string,
  clipOrder: number,
  sceneDescription: string,
  sceneOrder: number,
  storyContext: string,
  assetContext: AssetContext,
  allClipsInScene: any[]
) {
  try {
    const response = await fetch('/api/match-characters-to-clips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storyContext,
        sceneDescription,
        clipDescription,
        clipOrder,
        sceneOrder,
        allClipsInScene,
        assetContext
      }),
    })

    if (!response.ok) {
      console.warn('AI character matching failed, falling back to simple matching')
      return matchAssetsToClip(clipDescription, assetContext)
    }

    const { matchedCharacters, matchedProducts, matchedLocations } = await response.json()
    
    return {
      characters: matchedCharacters || [],
      products: matchedProducts || [],
      locations: matchedLocations || []
    }
  } catch (error) {
    console.warn('AI character matching error, falling back to simple matching:', error)
    return matchAssetsToClip(clipDescription, assetContext)
  }
}

// Helper function to generate project name from idea
function generateProjectNameFromIdea(idea: string): string {
  if (!idea || !idea.trim()) return 'Untitled Production'
  
  // Take first 50 chars or first sentence
  const firstSentence = idea.split(/[.!?]/)[0].trim()
  if (firstSentence.length > 0 && firstSentence.length <= 50) {
    return firstSentence
  }
  
  // Otherwise take first 50 chars
  const truncated = idea.substring(0, 50).trim()
  // Remove trailing incomplete words
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > 30) {
    return truncated.substring(0, lastSpace)
  }
  return truncated
}

export default function IdeaTab() {
  const { 
    currentProject, 
    updateProject, 
    setActiveTab, 
    addScene, 
    addClip,
    updateClip,
    setGeneratingStory,
    setGenerationStatus,
    setGenerationProgress,
    setClipGeneratingStatus
  } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [targetRuntime, setTargetRuntime] = useState(currentProject?.story?.targetRuntime || 60)
  const [tone, setTone] = useState(currentProject?.story?.tone || '')
  const [brandCues, setBrandCues] = useState(
    Array.isArray(currentProject?.story?.brandCues) 
      ? currentProject.story.brandCues.join(', ') 
      : (typeof currentProject?.story?.brandCues === 'string' ? currentProject.story.brandCues : '')
  )
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>(currentProject?.story?.aspectRatio || '16:9')
  const [showAnalysisScreen, setShowAnalysisScreen] = useState(false)
  const [ideaAnalysis, setIdeaAnalysis] = useState<IdeaAnalysis | null>(null)
  const [assetContext, setAssetContext] = useState<AssetContext | null>(null)
  
  // Track previous idea to detect changes
  const previousIdeaRef = useRef<string>('')

  // Update local state when project changes
  useEffect(() => {
    if (currentProject?.story?.aspectRatio) {
      setAspectRatio(currentProject.story.aspectRatio)
    } else if (currentProject) {
      setAspectRatio('16:9')
      updateProject(currentProject.id, {
        story: { ...currentProject.story, aspectRatio: '16:9' }
      })
    }
    
    if (currentProject?.story?.targetRuntime !== undefined) {
      setTargetRuntime(currentProject.story.targetRuntime)
    }
    
    if (currentProject?.story?.tone) {
      setTone(currentProject.story.tone)
    }
    
    if (currentProject?.story?.brandCues) {
      if (Array.isArray(currentProject.story.brandCues)) {
        setBrandCues(currentProject.story.brandCues.join(', '))
      } else if (typeof currentProject.story.brandCues === 'string') {
        setBrandCues(currentProject.story.brandCues)
      }
    }
    
    if (currentProject?.assetContext) {
      setAssetContext(currentProject.assetContext)
    }
    
    if (currentProject?.story?.originalIdea) {
      previousIdeaRef.current = currentProject.story.originalIdea
    }
  }, [currentProject, updateProject])
  
  // Auto-update project name when idea changes
  useEffect(() => {
    if (!currentProject?.story?.originalIdea) return
    const currentIdea = currentProject.story.originalIdea.trim()
    const previousIdea = previousIdeaRef.current.trim()
    
    if (currentIdea !== previousIdea && currentIdea.length > 0) {
      const newProjectName = generateProjectNameFromIdea(currentIdea)
      if (newProjectName !== currentProject.name && newProjectName !== 'Untitled Production') {
        updateProject(currentProject.id, { name: newProjectName })
      }
      previousIdeaRef.current = currentIdea
    }
  }, [currentProject?.story?.originalIdea, currentProject?.id, currentProject?.name, updateProject])

  if (!currentProject) return null

  const handleContinueFromAnalysis = async (confirmedAssetContext: AssetContext) => {
    if (!currentProject || !ideaAnalysis) return
    toast.dismiss()

    setAssetContext(confirmedAssetContext)
    setShowAnalysisScreen(false)
    updateProject(currentProject.id, { assetContext: confirmedAssetContext })

    try {
      setIsGenerating(true)
      setGeneratingStory(true)
      setGenerationStatus('Constructing Production Blueprint...')
      
      const originalIdea = currentProject.story.originalIdea
      const projectId = currentProject.id
      const storyId = currentProject.story.id
      
      setTimeout(() => {
        setActiveTab('sequence')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
      
      setGenerationStatus('Consulting Production AI...')
      
      const storyResponse = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: originalIdea,
          tone: confirmedAssetContext.settings.tone,
          brandCues: confirmedAssetContext.settings.brandCues,
          targetRuntime,
          assetContext: confirmedAssetContext,
        }),
      })

      if (!storyResponse.ok) {
        const errorData = await storyResponse.json()
        throw new Error(errorData.error || 'Failed to construct blueprint')
      }

      const { data: storyData } = await storyResponse.json()
      setGenerationStatus('Mapping sequence orchestration...')

      const generatedStory = storyData.story || `Blueprint for: "${originalIdea}"`
      
      updateProject(projectId, {
        story: {
          ...currentProject.story,
          generatedStory,
          targetRuntime,
          tone: confirmedAssetContext.settings.tone.join(', '),
          brandCues: confirmedAssetContext.settings.brandCues,
          aspectRatio: aspectRatio,
          rationale: 'AI-constructed production blueprint'
        },
        scenes: [],
        assetContext: confirmedAssetContext
      })

      const scenes = storyData.scenes || []
      const totalClips = scenes.reduce((sum: number, scene: any) => sum + (scene.clips?.length || 0), 0)
      
      setGenerationProgress({
        totalScenes: scenes.length,
        completedScenes: 0,
        totalClips: totalClips,
        completedClips: 0
      })

      for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
        const sceneData = scenes[sceneIndex]
        setGenerationStatus(`Directing Scene ${sceneIndex + 1}: ${sceneData.name}...`)
        
        const sceneStyle = await generateVisualStyle(
          confirmedAssetContext.settings.brandCues,
          confirmedAssetContext.settings.tone,
          sceneData.type || 'establishing',
          sceneIndex + 1,
          scenes.length,
          1,
          1,
          sceneData.purpose || ''
        )
        
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
            mood: sceneStyle.mood || confirmedAssetContext.settings.tone.join(', ') || 'professional',
            lighting: sceneStyle.lighting || 'natural',
            colorPalette: typeof sceneStyle.colorPalette === 'string' 
              ? sceneStyle.colorPalette 
              : sceneStyle.colorPalette?.description || deriveColorPalette(confirmedAssetContext.settings.brandCues) || 'warm',
            cameraStyle: sceneStyle.cameraStyle || 'cinematic',
            postProcessing: sceneStyle.postProcessing || [],
            visualTreatment: sceneStyle.visualTreatment,
            atmosphere: sceneStyle.atmosphere
          } as any,
          wardrobe: [],
          location: `Location ${sceneIndex + 1}`,
          coverage: { sceneId, requiredShots: [], completedShots: [], coverage: 0 },
          clips: [],
          status: 'planned',
          locked: false
        }
        
        addScene(scene)
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const clipsInPreviousScenes = scenes.slice(0, sceneIndex).reduce((sum: number, s: any) => sum + (s.clips?.length || 0), 0)
        setGenerationProgress({
          totalScenes: scenes.length,
          completedScenes: sceneIndex + 1,
          totalClips: totalClips,
          completedClips: clipsInPreviousScenes
        })
        
        await new Promise(resolve => setTimeout(resolve, 400))

        const sceneClips = sceneData.clips || []
        let previousClipVelocity: string | null = null // Track kinetic handshake between clips
        for (let clipIndex = 0; clipIndex < sceneClips.length; clipIndex++) {
          const clipData = sceneClips[clipIndex]
          setGenerationStatus(`Orchestrating clip ${clipIndex + 1}/${sceneClips.length}...`)
          
          const matchedAssets = await matchAssetsToClipAI(
            clipData.description || clipData.name,
            clipIndex + 1,
            scene.description,
            sceneIndex + 1,
            generatedStory,
            confirmedAssetContext,
            sceneClips.map((c: any) => ({ description: c.description, name: c.name }))
          )
          
          // Extract narrative role from clipData (from story generation)
          const narrativeRole = clipData.narrative_role || 
            (clipIndex === 0 ? 'Hook' : 
             clipIndex === sceneClips.length - 1 ? 'Peak' : 
             'Escalation')
          
          let imagePrompt = clipData.imagePrompt || clipData.flux_image_prompt || ''
          let videoPrompt = clipData.videoPrompt || clipData.kling_motion_prompt || ''
          
          if (!imagePrompt || imagePrompt.length < 100) {
            try {
              const clipPromptResponse: Response = await fetch('/api/generate-clip-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sceneDescription: scene.description,
                  clipDescription: clipData.description || clipData.name,
                  storyContext: generatedStory,
                  tone: confirmedAssetContext.settings.tone,
                  brandCues: confirmedAssetContext.settings.brandCues,
                  sceneStyle: scene.style,
                  assetContext: matchedAssets,
                  imageModel: currentProject?.settings.imageModel || 'flux-2-pro',
                  narrativeRole: narrativeRole,
                  previousClipVelocity: previousClipVelocity
                }),
              })

              if (clipPromptResponse.ok) {
                const { data: enhancedPrompts }: { data: any } = await clipPromptResponse.json()
                // Handle both old and new field names for backward compatibility
                imagePrompt = enhancedPrompts.imagePrompt || enhancedPrompts.flux_image_prompt || imagePrompt
                videoPrompt = enhancedPrompts.videoPrompt || enhancedPrompts.kling_motion_prompt || videoPrompt
                
                // Log if we got prompts
                if (imagePrompt && imagePrompt.length > 100) {
                  console.log(`✅ Enhanced prompts received for clip ${clipIndex + 1}:`, {
                    imagePromptLength: imagePrompt.length,
                    videoPromptLength: videoPrompt.length
                  })
                } else {
                  console.warn(`⚠️ Enhanced prompts too short or missing for clip ${clipIndex + 1}:`, {
                    imagePromptLength: imagePrompt?.length || 0,
                    hasImagePrompt: !!enhancedPrompts.imagePrompt,
                    hasFluxImagePrompt: !!enhancedPrompts.flux_image_prompt
                  })
                }
                
                // Update previousClipVelocity for next clip's kinetic handshake
                if (enhancedPrompts.kineticHandshake) {
                  previousClipVelocity = enhancedPrompts.kineticHandshake
                }
              } else {
                const errorData = await clipPromptResponse.json().catch(() => ({}))
                console.error(`❌ Failed to enhance clip prompts for clip ${clipIndex + 1}:`, errorData)
              }
            } catch (err) {
              console.warn('Failed to enhance clip prompts:', err)
            }
          } else {
            // If using prompts from story generation, extract kinetic handshake from visual_continuity
            if (clipData.visual_continuity && clipData.visual_continuity.includes('velocity') || clipData.visual_continuity.includes('speed') || clipData.visual_continuity.includes('momentum')) {
              // Try to extract velocity description from visual_continuity
              const velocityMatch = clipData.visual_continuity.match(/(?:velocity|speed|momentum|walking|running|sprinting|turning|moving)[^.]*\.?/i)
              if (velocityMatch) {
                previousClipVelocity = velocityMatch[0].trim()
              }
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 300))
          
          const referenceImageUrls: string[] = []
          const assetsWithUrls = {
            characters: matchedAssets.characters.filter((char: any) => char.assetUrl).map((char: any) => ({
              id: char.id, name: char.name, assetUrl: char.assetUrl!, appearanceDetails: char.appearanceDetails
              })),
            products: matchedAssets.products.filter((product: any) => product.assetUrl).map((product: any) => ({
              id: product.id, name: product.name, assetUrl: product.assetUrl!, visualFocus: product.visualFocus
              })),
            locations: matchedAssets.locations.filter((location: any) => location.assetUrl).map((location: any) => ({
              id: location.id, name: location.name, assetUrl: location.assetUrl!
              }))
          }
          
          assetsWithUrls.characters.forEach((char: any) => referenceImageUrls.push(char.assetUrl))
          assetsWithUrls.products.forEach((product: any) => referenceImageUrls.push(product.assetUrl))
          assetsWithUrls.locations.forEach((location: any) => referenceImageUrls.push(location.assetUrl))
          
          if (referenceImageUrls.length > 10) referenceImageUrls.length = 10
          
          const shouldUseRemix = referenceImageUrls.length > 0
          const characterReferences = matchedAssets.characters.map((char: any) => ({
            characterId: char.id, role: char.role, faceRefId: undefined, assetUrl: char.assetUrl, appearanceDetails: char.appearanceDetails
          }))
          
          // Extract videoEngine and duration from story generation (Aladin Pro Dynamic Pacing)
          const videoEngine = clipData.video_engine || clipData.videoEngine || 'kling' // Default to kling if not specified
          const clipDuration = clipData.duration || 5 // Use duration from story generation (1-5s for LTX/Kling routing)
          
          const clip: Clip = {
            id: crypto.randomUUID(),
            sceneId: sceneId,
            order: clipData.order || clipIndex,
            name: clipData.name || `Scene ${sceneIndex + 1} - Clip ${clipIndex + 1}`,
            imagePrompt: imagePrompt || clipData.flux_image_prompt || `${originalIdea} - ${clipData.description || clipData.name}`,
            videoPrompt: videoPrompt || clipData.kling_motion_prompt || `${originalIdea} - ${clipData.description || clipData.name}`,
            duration: clipDuration, // Preserve duration from story generation (1-5s for dynamic pacing)
            quality: 'standard',
            cameraPreset: { id: 'default', name: 'Default', description: clipData.cameraAngle || clipData.cameraMovement || 'Standard framing', prompt: '', examples: [] },
            framing: clipData.framing || clipData.cameraAngle || 'medium shot',
            characters: characterReferences,
            klingElements: [],
            status: 'pending',
            costEstimate: 0.5,
            actualCost: 0,
            version: 1,
            history: [],
            locked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastRendered: new Date(),
            generationMetadata: {
              shouldUseRemix,
              referenceImageUrls,
              assetContext: assetsWithUrls,
              narrativeRole: narrativeRole,
              cameraMovement: clipData.cameraMovement,
              kineticHandshake: previousClipVelocity || undefined,
              videoEngine: videoEngine, // Store videoEngine (kling|ltx) for dynamic routing
              duration: clipDuration // Store duration for video generation
            }
          }
          
          addClip(sceneId, clip)
          const currentCompletedClips = clipsInPreviousScenes + clipIndex + 1
          setGenerationProgress({
            totalScenes: scenes.length,
            completedScenes: sceneIndex + 1,
            totalClips: totalClips,
            completedClips: currentCompletedClips
          })
        }
      }

      setGenerationStatus('Production blueprint constructed successfully!')
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const latestProject = useAppStore.getState().currentProject
      if (latestProject && !latestProject.settings.dontGenerateImages) {
        setGenerationStatus('Launching parallel image orchestration...')
        
        const allClips: Array<{ clip: Clip; sceneId: string }> = []
        latestProject.scenes.forEach((scene) => {
          scene.clips.forEach((clip) => {
            // Check for both old and new field names
            const hasImagePrompt = clip.imagePrompt && clip.imagePrompt.trim().length > 0
            if (hasImagePrompt && !clip.generatedImage) {
              allClips.push({ clip, sceneId: scene.id })
            } else if (!hasImagePrompt) {
              console.warn(`⚠️ Clip "${clip.name}" has no imagePrompt, skipping image generation`, {
                clipId: clip.id,
              hasImagePrompt: !!clip.imagePrompt,
                imagePromptLength: clip.imagePrompt?.length || 0
            })
            }
          })
        })
        
      console.log(`🖼️ Found ${allClips.length} clips ready for image generation`)
      
        if (allClips.length > 0) {
          allClips.forEach(({ clip }) => setClipGeneratingStatus(clip.id, 'image'))
          
          const imageGenerationPromises = allClips.map(async ({ clip }, index) => {
            const clipId = clip.id
              const metadata = clip.generationMetadata
            const referenceImageUrls = metadata?.referenceImageUrls || []
            const hasReferenceImages = referenceImageUrls.length > 0 && referenceImageUrls.every((url: string) => url && url.trim().length > 0)
            
            // Use 'edit' mode (FLUX.2 Pro) for multi-image consistency, 'text-to-image' otherwise
            // 'edit' mode supports up to 10 reference images for better consistency
            const generationMode = hasReferenceImages ? 'edit' : 'text-to-image'
            
            try {
              // Ensure we have a valid prompt (check both old and new field names)
              const imagePromptToUse = clip.imagePrompt || (clip as any).flux_image_prompt
              if (!imagePromptToUse || imagePromptToUse.trim().length === 0) {
                console.error(`❌ [${index + 1}/${allClips.length}] No image prompt found for "${clip.name}"`, {
                  clipId: clip.id,
                  hasImagePrompt: !!clip.imagePrompt,
                  hasFluxImagePrompt: !!(clip as any).flux_image_prompt,
                  clipData: Object.keys(clip)
                })
                throw new Error('Image prompt is required for generation')
              }
              
              // Enhanced prompt with STRONG consistency instructions
              let enhancedPrompt = imagePromptToUse.trim()
                if (metadata?.assetContext) {
                  const consistencyInstructions: string[] = []
                  
                // Add STRONG character consistency instructions
                  if (metadata.assetContext.characters.length > 0) {
                  metadata.assetContext.characters.forEach((char: any) => {
                      if (char.assetUrl) {
                      consistencyInstructions.push(
                        `CRITICAL: ${char.name.toUpperCase()} MUST match the reference image EXACTLY - same face, same features, same appearance, same build, same skin tone, same hair, same eyes. The reference image is provided and must be followed precisely.`
                      )
                    }
                  })
                  }
                  
                // Add product consistency instructions
                  if (metadata.assetContext.products.length > 0) {
                  metadata.assetContext.products.forEach((product: any) => {
                      if (product.assetUrl) {
                      consistencyInstructions.push(
                        `PRODUCT: ${product.name.toUpperCase()} must match reference exactly in shape, color, and design.`
                        )
                    }
                  })
                      }
                
                  if (consistencyInstructions.length > 0) {
                    enhancedPrompt = consistencyInstructions.join(' ') + '. ' + enhancedPrompt
                  }
                  
                // Prompt is now clean and preserves the Kinetic Workflow structure
                // No additional wrapping needed - the prompt from AI is already properly structured
              }
              
              // Final mode determination - if edit mode but no valid URLs, fallback to text-to-image
              let finalMode = generationMode
              const validReferenceUrls = referenceImageUrls.filter((url: string) => 
                url && typeof url === 'string' && url.trim().length > 0 && url.startsWith('http')
              )
              
              if (generationMode === 'edit' && validReferenceUrls.length === 0) {
                console.warn(`⚠️ [${index + 1}/${allClips.length}] Edit mode requested but no valid reference URLs, falling back to text-to-image`)
                finalMode = 'text-to-image'
              }
              
              console.log(`🖼️ [${index + 1}/${allClips.length}] Generating image for "${clip.name}"`, {
                mode: finalMode,
                hasReferenceImages: validReferenceUrls.length > 0,
                validReferenceCount: validReferenceUrls.length,
                promptLength: enhancedPrompt.length,
                promptPreview: enhancedPrompt.substring(0, 100) + '...'
              })
                
                // Determine final image model (can be overridden by product focus)
                let finalImageModel = latestProject.settings.imageModel || 'flux-2-pro'
                
                // Check for Nano Banana override (Product Focus)
                // We check if ANY product in this clip is marked as 'primary' visual focus
                const primaryProduct = metadata?.assetContext?.products?.find((p: any) => p.visualFocus === 'primary');
                if (primaryProduct) {
                   console.log(`🍌 [${index + 1}/${allClips.length}] Primary Product detected (${primaryProduct.name}). Switching to Nano Banana.`);
                   finalImageModel = 'nano-banana';
                }

                const requestPayload: any = {
                mode: finalMode,
                  prompt: enhancedPrompt,
                  aspect_ratio: latestProject.story.aspectRatio || '16:9',
                project_id: latestProject.id,
                clip_id: clipId,
                imageModel: finalImageModel, // Pass the dynamic model selection
                }
                
              // Add reference images for edit mode (FLUX.2 Pro supports multiple images)
              // Only add if we have valid reference images
              if (finalMode === 'edit' && validReferenceUrls.length > 0) {
                requestPayload.reference_image_urls = validReferenceUrls.slice(0, 10) // FLUX.2 Pro max is 10
                console.log(`📎 [${index + 1}/${allClips.length}] Using ${validReferenceUrls.length} reference images for FLUX.2 Pro`)
              } else if (finalMode === 'text-to-image') {
                // Ensure no reference images are sent for text-to-image mode
                console.log(`📝 [${index + 1}/${allClips.length}] Using text-to-image mode (no reference images)`)
              }
              
              // Get session token for authentication
              // Wrap in try-catch to handle any auth errors gracefully
              let headers: HeadersInit = { 'Content-Type': 'application/json' }
              try {
                const { supabase } = await import('@/lib/supabase')
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()
                if (sessionError) {
                  console.warn(`⚠️ [${index + 1}/${allClips.length}] Session error for "${clip.name}":`, sessionError.message)
                }
                if (session?.access_token) {
                  headers['Authorization'] = `Bearer ${session.access_token}`
                }
              } catch (authError: any) {
                // Handle auth errors gracefully - don't block image generation
                // If auth fails, the API will handle it and return appropriate error
                console.warn(`⚠️ [${index + 1}/${allClips.length}] Auth error for "${clip.name}":`, authError.message)
              }
              
              const response = await fetch('/api/generate-image-remix', {
                  method: 'POST',
                headers,
                  body: JSON.stringify(requestPayload),
                })
                
              if (!response.ok) {
                let errorMessage = 'Unknown error'
                try {
                  const errorData = await response.json()
                  errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`
                  console.error(`❌ [${index + 1}/${allClips.length}] Image generation failed for "${clip.name}"`, {
                    status: response.status,
                    error: errorMessage,
                    details: errorData
                })
              } catch (parseError) {
                  errorMessage = `HTTP ${response.status}: ${response.statusText}`
                  console.error(`❌ [${index + 1}/${allClips.length}] Image generation failed for "${clip.name}"`, {
                    status: response.status,
                    error: errorMessage
                  })
                }
                throw new Error(errorMessage)
              }

              const responseData = await response.json()
              const imageUrl = responseData.imageUrl || responseData.image_url || responseData.url
              
              if (!imageUrl) {
                console.error(`❌ [${index + 1}/${allClips.length}] No image URL in response for "${clip.name}"`, responseData)
                throw new Error('No image URL returned from API')
              }
              
              // API now handles storage automatically - check if storage succeeded
              if (responseData.storageSuccess) {
                console.log(`✅ [${index + 1}/${allClips.length}] Image generated and stored in Supabase Storage for "${clip.name}"`, {
                  imageUrl: imageUrl.substring(0, 50) + '...',
                  storagePath: responseData.storagePath,
                  model: responseData.model
                })
              } else if (responseData.fallbackUrl) {
                console.warn(`⚠️ [${index + 1}/${allClips.length}] Image generated but storage failed, using Fal.ai URL as fallback for "${clip.name}"`, {
                  imageUrl: imageUrl.substring(0, 50) + '...',
                  warning: 'Image URL is temporary (7-day expiry)'
                })
              } else {
                console.log(`✅ [${index + 1}/${allClips.length}] Image generated successfully for "${clip.name}"`, {
                  imageUrl: imageUrl.substring(0, 50) + '...',
                  model: responseData.model
                })
              }
              
              updateClip(clipId, { generatedImage: imageUrl, previewImage: imageUrl, status: 'completed' })
              
              // Note: API now handles storage automatically - no need for client-side saveUserImage() call
            } catch (err: any) {
              const errorMessage = err?.message || 'Unknown error'
              console.error(`❌ [${index + 1}/${allClips.length}] Image generation error for "${clip.name}":`, {
                  error: errorMessage,
                clipId,
                mode: generationMode,
                hasReferenceImages
          })
          
              // Update clip with pending status (will retry later)
              updateClip(clipId, { 
                status: 'pending'
              })
              
              // Show toast for user feedback
              toast.error(`Failed to generate image for "${clip.name}": ${errorMessage}`, {
                duration: 5000
              })
            } finally {
              setClipGeneratingStatus(clipId, null)
            }
          })
          
          await Promise.all(imageGenerationPromises)
          setGenerationStatus('Production assets deployed!')
          
          const { user, saveProjectNow, currentProject: finalState } = useAppStore.getState()
          if (user?.id && finalState) await saveProjectNow(finalState.id, true)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      setGeneratingStory(false)
      setIsGenerating(false)
      setGenerationStatus('')
    } catch (error) {
      console.error('Error constructing blueprint:', error)
      setGenerationStatus('Blueprint construction failed. Re-initialize.')
      setGeneratingStory(false)
      setIsGenerating(false)
    }
  }

  const handleAspectRatioChange = (ratio: '16:9' | '9:16' | '1:1') => {
    setAspectRatio(ratio)
    updateProject(currentProject.id, { story: { ...currentProject.story, aspectRatio: ratio } })
  }

  const handleGenerateStory = async () => {
    if (!currentProject?.story?.originalIdea?.trim()) {
      toast.error('Define your concept before blueprinting.')
      return
    }
    
    if (currentProject.scenes?.length > 0) {
      if (!window.confirm('Constructing a new blueprint will override existing sequences. Continue?')) return
    }
    
    const loadingToast = toast.loading('Blueprint Analysis...')
    try {
      setIsGenerating(true)
      setGeneratingStory(true)
      setGenerationStatus('Analysis in progress...')
      
      const analysisResponse = await fetch('/api/analyze-idea-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: currentProject.story.originalIdea,
          tone: tone || undefined,
          brandCues: brandCues || undefined,
        }),
      })

      if (!analysisResponse.ok) throw new Error('Analysis failed')

      const responseData = await analysisResponse.json()
      const analysisData = responseData.data || responseData
      
        toast.dismiss(loadingToast)
      toast.success('Blueprint analysis complete.')
      
      setIdeaAnalysis(analysisData)
      setShowAnalysisScreen(true)
      setIsGenerating(false)
      setGeneratingStory(false)
      setGenerationStatus('')
    } catch (error: any) {
      toast.dismiss(loadingToast)
      toast.error(error.message || 'Analysis failed.')
      setGenerationStatus('')
      setGeneratingStory(false)
      setIsGenerating(false)
    }
  }

  if (showAnalysisScreen && ideaAnalysis) {
  return (
      <IdeaAnalysisScreen
        analysis={ideaAnalysis}
        onContinue={handleContinueFromAnalysis}
        onBack={() => {
          setShowAnalysisScreen(false)
          setIdeaAnalysis(null)
          setIsGenerating(false)
          setGeneratingStory(false)
          setGenerationStatus('')
        }}
      />
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold text-white tracking-tight">Project Idea</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Define your concept and visual parameters to generate your storyboard.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Concept Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl p-8 border-white/5 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <Layers className="w-5 h-5 text-brand-emerald" />
              Project Concept
        </h3>
        <Textarea
          value={currentProject.story.originalIdea}
          onChange={(e) => updateProject(currentProject.id, {
            story: { ...currentProject.story, originalIdea: e.target.value }
          })}
              placeholder="Describe your scene, story, or concept in detail..."
              className="w-full h-48 bg-brand-obsidian/40 border-white/10 text-white placeholder:text-gray-600 
                       focus:border-brand-emerald/40 focus:ring-1 focus:ring-brand-emerald/20
                       rounded-2xl px-6 py-4 text-lg resize-none transition-all duration-300 shadow-inner"
        />
        
            <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
          <Checkbox
            id="dont-generate-images-idea"
            checked={currentProject.settings.dontGenerateImages || false}
            onChange={(e) => updateProject(currentProject.id, {
              settings: { ...currentProject.settings, dontGenerateImages: e.target.checked }
            })}
                  className="border-white/20"
          />
                <label htmlFor="dont-generate-images-idea" className="text-sm font-medium text-gray-400 cursor-pointer">
                  Technical Blueprint Only (No Images)
          </label>
        </div>

            <Button
              onClick={handleGenerateStory}
              disabled={!currentProject.story.originalIdea.trim() || isGenerating}
              className="btn-primary min-w-[240px] h-14 rounded-2xl flex items-center justify-center gap-3 text-lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-brand-obsidian/30 border-t-brand-obsidian rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Storyboard
                </>
              )}
            </Button>
          </div>
        </div>

          {/* Blueprint Output */}
          {currentProject.story.generatedStory && (
            <div className="glass-panel rounded-3xl p-8 border-white/5 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-6">Active Production Blueprint</h3>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-gray-400 font-mono text-sm leading-relaxed p-6 bg-brand-obsidian/50 rounded-2xl border border-white/5">
                  {currentProject.story.generatedStory}
                </pre>
              </div>
            </div>
          )}
      </div>

        {/* Studio Settings */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-8">
            <h3 className="text-lg font-bold text-white px-2">Studio Parameters</h3>
            
            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Runtime
          </label>
              <div className="relative">
          <Input
            type="number"
            value={targetRuntime}
            onChange={(e) => setTargetRuntime(Number(e.target.value))}
                  className="bg-brand-obsidian/40 border-white/10 text-white rounded-xl h-12 pl-4 pr-12 focus:border-brand-emerald/40"
          />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">SEC</span>
              </div>
        </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <Palette className="w-4 h-4" /> Visual Atmosphere
              </label>
              <p className="px-2 text-xs text-gray-500 leading-relaxed">
                Defines the emotional mood and lighting (e.g., &apos;Cinematic&apos;, &apos;Dark&apos;, &apos;Energetic&apos;).
              </p>
          <Input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. Cinematic, Noir, Vibrant"
                className="bg-brand-obsidian/40 border-white/10 text-white rounded-xl h-12 px-4 focus:border-brand-emerald/40"
          />
        </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <Target className="w-4 h-4" /> Identity Cues
              </label>
              <p className="px-2 text-xs text-gray-500 leading-relaxed">
                Defines the stylistic vibe and aesthetic (e.g., &apos;Minimalist&apos;, &apos;Luxury&apos;). NOT for physical dimensions.
              </p>
          <Input
            value={brandCues}
            onChange={(e) => setBrandCues(e.target.value)}
                placeholder="e.g. Modern, Minimalist"
                className="bg-brand-obsidian/40 border-white/10 text-white rounded-xl h-12 px-4 focus:border-brand-emerald/40"
          />
      </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <Layout className="w-4 h-4" /> Frame Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => handleAspectRatioChange(ratio)}
                    className={`h-12 rounded-xl text-xs font-bold border transition-all ${
                      aspectRatio === ratio 
                        ? 'bg-brand-emerald/10 border-brand-emerald/40 text-brand-emerald' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
            </div>
            </div>
      </div>

          {/* Asset Context Summary */}
          {(assetContext || currentProject.assetContext) && (
            <div className="glass-card rounded-3xl p-6 animate-fade-in">
              <h3 className="text-lg font-bold text-white px-2 mb-6 flex items-center justify-between">
                Deployed Assets
                <span className="text-[10px] bg-brand-emerald/10 text-brand-emerald px-2 py-1 rounded-full border border-brand-emerald/20 uppercase tracking-tighter">
                  Active
                </span>
        </h3>
              
              <div className="space-y-3">
                {['characters', 'products', 'locations'].map((type) => {
                  const items = (assetContext || currentProject.assetContext)?.[type as keyof AssetContext] as any[]
                  if (!items?.length) return null
                  const Icon = type === 'characters' ? Users : type === 'products' ? Package : MapPin
                  
                  return (
                    <div key={type} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div className="w-8 h-8 rounded-lg bg-brand-emerald/10 flex items-center justify-center text-brand-emerald">
                        <Icon className="w-4 h-4" />
          </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white capitalize">{type}</p>
                        <p className="text-[10px] text-gray-500">{items.length} assets mapped</p>
        </div>
          </div>
                  )
                })}
              </div>
          </div>
        )}
            </div>
      </div>
    </div>
  )
}
