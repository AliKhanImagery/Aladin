import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { 
      sceneDescription, 
      clipDescription, 
      storyContext, 
      tone, 
      brandCues, 
      sceneStyle, 
      assetContext,
      imageModel = 'flux-2-pro',
      narrativeRole = 'Escalation',
      previousClipVelocity = null,
      duration = 5,
      videoEngine = 'kling'
    } = await request.json()
    
    // Handle brandCues as array or string
    const brandCuesFormatted = Array.isArray(brandCues) 
      ? brandCues.join(', ') 
      : brandCues || ''

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Build asset context string if provided
    let assetContextString = ''
    if (assetContext) {
      const characterStrings: string[] = []
      const productStrings: string[] = []
      const locationStrings: string[] = []
      
      if (assetContext.characters && Array.isArray(assetContext.characters) && assetContext.characters.length > 0) {
        for (const c of assetContext.characters) {
          const char = c as { 
            name: string; 
            appearanceDetails?: string; 
            description: string; 
            assetUrl?: string;
            roleInClip?: string;
          }
          const identityToken = `[[IDENTITY:${char.name.toUpperCase().replace(/\s+/g, '_')}]]`
          characterStrings.push(`${identityToken} - ${char.name}: ${char.appearanceDetails || char.description}. ${char.assetUrl ? 'USE PROVIDED REFERENCE IMAGE.' : ''}`)
        }
      }
      
      if (assetContext.products && Array.isArray(assetContext.products) && assetContext.products.length > 0) {
        for (const p of assetContext.products) {
          const product = p as { name: string; description: string; assetUrl?: string }
          const productToken = `[[PRODUCT:${product.name.toUpperCase().replace(/\s+/g, '_')}]]`
          productStrings.push(`${productToken} - ${product.name}: ${product.description}. ${product.assetUrl ? 'USE PROVIDED REFERENCE IMAGE.' : ''}`)
        }
      }
      
      if (assetContext.locations && Array.isArray(assetContext.locations) && assetContext.locations.length > 0) {
        for (const l of assetContext.locations) {
          const location = l as { name: string; description: string; assetUrl?: string }
          locationStrings.push(`${location.name}: ${location.description}.`)
        }
      }
      
      if (characterStrings.length > 0 || productStrings.length > 0 || locationStrings.length > 0) {
        assetContextString = `
ASSET BIBLE & IDENTITY TOKENS:
${characterStrings.length > 0 ? `Characters: \n${characterStrings.join('\n')}` : ''}
${productStrings.length > 0 ? `Products: \n${productStrings.join('\n')}` : ''}
${locationStrings.length > 0 ? `Locations: \n${locationStrings.join('\n')}` : ''}
`
      }
    }

    const isFlux = imageModel.includes('flux');
    const isNanoBanana = imageModel.includes('banana');

    // Determine camera movement based on narrative role
    let cameraMovementInstruction = ''
    if (narrativeRole === 'Hook') {
      cameraMovementInstruction = 'Camera Movement: Use "Cinematic wide reveal" or "Dolly-out" to establish the scene. Camera movement must serve the hook narrative beat.'
    } else if (narrativeRole === 'Escalation') {
      cameraMovementInstruction = 'Camera Movement: Use "Tracking shot" or "Handheld following" to build tension. Camera movement must serve the escalation narrative beat.'
    } else if (narrativeRole === 'Peak') {
      cameraMovementInstruction = 'Camera Movement: Use "Slow push-in (dolly) for intimacy" or "Orbiting shot" for emotional impact. Camera movement must serve the peak narrative beat.'
    } else {
      cameraMovementInstruction = 'Camera Movement: Choose movement that serves the story beat. Camera movement must have narrative justification.'
    }

    // Kinetic Handshake context
    const kineticHandshake = previousClipVelocity 
      ? `KINETIC HANDSHAKE: The previous clip ended with the character ${previousClipVelocity}. This clip must pick up the same momentum - the character should already be in motion at the start, maintaining continuity of velocity and movement energy.`
      : 'KINETIC HANDSHAKE: This is the first clip, so establish the initial movement velocity that subsequent clips will maintain.'

    // Structured Prompt Construction for Cinematic Video Generation (Kling/LTX optimized)
    const prompt = `You are an elite Visual Director and Lead Cinematographer implementing a High-Density Kinetic Workflow. Your task is to generate STRUCTURED components that will be assembled into final production prompts.

TARGET ENGINE: ${imageModel.toUpperCase()}
NARRATIVE ROLE: ${narrativeRole}

STORY CONTEXT:
${storyContext}

SCENE DESCRIPTION:
${sceneDescription}

CLIP DESCRIPTION:
${clipDescription}
${Array.isArray(tone) ? `\nTONE/MOOD: ${tone.join(', ')}` : tone ? `\nTONE/MOOD: ${tone}` : ''}
${brandCuesFormatted ? `\nBRAND CUES: ${brandCuesFormatted}` : ''}
${sceneStyle ? `
SCENE STYLE:
- Mood: ${sceneStyle.mood || 'dramatic'}
- Lighting: ${sceneStyle.lighting || 'natural'}
- Color Palette: ${sceneStyle.colorPalette || 'warm'}
- Camera Style: ${sceneStyle.cameraStyle || 'cinematic'}
- Post Processing: ${sceneStyle.postProcessing?.join(', ') || 'none'}
` : ''}${assetContextString}

${kineticHandshake}

${cameraMovementInstruction}

INSTRUCTIONS:
Break down the visual description into these EXACT components:
1. SUBJECT_MAIN: Who is the primary focus? Include appearance, clothing, and "Material DNA" if object-centric.
2. SUBJECT_ACTION: What is the subject DOING? Be specific about movement, micro-expressions, and posture.
3. SUBJECT_SECONDARY: (Optional) Is there a second character or background figure?
4. ENVIRONMENT: The setting, atmosphere, weather, and "Bridge Instructions" (how subject touches environment).
5. LIGHTING: Detailed lighting setup with HEX CODES (e.g., #FFA500).
6. CAMERA: Lens, angle, movement, and framing.
7. RENDER_STYLE: Technical specs (e.g., "cinematic lighting, sharp focus, natural textures"). NO 4K/8K/photorealistic keywords.

Generate a JSON object with these distinct fields:
{
  "subject_main": "Detailed description of the main subject...",
  "subject_action": "Specific action and expression...",
  "subject_secondary": "Description of secondary elements or 'none'...",
  "environment": "Detailed environmental context...",
  "lighting": "Lighting setup with HEX codes...",
  "camera": "Camera movement and lens details...",
  "render_style": "Visual style keywords...",
  "kineticHandshake": "Velocity description for next clip...",
  "cameraAngle": "wide|medium|close...",
  "cameraMovement": "Static|Dolly-in...",
  "framing": "Technical framing..."
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an elite Visual Director. You do NOT write prose paragraphs. You write STRUCTURED visual components.
          - STRICTLY REMOVE words like "4K", "8K", "photorealistic", "ultra-HD".
          - Focus on "Cinematic lighting", "Sharp focus", "Natural textures", "Award-winning photography".
          - Use HEX codes for lighting consistency.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const rawData = JSON.parse(content)

    // ASSEMBLE THE FINAL PROMPTS PROGRAMMATICALLY
    // This enforces the "Subject -> Action -> Environment -> Tech" structure requested
    
    // 1. Clean up "none" fields
    const secondarySub = rawData.subject_secondary?.toLowerCase() === 'none' ? '' : rawData.subject_secondary;

    // 2. Build Image Prompt (Anchor)
    // Structure: [Subject Main] [Subject Action (Static)] [Secondary] [Environment] [Lighting] [Camera] [Render]
    const imagePrompt = [
      rawData.subject_main,
      rawData.subject_action, // Even in static, action implies posture
      secondarySub,
      `Set in ${rawData.environment}`,
      `Lighting is ${rawData.lighting}`,
      `Shot with ${rawData.camera}`,
      rawData.render_style
    ].filter(Boolean).join('. ');

    // 3. Build Video Prompt (Motion)
    // Structure: [Starting State] -> [Action/Movement] -> [Environment/Camera] -> [Tech]
    // "Starting from the provided frame, [Subject] [Action]..."
    const videoPrompt = `Starting from the provided frame, ${rawData.subject_main} ${rawData.subject_action}. ${secondarySub ? secondarySub + '. ' : ''}The camera moves via ${rawData.camera}. Lighting: ${rawData.lighting}. Style: ${rawData.render_style}.`;

    const clipPrompts = {
      imagePrompt: imagePrompt,
      videoPrompt: videoPrompt,
      framing: rawData.framing,
      cameraAngle: rawData.cameraAngle,
      cameraMovement: rawData.cameraMovement,
      kineticHandshake: rawData.kineticHandshake,
      // Pass raw components for debugging/UI if needed
      components: rawData
    }

    return NextResponse.json({ success: true, data: clipPrompts })
  } catch (error: any) {
    console.error('OpenAI API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate clip prompts',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

