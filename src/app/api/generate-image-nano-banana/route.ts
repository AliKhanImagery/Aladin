import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Configure Fal AI client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      mode = 'text-to-image', // 'text-to-image' or 'multi-image-edit'
      input_images = [],
      aspect_ratio = '16:9',
      seed,
    } = await request.json()

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: 'FAL_KEY not configured' },
        { status: 500 }
      )
    }

    // Ensure aspect_ratio is in correct format (string like "16:9")
    const aspectRatioFormatted = typeof aspect_ratio === 'string' ? aspect_ratio : '16:9'
    
    console.log('🍌 Generating image with Fal AI Nano Banana:', {
      mode,
      prompt: prompt.substring(0, 50) + '...',
      inputImagesCount: input_images.length,
      aspectRatio: aspectRatioFormatted,
      aspectRatioType: typeof aspectRatioFormatted,
    })

    let result

    if (mode === 'text-to-image') {
      // Text to Image mode - doesn't require input images
      result = await fal.subscribe('fal-ai/nano-banana', {
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatioFormatted, // Must be string: "16:9", "9:16", "1:1"
          ...(seed && { seed }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI Nano Banana progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    } else {
      // Multi-image-edit mode - requires input images
      if (!input_images || input_images.length === 0) {
        return NextResponse.json(
          { error: 'At least one input image URL is required for Multi-image-edit mode' },
          { status: 400 }
        )
      }

      result = await fal.subscribe('fal-ai/nano-banana', {
        input: {
          prompt: prompt,
          input_images: input_images,
          aspect_ratio: aspectRatioFormatted, // Must be string: "16:9", "9:16", "1:1"
          ...(seed && { seed }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI Nano Banana progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    }

    // Nano Banana returns images array
    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from Fal AI Nano Banana')
    }

    console.log('✅ Fal AI Nano Banana image generated:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      model: 'fal-ai-nano-banana',
      mode,
      requestId: result.requestId,
    })
  } catch (error: any) {
    console.error('Fal AI Nano Banana Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate image',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

