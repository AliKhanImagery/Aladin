import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { sceneDescription, clipDescription, storyContext, tone, brandCues } = await request.json()
    
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

    // Story Boarding Expert & AI Prompting Expert role
    const prompt = `You are an elite Story Boarding Expert and AI Prompting Expert, visual storytelling, and AI image/video generation. Your task is to create ultra-detailed, cinematic, production-ready prompts that dilivery story continuty, scene and location details matching across clips and scenes based onstorry idea, generate stunning, professional-quality visuals.

STORY CONTEXT:
${storyContext}

SCENE DESCRIPTION:
${sceneDescription}

CLIP DESCRIPTION:
${clipDescription}
${tone ? `\nTONE/MOOD: ${tone}` : ''}
${brandCuesFormatted ? `\nBRAND CUES: ${brandCuesFormatted}` : ''}

CRITICAL REQUIREMENTS FOR PROMPT QUALITY:
1. IMAGE PROMPT must be EXTREMELY DETAILED (minimum 50-250 words) including:
   - Contextualy correct scene detailes with story and scene description for every clip, location details, and tone/mood of the scene.
   - Check and matchCharacter visual details, expressions, wardrobe details, based on current clip requirements, story and scene description, location details, and tone/mood of the scene.
   - Precise composition and framing (rule of thirds, leading lines, symmetry)
   - Specific lighting setup (key light position, fill light, rim light, color temperature, intensity)
   - Exact color palette (hex colors or specific color names, color grading style)
   - Camera specifications (lens type, focal length, aperture, ISO, shutter speed if relevant)
   - Depth of field and focus (what's in focus, what's blurred, bokeh quality)
   - Atmospheric details (time of day, weather, particle effects, lens flares, god rays)
   - Character/appearance details (facial expressions, body language, clothing texture, fabric details)
   - Environmental specifics (architecture style, material textures, spatial relationships, scale)
   - Cinematic style references (specific directors, films, or visual movements if applicable)
   - Professional terminology (establishing shot, medium shot, close-up, extreme close-up, over-the-shoulder, etc.)
   - Quality descriptors: "4K, 8K, ultra-high resolution, professional photography, cinematic quality, award-winning cinematography"

2. VIDEO PROMPT must be EXTREMELY DETAILED (minimum 150-250 words) including:
   - aligned prompt with kling video prompt writing guidlines.
   - Contextualy correct scene detailes with story and scene description for every clip, location details, and tone/mood of the scene.
   - Check and matchCharacter visual details, expressions, wardrobe details, based on current clip requirements, story and scene description, location details, and tone/mood of the scene.
   - Precise camera movement (dolly, crane, handheld, steadicam, tracking shot, push-in, pull-out, orbit)
   - Movement speed and easing (slow start/stop, constant speed, acceleration/deceleration)
   - Subject motion (character actions, gestures, expressions, transitions)
   - Shot transitions (match cut, jump cut, cross-fade, wipe, seamless transition)
   - Dynamic elements (particle systems, environmental changes, light shifts)
   - Temporal pacing (slow motion, real-time, time-lapse, duration of specific actions)
   - Visual effects (if any: color grading changes, focus pulls, lens effects)


3. Both prompts MUST:
   - Use professional cinematography and filmmaking terminology
   - Include specific technical camera details
   - Describe exact lighting scenarios with color temperatures
   - Specify exact color palettes and grading styles
   - Mention visual style references (cinematic, commercial, documentary, etc.)
   - Include quality keywords: "professional", "cinematic", "high-end", "award-winning", "commercial quality"
   - Be optimized for AI generation (avoid ambiguous terms, be extremely specific)
   - Be production-ready for immediate use

Generate EXCEPTIONALLY DETAILED prompts for this clip. Return a JSON object:
{
  "imagePrompt": "[ULTRA-DETAILED image prompt - minimum 150 words, include ALL technical and aesthetic details listed above]",
  "videoPrompt": "[ULTRA-DETAILED video prompt for kling 1.6 - minimum 150 words, include ALL motion, camera, and technical details listed above]",
  "framing": "Specific camera framing with technical details (e.g., 'Medium close-up at 85mm, eye level, f/1.8 aperture, shallow depth of field, subject positioned at left third line, soft natural key light from 45-degree angle')",
  "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
  "shotType": "Detailed description of shot type with technical specifications"
}

REMEMBER: Quality is paramount. These prompts will be used to generate professional content. Every detail matters.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an elite Story Boarding Expert and AI Prompting Expert with decades of experience in cinematography, visual storytelling, and AI image/video generation. 

Your expertise includes:
- Professional cinematography (lighting, composition, camera techniques)
- Film production (shot types, camera movements, editing transitions)
- Visual storytelling (narrative structure, emotional beats, visual metaphors)
- AI prompt engineering (optimizing prompts for maximum quality and detail)
- Commercial and cinematic production standards

Your prompts are used by professional content creators. You MUST create ultra-detailed, production-ready prompts that include:
- Specific technical camera details (lens, aperture, ISO, focal length)
- Exact lighting setups (position, color temperature, intensity, shadows)
- Precise color palettes and grading styles
- Professional cinematography terminology
- High-quality visual descriptors
- Optimized keywords for AI generation quality

Quality standards: Each prompt should be 150-250 words minimum, extremely specific, and ready for professional production use.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Slightly higher for more creative and detailed prompts
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

