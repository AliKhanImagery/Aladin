import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * AI-Powered Visual Style Generation
 * 
 * Generates diverse, unique visual styles for each scene/clip
 * based on brand cues, ensuring variety while maintaining brand consistency.
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      brandCues, 
      tone,
      sceneType,
      sceneOrder,
      totalScenes,
      clipOrder,
      totalClipsInScene,
      scenePurpose
    } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const brandCuesFormatted = Array.isArray(brandCues) 
      ? brandCues.join(', ') 
      : brandCues || ''

    const toneFormatted = Array.isArray(tone)
      ? tone.join(', ')
      : tone || ''

    const stylePrompt = `You are an elite Visual Style Director and Colorist. Generate a unique, distinctive visual style for this scene/clip that follows brand cues while creating visual variety.

BRAND CUES (Must incorporate these elements):
${brandCuesFormatted}

TONE/MOOD:
${toneFormatted}

SCENE CONTEXT:
- Scene Type: ${sceneType || 'establishing'}
- Scene Order: ${sceneOrder} of ${totalScenes}
- Clip Order: ${clipOrder} of ${totalClipsInScene}
- Scene Purpose: ${scenePurpose || 'Narrative progression'}

TASK:
Create a UNIQUE visual style for this specific scene/clip that:
1. Incorporates the brand cues in a distinct way
2. Varies from previous scenes/clips to maintain visual interest
3. Sets a specific mood appropriate for the scene type
4. Defines precise color palette, lighting, and visual treatment
5. Maintains brand consistency while showing diversity

Generate a JSON object with this format:
{
  "style": {
    "mood": "Specific mood for this scene (e.g., 'energetic and dynamic', 'contemplative and intimate', 'dramatic and bold')",
    "lighting": "Specific lighting style (e.g., 'warm golden hour with soft rim lighting', 'cool blue moonlight with high contrast', 'dramatic chiaroscuro with single key light')",
    "colorPalette": {
      "primary": ["#HEX", "Color name"],
      "secondary": ["#HEX", "Color name"],
      "accent": ["#HEX", "Color name"],
      "description": "Specific color scheme description"
    },
    "cameraStyle": "Specific camera approach (e.g., 'smooth Steadicam with fluid movements', 'handheld documentary style with natural motion', 'precise locked-off frames with subtle push-ins')",
    "visualTreatment": "Specific visual treatment (e.g., 'cinematic with shallow depth of field and film grain', 'clean and modern with sharp focus and vibrant saturation', 'vintage film look with desaturated colors and warm tones')",
    "postProcessing": ["specific effect 1", "specific effect 2"],
    "atmosphere": "Atmospheric description (time of day, weather, environmental mood)"
  },
  "brandCueInterpretation": "How this style interprets the brand cues in a unique way for this scene",
  "variationNotes": "What makes this style different from other scenes while staying on-brand"
}

CRITICAL REQUIREMENTS:
- Each scene should feel distinct yet cohesive
- Color palettes must be specific (provide hex codes and names)
- Lighting setups must be detailed and cinematic
- Visual treatments should vary by scene type and purpose
- Brand cues should be interpreted uniquely per scene
- Maintain professional, production-ready quality`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an elite Visual Style Director and Colorist with decades of experience in commercial and cinematic production. You create distinctive, brand-consistent visual styles that maintain variety across scenes while adhering to brand guidelines. Your styles are production-ready and optimized for AI generation.',
        },
        {
          role: 'user',
          content: stylePrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85, // Higher temperature for more creative variation
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Safely parse and validate JSON response
    let styleData: any
    try {
      styleData = JSON.parse(content)
    } catch (parseError: any) {
      console.error('JSON parse error in visual style generation:', {
        error: parseError.message,
        contentPreview: content.substring(0, 200),
        contentLength: content.length
      })
      throw new Error(`Invalid JSON response from OpenAI: ${parseError.message}. Content preview: ${content.substring(0, 100)}...`)
    }

    // Validate response structure
    if (!styleData || typeof styleData !== 'object') {
      throw new Error('Invalid response format: expected object but got ' + typeof styleData)
    }

    if (!styleData.style || typeof styleData.style !== 'object') {
      throw new Error('Invalid response structure: missing or invalid "style" property')
    }

    // Validate required style properties exist
    const requiredStyleFields = ['mood', 'lighting', 'colorPalette', 'cameraStyle']
    const missingFields = requiredStyleFields.filter(field => !styleData.style[field])
    if (missingFields.length > 0) {
      console.warn('Missing style fields (will use defaults):', missingFields)
      // Don't throw - we can use defaults for missing fields
    }

    return NextResponse.json({ success: true, data: styleData })
  } catch (error: any) {
    console.error('Visual Style Generation API Error:', error)
    
    // Provide specific error information
    let errorMessage = 'Failed to generate visual style'
    let errorDetails = error.message || 'Unknown error'
    let statusCode = 500

    // Distinguish between different error types
    if (error.message?.includes('Invalid JSON')) {
      errorMessage = 'Invalid JSON response from AI'
      errorDetails = error.message
      statusCode = 502 // Bad Gateway - upstream service returned invalid data
    } else if (error.message?.includes('Invalid response')) {
      errorMessage = 'Invalid response structure from AI'
      errorDetails = error.message
      statusCode = 502
    } else if (error.message?.includes('OpenAI API key')) {
      errorMessage = 'Configuration error'
      errorDetails = 'OpenAI API key not configured'
      statusCode = 500
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        type: error.message?.includes('JSON') ? 'parse_error' : 
              error.message?.includes('structure') ? 'validation_error' : 
              'unknown_error'
      },
      { status: statusCode }
    )
  }
}

