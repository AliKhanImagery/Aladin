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

    // Story Boarding Expert & AI Prompting Expert role with High-Density Kinetic Workflow
    const prompt = `You are an elite Visual Director and Lead Cinematographer implementing a High-Density Kinetic Workflow for Kling 2.5 Standard. Your task is to create ultra-detailed, production-ready image and video prompts that ensure subject integration, lighting consistency, technical accuracy, and kinetic continuity.

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

${isFlux ? `
CRITICAL INSTRUCTIONS FOR FLUX INTEGRATION (TO AVOID "STICKER" LOOK):
1. SUBJECT ANCHORING: Use [[IDENTITY:NAME]] or [[PRODUCT:NAME]]. Describe exactly how they touch, lean on, or interact with the environment. Mention CONTACT SHADOWS and ambient occlusion.
2. POSTURE & PHYSICS: Specify weight distribution, muscular tension, and how the subject fits the perspective of the frame. LOCK the exact posture for Clip 1 as the anchor frame.
3. LIGHTING PHYSICS: Describe how specific light colors (from Brand Cues or Tone) hit the subject (reflections, rim lights, subsurface scattering on skin). Use HEX CODES if colors are specific (e.g., key light #FFA500, fill light #87CEEB). MUST lock lighting with HEX codes.
4. BRIDGE INSTRUCTIONS: Every prompt MUST include a "Bridge Instruction" that connects the subject to the scene (e.g., "The emerald #10B981 light from the neon sign reflects accurately off the subject's metallic surface").
5. NO NEGATIVE PROMPTS: Focus on descriptive, positive detail.
` : ''}

HIGH-DENSITY KINETIC WORKFLOW REQUIREMENTS:

1. PERFORMANCE & ACTING LOGIC:
   - kling_motion_prompt MUST specify 'Character Acting' details
   - Include 'Micro-Expression' keywords: 'Eyes narrowing', 'Breath visible in cold air', 'Lips trembling slightly', 'Brow furrowing', 'Jaw clenching', 'Nostrils flaring', 'Eyes widening', 'Mouth corners lifting'
   - Include 'Physics-based Body Movement': 'Shifting weight forward', 'Arms pumping rhythmically', 'Shoulders tensing', 'Hips rotating', 'Feet planting firmly', 'Spine straightening', 'Head tilting'
   - Acting must be 'Motivated' by the narrative_role:
     * Hook: Subtle curiosity, anticipation, or discovery expressions
     * Escalation: Building tension, intensity increasing, body language becoming more dynamic
     * Peak: Intense facial shifts, maximum emotional expression, full body commitment to action
     * Resolution: Release, satisfaction, or contemplative expressions

2. CAMERA MOTIVATION LOGIC:
   - Camera movement MUST only be used if it serves the story beat
   - Follow the camera movement instruction provided above based on narrative_role
   - Every camera movement must have narrative justification

3. COST & TECHNICAL SPECS:
   - STRICTLY REMOVE all '4K', '8K', 'ultra-HD', and 'photorealistic' keywords from both prompts
   - Focus on 'Cinematic lighting', 'Sharp focus', and 'Natural textures' instead
   - Use quality keywords: "professional", "cinematic", "award-winning", "commercial quality"

4. FLUX IMAGE PROMPT (Anchor):
   - Must lock the lighting with specific HEX codes (e.g., key light #FFA500, fill light #87CEEB, rim light #FFD700)
   - Must specify exact posture for Clip 1 as the anchor frame
   - Include all technical specs: lens, focal length, aperture, depth of field
   - Focus on cinematic lighting, sharp focus, natural textures

5. KLING MOTION PROMPT (Pivot):
   - MUST start with: 'Starting from the provided frame, [Subject Name] performs [Action] while the camera [Movement].'
   - Include Character Acting with Micro-Expressions (motivated by narrative_role)
   - Include Physics-based Body Movement
   - Maintain kinetic continuity from previous clip (if applicable)
   - Focus on cinematic lighting, sharp focus, natural textures

PROMPT STRUCTURE HIERARCHY (Follow strictly):
1. SUBJECT & ACTION: Who/what and exactly what they are doing, including posture and expression.
2. ENVIRONMENTAL ANCHORING: Physical relationship between subject and scene (contact, shadows, perspective).
3. LIGHTING & COLOR GRADE: Detailed lighting setup with HEX codes for color grade locking.
4. CAMERA & TECHNICALS: Lens choice (e.g., 85mm prime), aperture (e.g., f/1.8), camera movement (motivated by narrative role), and framing details.

Generate a JSON object:
{
  "imagePrompt": "PURE TEXT ONLY: Write the visual description directly without any labels, prefixes, or metadata. Start immediately with the subject and scene description. Minimum 150 words with HEX codes for lighting, exact posture details, camera specs, and natural textures. NO labels like 'flux_image_prompt:' or brackets. Follow the hierarchy: 1. SUBJECT & ACTION, 2. ENVIRONMENTAL ANCHORING, 3. LIGHTING & COLOR GRADE (with HEX codes), 4. CAMERA & TECHNICALS.",
  "videoPrompt": "PURE TEXT ONLY: MUST start with 'Starting from the provided frame, [Subject Name] performs [Action] while the camera [Movement].' Then continue with Character Acting with Micro-Expressions (motivated by ${narrativeRole}), Physics-based Body Movement, and kinetic continuity. Minimum 150 words. Write directly without labels or metadata. Focus on cinematic lighting, sharp focus, natural textures. NO 4K/8K/ultra-HD/photorealistic keywords.",
  "framing": "Detailed technical framing (e.g., '85mm prime, f/1.8, medium close-up at eye level')",
  "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
  "cameraMovement": "Static|Dolly-in|Dolly-out|Tracking|Handheld|Orbiting|Crane-up|Crane-down|Push-in|Pull-out",
  "shotType": "Technical cinematography shot type (e.g., 'Three-quarter profile tracking shot')",
  "kineticHandshake": "Description of velocity/speed/momentum at end of this clip for next clip to pick up (e.g., 'walking briskly forward', 'slowly turning left', 'sprinting toward camera')"
}

CRITICAL INSTRUCTIONS FOR JSON OUTPUT:
- The "imagePrompt" and "videoPrompt" values must be PURE STRINGS without any labels, prefixes, or metadata inside them.
- Do NOT include text like "flux_image_prompt:", "[flux_image_prompt:", "imagePrompt:", or any other labels in the actual prompt value.
- The prompt should start directly with the visual description or motion description.
- Output the JSON exactly as specified - the values should be clean, natural language text only.
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an elite Visual Director and Cinematographer implementing a High-Density Kinetic Workflow for Kling 2.5 Standard. You specialize in ${imageModel} prompting with expertise in kinetic continuity, camera motivation, and performance-driven acting.
          Your goals:
          - PERFECT subject integration into scene physics (contact shadows, reflections).
          - EXACT color grade locking using technical descriptions and HEX codes.
          - CINEMATIC consistency across sequential clips using identity tokens.
          - BRIDGE INSTRUCTIONS to prevent subjects looking like "stickers" or "overlays".
          - KINETIC CONTINUITY: Maintain character velocity and momentum between clips.
          - CAMERA MOTIVATION: Only use camera movement that serves the narrative role (Hook, Escalation, Peak, Resolution).
          - PERFORMANCE ACTING: Include micro-expressions and physics-based body movement motivated by narrative role.
          - COST OPTIMIZATION: Remove 4K/8K/ultra-HD/photorealistic keywords, focus on cinematic lighting, sharp focus, natural textures.`,
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

    const clipPrompts = JSON.parse(content)

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

