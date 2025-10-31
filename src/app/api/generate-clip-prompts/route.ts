import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { sceneDescription, clipDescription, storyContext, tone, brandCues } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Story Boarding Expert & AI Prompting Expert role
    const prompt = `You are a Story Boarding Expert and AI Prompting Expert. Your task is to create highly detailed, cinematic prompts for image and video generation.

Story Context: ${storyContext}
Scene Description: ${sceneDescription}
Clip Description: ${clipDescription}
${tone ? `Tone: ${tone}` : ''}
${brandCues ? `Brand Cues: ${brandCues}` : ''}

Generate detailed prompts for this clip. Return a JSON object:
{
  "imagePrompt": "Ultra-detailed visual description for image generation. Include: composition, lighting, mood, colors, camera angle, framing, environment details, character positioning, style references",
  "videoPrompt": "Ultra-detailed motion description for video generation. Include: camera movement, subject motion, transitions, pacing, dynamic elements, visual effects if needed",
  "framing": "Specific camera framing description (e.g., 'medium close-up, eye level, shallow depth of field')",
  "cameraAngle": "wide|medium|close|insert|extreme-wide|extreme-close",
  "shotType": "Description of shot type (establishing, insert, reaction, etc.)"
}

Make the prompts cinematic, specific, and optimized for AI image/video generation. Use professional filmmaking terminology.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a Story Boarding Expert and AI Prompting Expert. You create highly detailed, cinematic prompts optimized for AI image and video generation tools. You understand cinematography, visual storytelling, and how to craft prompts that produce stunning visual results.',
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

