import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'dall-e-3', size = '1024x1024', quality = 'standard' } = await request.json()

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // OpenAI DALL-E Image Generation
    const response = await openai.images.generate({
      model: model as 'dall-e-2' | 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792',
      quality: quality as 'standard' | 'hd',
    })

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI')
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      model: 'openai-dalle',
    })
  } catch (error: any) {
    console.error('OpenAI Image Generation Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate image',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

