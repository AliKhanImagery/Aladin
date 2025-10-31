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
    const storyPrompt = `You are a professional Story Writer. Your task is to analyze the user's idea and create a structured story breakdown.

User's Idea: "${idea}"
${tone ? `Tone: ${tone}` : ''}
${brandCues ? `Brand Cues: ${brandCues}` : ''}
Target Runtime: ${targetRuntime} seconds

Generate a story structure with scenes. Return a JSON object with this exact format:
{
  "story": "A brief narrative description of the story",
  "scenes": [
    {
      "order": 1,
      "name": "Scene name",
      "description": "What happens in this scene",
      "type": "establishing|dialogue|action|insert|montage",
      "purpose": "Why this scene exists in the narrative",
      "duration": 10,
      "clips": [
        {
          "order": 1,
          "name": "Clip name",
          "description": "What this clip shows",
          "imagePrompt": "Detailed visual description for image generation",
          "videoPrompt": "Detailed motion description for video generation",
          "cameraAngle": "wide|medium|close|insert",
          "framing": "Description of framing"
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "Character name",
      "description": "Character description",
      "role": "protagonist|antagonist|supporting"
    }
  ]
}

Generate 3-6 scenes based on the target runtime. Each scene should have 2-4 clips. Be creative and cinematic.`

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
      temperature: 0.8,
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

