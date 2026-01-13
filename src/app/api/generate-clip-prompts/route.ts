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
      imageModel = 'flux-2-pro' 
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

    // Story Boarding Expert & AI Prompting Expert role
    const prompt = `You are an elite Visual Director and Lead Cinematographer. Your task is to create ultra-detailed, production-ready image and video prompts that ensure subject integration, lighting consistency, and technical accuracy.

TARGET ENGINE: ${imageModel.toUpperCase()}

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

${isFlux ? `
CRITICAL INSTRUCTIONS FOR FLUX INTEGRATION (TO AVOID "STICKER" LOOK):
1. SUBJECT ANCHORING: Use [[IDENTITY:NAME]] or [[PRODUCT:NAME]]. Describe exactly how they touch, lean on, or interact with the environment. Mention CONTACT SHADOWS and ambient occlusion.
2. POSTURE & PHYSICS: Specify weight distribution, muscular tension, and how the subject fits the perspective of the frame.
3. LIGHTING PHYSICS: Describe how specific light colors (from Brand Cues or Tone) hit the subject (reflections, rim lights, subsurface scattering on skin). Use HEX CODES if colors are specific.
4. BRIDGE INSTRUCTIONS: Every prompt MUST include a "Bridge Instruction" that connects the subject to the scene (e.g., "The emerald #10B981 light from the neon sign reflects accurately off the subject's metallic surface").
5. NO NEGATIVE PROMPTS: Focus on descriptive, positive detail.
` : ''}

PROMPT STRUCTURE HIERARCHY (Follow strictly):
1. SUBJECT & ACTION: Who/what and exactly what they are doing, including posture and expression.
2. ENVIRONMENTAL ANCHORING: Physical relationship between subject and scene (contact, shadows, perspective).
3. LIGHTING & COLOR GRADE: Detailed lighting setup and color grade locking (mention specific HEX codes for consistency).
4. CAMERA & TECHNICALS: Lens choice (e.g., 85mm prime), aperture (e.g., f/1.8), camera movement, and framing details.

Generate a JSON object:
{
  "imagePrompt": "[Detailed instructional prompt following the hierarchy above - minimum 150 words]",
  "videoPrompt": "[Motion-focused prompt for Kling 1.6, detailing movement and subject action - minimum 150 words]",
  "framing": "Detailed technical framing (e.g., '85mm prime, f/1.8, medium close-up at eye level')",
  "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
  "shotType": "Technical cinematography shot type (e.g., 'Three-quarter profile tracking shot')"
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an elite Visual Director and Cinematographer. You specialize in ${imageModel} prompting. 
          Your goals:
          - PERFECT subject integration into scene physics (contact shadows, reflections).
          - EXACT color grade locking using technical descriptions and HEX codes.
          - CINEMATIC consistency across sequential clips using identity tokens.
          - BRIDGE INSTRUCTIONS to prevent subjects looking like "stickers" or "overlays".`,
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

