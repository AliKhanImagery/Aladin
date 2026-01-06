'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, Users, Palette, Clock, Target, Square, Monitor, Smartphone } from 'lucide-react'
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
  
  return {
    characters: assetContext.characters.filter(char => 
      lowerDescription.includes(char.name.toLowerCase())
    ),
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
  if (!idea || !idea.trim()) return 'Untitled Project'
  
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
  const [targetRuntime, setTargetRuntime] = useState(60)
  const [tone, setTone] = useState('')
  const [brandCues, setBrandCues] = useState('')
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
      // Set default if not present
      setAspectRatio('16:9')
      updateProject(currentProject.id, {
        story: {
          ...currentProject.story,
          aspectRatio: '16:9'
        }
      })
    }
    
    // Initialize previous idea ref
    if (currentProject?.story?.originalIdea) {
      previousIdeaRef.current = currentProject.story.originalIdea
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, currentProject?.story?.aspectRatio])
  
  // Auto-update project name when idea changes
  useEffect(() => {
    if (!currentProject?.story?.originalIdea) return
    
    const currentIdea = currentProject.story.originalIdea.trim()
    const previousIdea = previousIdeaRef.current.trim()
    
    // Only update if idea actually changed and has meaningful content
    if (currentIdea !== previousIdea && currentIdea.length > 0) {
      const newProjectName = generateProjectNameFromIdea(currentIdea)
      
      // Only update if the new name is different from current name
      // and the new name is meaningful (not just "Untitled Project")
      if (newProjectName !== currentProject.name && newProjectName !== 'Untitled Project') {
        console.log('📝 Auto-updating project name from idea:', {
          oldName: currentProject.name,
          newName: newProjectName,
          ideaPreview: currentIdea.substring(0, 50) + '...'
        })
        
        updateProject(currentProject.id, {
          name: newProjectName
        })
      }
      
      // Update the ref
      previousIdeaRef.current = currentIdea
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.story?.originalIdea, currentProject?.id, currentProject?.name])

  if (!currentProject) return null

  // Handle continue from analysis screen
  const handleContinueFromAnalysis = async (confirmedAssetContext: AssetContext) => {
    if (!currentProject || !ideaAnalysis) return

    // Dismiss any existing toasts before starting story generation
    toast.dismiss()

    setAssetContext(confirmedAssetContext)
    setShowAnalysisScreen(false)
    
    // Store asset context in project
    updateProject(currentProject.id, {
      assetContext: confirmedAssetContext
    })

    try {
      setIsGenerating(true)
      setGeneratingStory(true)
      setGenerationStatus('Generating story structure...')
      
      const originalIdea = currentProject.story.originalIdea
      const projectId = currentProject.id
      const storyId = currentProject.story.id
      
      // Switch to Sequence tab to show generation in action
      setTimeout(() => {
        setActiveTab('sequence')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
      
      // Call OpenAI API for story generation with asset context
      setGenerationStatus('Calling Story Writer AI...')
      
      const storyResponse = await fetch('/api/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
          tone: confirmedAssetContext.settings.tone.join(', '),
          brandCues: confirmedAssetContext.settings.brandCues,
          aspectRatio: aspectRatio,
          rationale: 'AI-generated story structure based on your input idea'
        },
        scenes: [], // Clear existing scenes
        assetContext: confirmedAssetContext // Store asset context
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
        
        // Generate unique visual style for this scene using AI
        setGenerationStatus(`Generating unique visual style for Scene ${sceneIndex + 1}...`)
        const sceneStyle = await generateVisualStyle(
          confirmedAssetContext.settings.brandCues,
          confirmedAssetContext.settings.tone,
          sceneData.type || 'establishing',
          sceneIndex + 1,
          scenes.length,
          1, // clipOrder (not used for scene-level style)
          1, // totalClipsInScene (not used for scene-level style)
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
            mood: sceneStyle.mood || confirmedAssetContext.settings.tone.join(', ') || 'dramatic',
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
          
          // Use AI-powered character matching for better accuracy
          setGenerationStatus(`Matching characters to clip ${clipIndex + 1}...`)
          const matchedAssets = await matchAssetsToClipAI(
            clipData.description || clipData.name,
            clipIndex + 1,
            scene.description,
            sceneIndex + 1,
            generatedStory,
            confirmedAssetContext,
            sceneClips.map((c: any) => ({ description: c.description, name: c.name }))
          )
          
          console.log(`🎯 AI-matched assets for clip ${clipIndex + 1}:`, {
            characters: matchedAssets.characters.map((c: any) => ({ name: c.name, confidence: c.confidence, reason: c.matchReason })),
            products: matchedAssets.products.length,
            locations: matchedAssets.locations.length
          })
          
          // Optionally enhance clip prompts with Story Boarding Expert API
          let imagePrompt = clipData.imagePrompt || ''
          let videoPrompt = clipData.videoPrompt || ''
          
          // Always enhance prompts with Story Boarding Expert for maximum quality
          // Enhanced prompts are much more detailed and production-ready (150-250 words)
          // Enhance if prompt is missing or too short
          if (!imagePrompt || imagePrompt.length < 100) {
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
                  tone: confirmedAssetContext.settings.tone,
                  brandCues: confirmedAssetContext.settings.brandCues,
                  sceneStyle: scene.style,
                  assetContext: matchedAssets, // Use AI-matched assets
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
          
          // Collect reference image URLs from matched assets with PRIORITY ORDERING
          // Priority: Characters (highest) -> Products -> Locations (lowest)
          // This ensures facial consistency gets maximum attention from FLUX.2 Pro
          const referenceImageUrls: string[] = []
          const assetsWithUrls = {
            characters: matchedAssets.characters
              .filter(char => char.assetUrl)
              .map(char => ({
                id: char.id,
                name: char.name,
                assetUrl: char.assetUrl!,
                appearanceDetails: char.appearanceDetails
              })),
            products: matchedAssets.products
              .filter(product => product.assetUrl)
              .map(product => ({
                id: product.id,
                name: product.name,
                assetUrl: product.assetUrl!
              })),
            locations: matchedAssets.locations
              .filter(location => location.assetUrl)
              .map(location => ({
                id: location.id,
                name: location.name,
                assetUrl: location.assetUrl!
              }))
          }
          
          // Collect URLs in PRIORITY ORDER (characters first for facial consistency)
          // FLUX.2 Pro can handle up to 10 reference images, so we prioritize:
          // 1. All character reference images (most critical for consistency)
          // 2. Product reference images (important for brand consistency)
          // 3. Location reference images (environmental consistency)
          assetsWithUrls.characters.forEach(char => referenceImageUrls.push(char.assetUrl))
          assetsWithUrls.products.forEach(product => referenceImageUrls.push(product.assetUrl))
          assetsWithUrls.locations.forEach(location => referenceImageUrls.push(location.assetUrl))
          
          // Limit to 10 reference images (FLUX.2 Pro maximum)
          // If we exceed, prioritize characters (most important for facial consistency)
          if (referenceImageUrls.length > 10) {
            const characterUrls = assetsWithUrls.characters.map(c => c.assetUrl)
            const productUrls = assetsWithUrls.products.map(p => p.assetUrl)
            const locationUrls = assetsWithUrls.locations.map(l => l.assetUrl)
            
            // Prioritize: all characters, then products, then locations (up to 10 total)
            referenceImageUrls.length = 0 // Clear array
            referenceImageUrls.push(...characterUrls.slice(0, 10))
            const remaining = 10 - referenceImageUrls.length
            if (remaining > 0) {
              referenceImageUrls.push(...productUrls.slice(0, remaining))
            }
            const stillRemaining = 10 - referenceImageUrls.length
            if (stillRemaining > 0) {
              referenceImageUrls.push(...locationUrls.slice(0, stillRemaining))
            }
          }
          
          // Determine if remix should be used
          const shouldUseRemix = referenceImageUrls.length > 0
          
          // Create character references from matched characters
          const characterReferences = matchedAssets.characters.map(char => ({
            characterId: char.id,
            role: char.role,
            faceRefId: undefined,
            assetUrl: char.assetUrl,
            appearanceDetails: char.appearanceDetails
          }))
          
          const clip: Clip = {
            id: crypto.randomUUID(),
            sceneId: sceneId,
            order: clipData.order || clipIndex,
            name: clipData.name || `Scene ${sceneIndex + 1} - Clip ${clipIndex + 1}`,
            imagePrompt: imagePrompt || `${originalIdea} - ${clipData.description || clipData.name}. ${confirmedAssetContext.settings.tone.join(', ')}`,
            videoPrompt: videoPrompt || `${originalIdea} - ${clipData.description || clipData.name}, dynamic motion. ${confirmedAssetContext.settings.tone.join(', ')}`,
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
            // Add generation metadata for automatic remix mode
            generationMetadata: {
              shouldUseRemix,
              referenceImageUrls,
              assetContext: assetsWithUrls
            }
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
      
      // Continue with image generation (existing code continues...)
      // Auto-generate images for all clips if dontGenerateImages is false
      const latestProject = useAppStore.getState().currentProject
      console.log('🔍 Checking if auto-image generation is needed...', {
        hasProject: !!latestProject,
        dontGenerateImages: latestProject?.settings?.dontGenerateImages,
        scenesCount: latestProject?.scenes?.length || 0
      })
      
      if (latestProject && !latestProject.settings.dontGenerateImages) {
        console.log('✅ Auto-image generation enabled, starting process...')
        setGenerationStatus('Starting image generation for all clips...')
        
        // Get all clips from all scenes that need images
        const allClips: Array<{ clip: Clip; sceneId: string }> = []
        latestProject.scenes.forEach((scene, sceneIndex) => {
          console.log(`📋 Scanning scene ${sceneIndex + 1}: "${scene.name}" (${scene.clips.length} clips)`)
          scene.clips.forEach((clip, clipIndex) => {
            const needsImage = clip.imagePrompt && !clip.generatedImage
            console.log(`  📎 Clip ${clipIndex + 1}: "${clip.name}"`, {
              hasImagePrompt: !!clip.imagePrompt,
              hasGeneratedImage: !!clip.generatedImage,
              needsImage,
              promptPreview: clip.imagePrompt?.substring(0, 50) + '...' || 'N/A'
            })
            if (needsImage) {
              allClips.push({ clip, sceneId: scene.id })
            }
          })
        })
        
        console.log(`📊 Image generation summary:`, {
          totalClipsFound: allClips.length,
          clips: allClips.map(({ clip, sceneId }) => ({
            clipId: clip.id,
            clipName: clip.name,
            sceneId,
            promptLength: clip.imagePrompt?.length || 0
          }))
        })
        
        if (allClips.length === 0) {
          console.log('✅ No clips need image generation - all clips already have images or no prompts')
        } else {
          console.log(`🖼️ Starting parallel image generation for ${allClips.length} clips...`)
          console.log(`⚙️ Configuration:`, {
            aspectRatio: latestProject.story.aspectRatio || '16:9',
            timeout: '120 seconds per image',
            mode: 'parallel (all at once)'
          })
          
          // Set generating status for ALL clips immediately
          console.log('📝 Setting generating status for all clips...')
          allClips.forEach(({ clip }) => {
            setClipGeneratingStatus(clip.id, 'image')
            console.log(`  ✓ Status set: "${clip.name}" → Generating image`)
          })
          
          setGenerationStatus(`Generating ${allClips.length} images in parallel...`)
          console.log('🚀 All image generation requests starting now...')
          
          // Generate all images in parallel
          const startTime = Date.now()
          const imageGenerationPromises = allClips.map(async ({ clip }, index) => {
            const clipName = clip.name
            const clipId = clip.id
            const requestStartTime = Date.now()
            
            try {
              // Determine generation mode based on clip metadata
              const metadata = clip.generationMetadata
              const shouldUseRemix = metadata?.shouldUseRemix && metadata.referenceImageUrls.length > 0
              const generationMode = shouldUseRemix ? 'remix' : 'text-to-image'
              const referenceUrls = metadata?.referenceImageUrls || []
              
              console.log(`\n🖼️ [${index + 1}/${allClips.length}] Starting image generation for clip: "${clipName}"`, {
                clipId,
                mode: generationMode,
                hasAssets: referenceUrls.length > 0,
                promptLength: clip.imagePrompt?.length || 0,
                promptPreview: clip.imagePrompt?.substring(0, 100) + '...' || 'N/A',
                aspectRatio: latestProject.story.aspectRatio || '16:9'
              })
              
              // Create AbortController for timeout
              const controller = new AbortController()
              const timeoutId = setTimeout(() => {
                console.warn(`⏱️ [${index + 1}/${allClips.length}] Timeout triggered for "${clipName}" after 120 seconds`)
                controller.abort()
              }, 120000) // 2 minute timeout
              
              let imageResponse
              try {
                // Sophisticated prompt enhancement for human-replacing realistic consistency
                let enhancedPrompt = clip.imagePrompt || ''
                
                if (metadata?.assetContext) {
                  const consistencyInstructions: string[] = []
                  const assetDetails: string[] = []
                  
                  // PRIORITY 1: Characters - Explicit facial consistency instructions
                  if (metadata.assetContext.characters.length > 0) {
                    const characterInstructions: string[] = []
                    metadata.assetContext.characters.forEach(char => {
                      if (char.assetUrl) {
                        // CRITICAL: Explicit instruction for facial consistency
                        characterInstructions.push(
                          `MAINTAIN THE EXACT FACIAL FEATURES, PHYSICAL LIKENESS, AND APPEARANCE OF ${char.name.toUpperCase()} as shown in the reference image. This is CRITICAL for character consistency. Do not alter their face, body type, or distinctive features.`
                        )
                        if (char.appearanceDetails) {
                          characterInstructions.push(
                            `Additional appearance details for ${char.name}: ${char.appearanceDetails}`
                          )
                        }
                      } else if (char.appearanceDetails) {
                        // Fallback: Use appearance details if no reference image
                        characterInstructions.push(
                          `${char.name} appearance: ${char.appearanceDetails}`
                        )
                      }
                    })
                    
                    if (characterInstructions.length > 0) {
                      consistencyInstructions.push(...characterInstructions)
                      assetDetails.push(`Characters present: ${metadata.assetContext.characters.map(c => c.name).join(', ')}`)
                    }
                  }
                  
                  // PRIORITY 2: Products/Objects - Exact product consistency
                  if (metadata.assetContext.products.length > 0) {
                    const productInstructions: string[] = []
                    metadata.assetContext.products.forEach(product => {
                      if (product.assetUrl) {
                        productInstructions.push(
                          `DEPICT ${product.name.toUpperCase()} PRECISELY AS SHOWN IN THE REFERENCE IMAGE, maintaining its exact design, color, branding, and physical characteristics. This is CRITICAL for product consistency.`
                        )
                      } else {
                        productInstructions.push(`Product: ${product.name}`)
                      }
                    })
                    
                    if (productInstructions.length > 0) {
                      consistencyInstructions.push(...productInstructions)
                      assetDetails.push(`Products present: ${metadata.assetContext.products.map(p => p.name).join(', ')}`)
                    }
                  }
                  
                  // PRIORITY 3: Locations - Environmental consistency
                  if (metadata.assetContext.locations.length > 0) {
                    const locationInstructions: string[] = []
                    metadata.assetContext.locations.forEach(location => {
                      if (location.assetUrl) {
                        locationInstructions.push(
                          `The environment MUST CONSISTENTLY REFLECT THE REFERENCE IMAGE'S architectural style, atmosphere, lighting, and key visual elements of ${location.name.toUpperCase()}. Maintain spatial consistency and environmental continuity.`
                        )
                      } else {
                        locationInstructions.push(`Location: ${location.name}`)
                      }
                    })
                    
                    if (locationInstructions.length > 0) {
                      consistencyInstructions.push(...locationInstructions)
                      assetDetails.push(`Locations: ${metadata.assetContext.locations.map(l => l.name).join(', ')}`)
                    }
                  }
                  
                  // Combine all instructions with the original prompt
                  // Place consistency instructions FIRST for maximum impact
                  if (consistencyInstructions.length > 0) {
                    enhancedPrompt = consistencyInstructions.join(' ') + '. ' + enhancedPrompt
                  }
                  
                  // Add asset context summary at the end for additional guidance
                  if (assetDetails.length > 0) {
                    enhancedPrompt += '. Context: ' + assetDetails.join('. ')
                  }
                  
                  // Add realism and quality instructions
                  enhancedPrompt += '. Generate a photorealistic, human-replacing realistic image with professional cinematography, natural lighting, and high detail. Ensure all subjects appear natural and lifelike.'
                }
                
                const requestPayload: any = {
                  mode: generationMode,
                  prompt: enhancedPrompt,
                  aspect_ratio: latestProject.story.aspectRatio || '16:9',
                }
                
                // Add reference images for remix mode
                if (shouldUseRemix && referenceUrls.length > 0) {
                  requestPayload.reference_image_urls = referenceUrls
                }
                
                console.log(`📤 [${index + 1}/${allClips.length}] Sending request to /api/generate-image-remix for "${clipName}"`, {
                  mode: generationMode,
                  hasReferenceImages: referenceUrls.length > 0,
                  payload: { ...requestPayload, prompt: requestPayload.prompt?.substring(0, 50) + '...' }
                })
                
                // Use Remix API - automatically uses remix mode when assets are available
                imageResponse = await fetch('/api/generate-image-remix', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestPayload),
                  signal: controller.signal,
                })
                
                const requestDuration = Date.now() - requestStartTime
                console.log(`📥 [${index + 1}/${allClips.length}] Response received for "${clipName}"`, {
                  status: imageResponse.status,
                  statusText: imageResponse.statusText,
                  ok: imageResponse.ok,
                  duration: `${requestDuration}ms`,
                  headers: Object.fromEntries(imageResponse.headers.entries())
                })
              } catch (fetchError: any) {
                // Clear timeout on error
                clearTimeout(timeoutId)
                const requestDuration = Date.now() - requestStartTime
                
                console.error(`❌ [${index + 1}/${allClips.length}] Fetch error for "${clipName}"`, {
                  errorName: fetchError.name,
                  errorMessage: fetchError.message,
                  duration: `${requestDuration}ms`,
                  isAbort: fetchError.name === 'AbortError'
                })
                
                // Re-throw abort errors with clearer message
                if (fetchError.name === 'AbortError') {
                  throw new Error('Image generation timed out after 2 minutes')
                }
                // Re-throw other fetch errors
                throw fetchError
              } finally {
                // Ensure timeout is cleared even if no error occurred
                clearTimeout(timeoutId)
              }
              
              // Check if response exists before accessing properties
              if (!imageResponse) {
                throw new Error('No response received from image generation API')
              }
              
              if (!imageResponse.ok) {
                let errorMessage = 'Unknown error'
                let errorDetails: any = {}
                let errorResponseText = ''
                try {
                  // Try to read error response as text first
                  errorResponseText = await imageResponse.clone().text()
                  const errorData = JSON.parse(errorResponseText)
                  errorMessage = errorData.error || errorData.message || JSON.stringify(errorData)
                  errorDetails = errorData
                } catch (e) {
                  // If JSON parsing fails, use the text or status
                  errorMessage = errorResponseText || `HTTP ${imageResponse.status}: ${imageResponse.statusText}`
                }
                console.error(`❌ [${index + 1}/${allClips.length}] API error response for "${clipName}"`, {
                  status: imageResponse.status,
                  statusText: imageResponse.statusText,
                  errorMessage,
                  errorDetails,
                  responsePreview: errorResponseText.substring(0, 200)
                })
                throw new Error(errorMessage)
              }
              
              let responseData
              let responseText = ''
              try {
                // Read response as text first (in case JSON parsing fails, we can log the text)
                responseText = await imageResponse.clone().text()
                responseData = JSON.parse(responseText)
                console.log(`📦 [${index + 1}/${allClips.length}] Response data parsed for "${clipName}"`, {
                  hasImageUrl: !!(responseData.imageUrl || responseData.image_url || responseData.url),
                  hasSuccess: responseData.success,
                  model: responseData.model,
                  endpoint: responseData.endpoint,
                  requestId: responseData.requestId,
                  responseSize: `${(responseText.length / 1024).toFixed(2)} KB`
                })
              } catch (parseError) {
                console.error(`❌ [${index + 1}/${allClips.length}] Failed to parse response for "${clipName}"`, {
                  parseError: parseError instanceof Error ? parseError.message : String(parseError),
                  responseText: responseText.substring(0, 500) || 'Unable to read response',
                  responseLength: responseText.length,
                  status: imageResponse.status,
                  contentType: imageResponse.headers.get('content-type')
                })
                throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
              }
              
              const imageUrl = responseData.imageUrl || responseData.image_url || responseData.url
              
              if (!imageUrl) {
                console.error(`❌ [${index + 1}/${allClips.length}] No image URL in response for "${clipName}"`, {
                  responseData,
                  availableKeys: Object.keys(responseData)
                })
                throw new Error(`No image URL in response: ${JSON.stringify(responseData)}`)
              }
              
              console.log(`✅ [${index + 1}/${allClips.length}] Image URL extracted for "${clipName}"`, {
                imageUrl: imageUrl.substring(0, 100) + '...',
                imageUrlLength: imageUrl.length
              })
              
              // Update clip with generated image
              console.log(`💾 [${index + 1}/${allClips.length}] Updating clip "${clipName}" with generated image...`)
              updateClip(clipId, {
                generatedImage: imageUrl,
                previewImage: imageUrl,
                status: 'completed'
              })
              console.log(`✓ [${index + 1}/${allClips.length}] Clip "${clipName}" updated successfully`)
              
              // Save to user_images table if user is authenticated
              const { user } = useAppStore.getState()
              if (user?.id) {
                try {
                  console.log(`💾 [${index + 1}/${allClips.length}] Saving image to database for "${clipName}"...`)
                  const { saveUserImage } = await import('@/lib/userMedia')
                  await saveUserImage({
                    image_url: imageUrl,
                    prompt: clip.imagePrompt,
                    model: generationMode === 'remix' ? 'remix' : 'remix-text-to-image',
                    aspect_ratio: latestProject.story.aspectRatio || '16:9',
                    project_id: latestProject.id,
                    clip_id: clipId,
                    storeExternally: true // Automatically download and store in Supabase Storage
                  })
                  console.log(`✓ [${index + 1}/${allClips.length}] Image saved to database for "${clipName}"`)
                } catch (err) {
                  console.warn(`⚠️ [${index + 1}/${allClips.length}] Failed to save image to user_images for "${clipName}"`, {
                    error: err,
                    clipId,
                    imageUrl: imageUrl.substring(0, 50) + '...'
                  })
                  // Don't fail the whole process if saving fails
                }
              } else {
                console.log(`ℹ️ [${index + 1}/${allClips.length}] Skipping database save for "${clipName}" (user not authenticated)`)
              }
              
              const totalDuration = Date.now() - requestStartTime
              console.log(`✅ [${index + 1}/${allClips.length}] Image generation completed for "${clipName}"`, {
                duration: `${totalDuration}ms`,
                imageUrl: imageUrl.substring(0, 100) + '...'
              })
              
              // Clear generating status on success
              setClipGeneratingStatus(clipId, null)
              console.log(`✓ [${index + 1}/${allClips.length}] Status cleared for "${clipName}"`)
              
              // Trigger immediate save after image generation
              if (user?.id && latestProject) {
                const { saveProjectNow } = useAppStore.getState()
                saveProjectNow(latestProject.id, true).catch(err => {
                  console.warn(`⚠️ Failed to save project after image generation:`, err)
                })
              }
              
              return { success: true, clipId, clipName, imageUrl, duration: totalDuration }
            } catch (error: any) {
              // Handle all errors gracefully
              const errorMessage = error.message || 'Unknown error'
              const totalDuration = Date.now() - requestStartTime
              
              if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
                console.error(`⏱️ [${index + 1}/${allClips.length}] Timeout generating image for "${clipName}"`, {
                  duration: `${totalDuration}ms`,
                  timeoutLimit: '120 seconds'
                })
              } else {
                console.error(`❌ [${index + 1}/${allClips.length}] Error generating image for "${clipName}"`, {
                  error: errorMessage,
                  errorName: error.name,
                  duration: `${totalDuration}ms`,
                  stack: error.stack?.substring(0, 500) // First 500 chars of stack
                })
              }
              
              // Always clear generating status on error
              setClipGeneratingStatus(clipId, null)
              console.log(`✓ [${index + 1}/${allClips.length}] Status cleared for "${clipName}" (after error)`)
              
              return { success: false, clipId, clipName, error: errorMessage, duration: totalDuration }
            }
          })
          
          // Wait for all image generations to complete (success or failure)
          console.log('⏳ Waiting for all image generation requests to complete...')
          const results = await Promise.all(imageGenerationPromises)
          const totalDuration = Date.now() - startTime
          
          // Process results
          const successful = results.filter(r => r.success)
          const failed = results.filter(r => !r.success)
          
          console.log(`\n📊 Image Generation Summary:`, {
            total: allClips.length,
            successful: successful.length,
            failed: failed.length,
            totalDuration: `${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`,
            averageDuration: successful.length > 0 
              ? `${Math.round(successful.reduce((sum, r) => sum + (r.duration || 0), 0) / successful.length)}ms`
              : 'N/A'
          })
          
          if (successful.length > 0) {
            console.log(`✅ Successful generations (${successful.length}):`, 
              successful.map(r => ({
                clipName: r.clipName,
                duration: `${r.duration}ms`,
                imageUrl: r.imageUrl?.substring(0, 50) + '...'
              }))
            )
          }
          
          if (failed.length > 0) {
            console.error(`❌ Failed generations (${failed.length}):`, 
              failed.map(r => ({
                clipName: r.clipName,
                error: r.error,
                duration: `${r.duration}ms`
              }))
            )
          }
          
          console.log(`\n✅ Image generation process completed in ${(totalDuration / 1000).toFixed(2)}s`)
          
          if (failed.length > 0) {
            setGenerationStatus(`Image generation completed: ${successful.length} succeeded, ${failed.length} failed`)
          } else {
            setGenerationStatus(`All ${successful.length} images generated successfully!`)
          }
          
          // Final save after all images are generated
          const { user, saveProjectNow } = useAppStore.getState()
          if (user?.id && latestProject) {
            saveProjectNow(latestProject.id, true).catch(err => {
              console.warn(`⚠️ Failed to save project after batch image generation:`, err)
            })
          }
          
          // Small delay to show completion message
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } else {
        console.log('⏭️ Auto-image generation skipped:', latestProject?.settings?.dontGenerateImages 
          ? 'dontGenerateImages setting is enabled' 
          : 'No project found')
      }
      
      // Always clear generation status, even if image generation was skipped
      console.log('🎬 Story generation process complete')
      setGeneratingStory(false)
      setIsGenerating(false)
      setGenerationStatus('')
      setGenerationProgress({
        totalScenes: 0,
        completedScenes: 0,
        totalClips: 0,
        completedClips: 0
      })
      
      // Ensure all clip generating statuses are cleared
      const finalProject = useAppStore.getState().currentProject
      if (finalProject) {
        finalProject.scenes.forEach(scene => {
          scene.clips.forEach(clip => {
            setClipGeneratingStatus(clip.id, null)
          })
        })
      }
    } catch (error) {
      console.error('Error generating story:', error)
      setGenerationStatus('Error generating story. Please try again.')
      setGeneratingStory(false)
      setIsGenerating(false)
    }
  }

  // Show analysis screen if analysis is ready
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
    console.log('🔘 Generate Story Structure button clicked')
    
    if (!currentProject?.story?.originalIdea?.trim()) {
      console.error('❌ Cannot generate: No original idea found', { 
        hasProject: !!currentProject,
        hasStory: !!currentProject?.story,
        hasIdea: !!currentProject?.story?.originalIdea,
        ideaLength: currentProject?.story?.originalIdea?.length || 0
      })
      toast.error('Please enter an idea before generating the story structure')
      return
    }
    
    console.log('✅ Validation passed, proceeding with generation', {
      ideaLength: currentProject.story.originalIdea.length,
      ideaPreview: currentProject.story.originalIdea.substring(0, 50) + '...'
    })

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
    
    console.log('🚀 Starting idea analysis...', { 
      projectId: currentProject.id,
      originalIdea: currentProject.story.originalIdea.substring(0, 50) + '...'
    })
    
    const loadingToast = toast.loading('Analyzing your idea...')
    
    try {
      setIsGenerating(true)
      setGeneratingStory(true)
      setGenerationStatus('Analyzing your idea...')
      
      console.log('📡 Calling analysis API with:', {
        ideaLength: currentProject.story.originalIdea.length,
        hasTone: !!tone,
        hasBrandCues: !!brandCues
      })
      
      // Step 1: Call analysis API
      const analysisResponse = await fetch('/api/analyze-idea-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: currentProject.story.originalIdea,
          tone: tone || undefined,
          brandCues: brandCues || undefined,
        }),
      })

      if (!analysisResponse.ok) {
        let errorMessage = 'Failed to analyze idea'
        let errorDetails = ''
        
        try {
          const errorData = await analysisResponse.json()
          errorMessage = errorData.error || errorMessage
          errorDetails = errorData.details || ''
          
          // Provide helpful messages based on error type
          if (errorData.errorType === 'configuration_error') {
            errorMessage = 'OpenAI API key not configured. Please check server configuration.'
          } else if (errorData.errorType === 'auth_error') {
            errorMessage = 'OpenAI API authentication failed. Please check your API key.'
          } else if (errorData.errorType === 'rate_limit_error') {
            errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'
          } else if (errorData.errorType === 'model_error') {
            errorMessage = `Model error: ${errorDetails || 'The AI model is not available'}`
          } else if (errorData.errorType === 'parse_error') {
            errorMessage = 'Failed to parse AI response. Please try again.'
          } else if (errorData.details) {
            errorMessage = `${errorMessage}: ${errorData.details}`
          }
          
          console.error('❌ Analysis API error:', {
            status: analysisResponse.status,
            errorType: errorData.errorType,
            error: errorData.error,
            details: errorData.details
          })
        } catch (e) {
          // If response is not JSON, get text
          const text = await analysisResponse.text()
          console.error('❌ Analysis API error response (non-JSON):', text.substring(0, 200))
          errorMessage = `Server error (${analysisResponse.status}): ${analysisResponse.statusText}`
          if (text) {
            errorDetails = text.substring(0, 200)
          }
        }
        
        toast.dismiss(loadingToast)
        toast.error(errorMessage + (errorDetails ? `\n${errorDetails}` : ''), { 
          duration: 6000,
          style: {
            maxWidth: '500px',
            whiteSpace: 'pre-wrap'
          }
        })
        throw new Error(errorMessage)
      }

      let responseData
      try {
        responseData = await analysisResponse.json()
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError)
        const text = await analysisResponse.text()
        console.error('Response text:', text.substring(0, 500))
        toast.dismiss(loadingToast)
        toast.error('Server returned invalid response. Please check server logs.', { duration: 5000 })
        throw new Error('Failed to parse server response as JSON')
      }
      
      // Validate response structure
      if (!responseData) {
        console.error('❌ Empty response received')
        toast.dismiss(loadingToast)
        toast.error('Empty response from server. Please try again.', { duration: 5000 })
        throw new Error('Empty response')
      }

      // Handle both { data: {...} } and direct data response formats
      const analysisData = responseData.data || responseData
      
      if (!analysisData || !analysisData.analysis) {
        console.error('❌ Invalid response structure - missing analysis:', {
          responseData,
          hasData: !!responseData.data,
          hasDirectData: !responseData.data && !!responseData.analysis
        })
        toast.dismiss(loadingToast)
        toast.error('Invalid response structure from server. Please try again.', { duration: 5000 })
        throw new Error('Invalid response structure - missing analysis field')
      }

      console.log('✅ Idea analyzed successfully:', {
        type: analysisData.analysis?.type,
        detectedItems: analysisData.analysis?.detectedItems?.length || 0,
        fullData: analysisData
      })
      
      toast.dismiss(loadingToast)
      toast.success('Idea analyzed successfully! Review and confirm your settings below.', { duration: 3000 })
      
      // Step 2: Show analysis screen
      setIdeaAnalysis(analysisData)
      setShowAnalysisScreen(true)
      setIsGenerating(false)
      setGeneratingStory(false)
      setGenerationStatus('')
    } catch (error: any) {
      console.error('❌ Error analyzing idea:', error)
      toast.dismiss(loadingToast)
      
      const errorMessage = error?.message || 'Failed to analyze idea. Please check your connection and try again.'
      toast.error(errorMessage, { 
        duration: 5000,
        icon: '⚠️'
      })
      
      setGenerationStatus('')
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
      <div className="bg-[#1A1A24] rounded-2xl p-6 border border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]">
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
          className="w-full h-32 bg-[#0C0C0C] border-[#00FFF0]/30 text-white placeholder:text-gray-500 
                   focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/30 focus:outline-none
                   focus:shadow-[0_0_10px_rgba(0,255,240,0.2)]
                   rounded-xl px-4 py-3 text-lg resize-none transition-all duration-300"
        />
        
        {/* Don't Generate Images Toggle */}
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            id="dont-generate-images-idea"
            checked={currentProject.settings.dontGenerateImages || false}
            onChange={(e) => updateProject(currentProject.id, {
              settings: { ...currentProject.settings, dontGenerateImages: e.target.checked }
            })}
          />
          <label 
            htmlFor="dont-generate-images-idea" 
            className="text-sm text-gray-300 cursor-pointer select-none"
          >
            Don't generate images
          </label>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Aspect Ratio
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleAspectRatioChange('16:9')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                ${aspectRatio === '16:9'
                  ? 'border-[#00FFF0] bg-[#00FFF0]/10 text-[#00FFF0]'
                  : 'border-[#00FFF0]/30 hover:border-[#00FFF0]/50 bg-[#0C0C0C] text-gray-400 hover:text-white'
                }
              `}
            >
              <Monitor className="w-10 h-10" />
              <span className="text-sm font-medium">16:9</span>
            </button>
            <button
              onClick={() => handleAspectRatioChange('9:16')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                ${aspectRatio === '9:16'
                  ? 'border-[#00FFF0] bg-[#00FFF0]/10 text-[#00FFF0]'
                  : 'border-[#3AAFA9]/30 hover:border-[#3AAFA9] bg-[#0C0C0C] text-gray-400 hover:text-white'
                }
              `}
            >
              <Smartphone className="w-10 h-10" />
              <span className="text-sm font-medium">9:16</span>
            </button>
            <button
              onClick={() => handleAspectRatioChange('1:1')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                ${aspectRatio === '1:1'
                  ? 'border-[#00FFF0] bg-[#00FFF0]/10 text-[#00FFF0]'
                  : 'border-[#3AAFA9]/30 hover:border-[#3AAFA9] bg-[#0C0C0C] text-gray-400 hover:text-white'
                }
              `}
            >
              <Square className="w-10 h-10" />
              <span className="text-sm font-medium">1:1</span>
            </button>
          </div>
        </div>
      </div>

      {/* Story Settings */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-[#1A1A24] rounded-xl p-4 border border-[#00FFF0]/30 shadow-[0_0_5px_rgba(0,255,240,0.1)]">
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00FFF0]" />
            Target Runtime (seconds)
          </label>
          <Input
            type="number"
            value={targetRuntime}
            onChange={(e) => setTargetRuntime(Number(e.target.value))}
            className="bg-[#0C0C0C] border-[#00FFF0]/30 text-white focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/30"
          />
        </div>

        <div className="bg-[#1A1A24] rounded-xl p-4 border border-[#00FFF0]/30 shadow-[0_0_5px_rgba(0,255,240,0.1)]">
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#00FFF0]" />
            Tone & Mood
          </label>
          <Input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g., dramatic, comedic, mysterious"
            className="bg-[#0C0C0C] border-[#00FFF0]/30 text-white focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/30"
          />
        </div>

        <div className="bg-[#1A1A24] rounded-xl p-4 border border-[#00FFF0]/30 shadow-[0_0_5px_rgba(0,255,240,0.1)]">
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#00FFF0]" />
            Brand Cues
          </label>
          <Input
            value={brandCues}
            onChange={(e) => setBrandCues(e.target.value)}
            placeholder="e.g., modern, vintage, corporate"
            className="bg-[#0C0C0C] border-[#00FFF0]/30 text-white focus:border-[#00FFF0] focus:ring-2 focus:ring-[#00FFF0]/30"
          />
        </div>
      </div>

      {/* Generate Button */}
      <div className="text-center">
        <Button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('🔘 Button onClick triggered', {
              isGenerating,
              hasIdea: !!currentProject?.story?.originalIdea?.trim(),
              ideaLength: currentProject?.story?.originalIdea?.trim().length || 0
            })
            handleGenerateStory()
          }}
          disabled={!currentProject.story.originalIdea.trim() || isGenerating}
          className="bg-[#00FFF0] hover:bg-[#00FFF0]/90 text-black font-semibold px-8 py-3 rounded-xl
                   disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
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
        <div className="bg-[#1A1A24] rounded-2xl p-6 border border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]">
          <h3 className="text-xl font-semibold text-white mb-4">Generated Story</h3>
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-gray-300 font-mono text-sm leading-relaxed">
              {currentProject.story.generatedStory}
            </pre>
          </div>
        </div>
      )}

      {/* Characters Section */}
      <div className="bg-[#1A1A24] rounded-2xl p-6 border border-[#00FFF0]/30 shadow-[0_0_10px_rgba(0,255,240,0.1)]">
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
