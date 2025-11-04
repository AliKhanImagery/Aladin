import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { idea, tone, brandCues, targetRuntime } = await request.json()

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: 'Idea is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Story Writer role - Generate story structure
    const storyPrompt = `You are a professional Story Writer. Your task is to analyze the user's idea, Detect its type of content, Character if there are - how many, name them if not provided and create a structured story breakdown.

User's Idea: "${idea}"
${tone ? `Tone: ${tone}` : ''}
${brandCues ? `Brand Cues: ${brandCues}` : ''}
Target Runtime: ${targetRuntime} seconds

Generate a story structure with scenes. Return a JSON object with this exact format:
{
  "story": "The Story",
  "Subject": "Character" || "Object", 
  "scenes": [
    {
      "order": 1,
      "name": "Scene name",
      "description": "What happens in this scene, location and scenic detailsor ethnicity extracted from the story, scene description, ",
      "type": "establishing|dialogue|action|insert|montage",
      "purpose": "Why this scene exists in the narrative",
      "duration": 10,
      "clips": [
        {
          "order": 1,
          "name": "Clip name",
          "description": "Detailed description of what this clip shows, including key visual elements, actions, and narrative purpose",
          "imagePrompt": "Ultra-detailed visual description (100+ words) including: composition, lighting setup (key/fill/rim lights, color temperature), color palette, camera specs (lens, focal length, aperture), depth of field, atmospheric details, character appearance, environmental specifics, cinematic style, professional quality keywords",
          "videoPrompt": "Ultra-detailed motion description (100+ words) including: camera movement type (dolly/crane/handheld/tracking), movement speed and easing, subject actions and gestures, shot transitions, dynamic elements, temporal pacing, visual effects, professional cinematography terminology",
          "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
          "framing": "Detailed framing description with technical specs (e.g., 'Medium close-up at 85mm, f/1.8, eye level, shallow depth of field')"
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "Character look and detailed character description",
      "role": "protagonist|antagonist|supporting"
    }
  ]
}

Generate 1-6 scenes based on the target runtime. Each scene should have 2-4 clips.

CRITICAL: For each clip's imagePrompt and videoPrompt:
- Make them EXTREMELY DETAILED (100+ words each)
- Include specific technical camera details (lens, aperture, focal length, angle)
- Specify exact lighting setups (key light position, color temperature, shadows)
- Use professional cinematography terminology
- Include quality keywords: "professional", "cinematic", "4K", "award-winning", "commercial quality", "hollywood Comercial" with respectivleyDescribe precise color palettes, LUTs and color grading styles
- Be production-ready and optimized for AI generation
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a professional Story Writer specializing in visual narratives. You create structured, cinematic story breakdowns that are perfect for storyboard production.',
        },
        {
          role: 'user',
          content: storyPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85, // Higher temperature for more creative and detailed story generation
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const storyData = JSON.parse(content)

    return NextResponse.json({ success: true, data: storyData })
  } catch (error: any) {
    console.error('OpenAI API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate story',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

