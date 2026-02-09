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
      variant = 'pro', // 'pro' = fal-ai/nano-banana, 'flash' = fal-ai/gemini-25-flash-image
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
    
    const useFlash = variant === 'flash'
    const endpoint = useFlash
      ? (mode === 'text-to-image' ? 'fal-ai/gemini-25-flash-image' : 'fal-ai/gemini-25-flash-image/edit')
      : 'fal-ai/nano-banana'
    console.log(`🍌 Generating image with ${useFlash ? 'Nano Banana (Fast)' : 'Nano Banana Pro'}:`, {
      endpoint,
      mode,
      prompt: prompt.substring(0, 50) + '...',
      inputImagesCount: input_images.length,
      aspectRatio: aspectRatioFormatted,
    })

    let result

    if (mode === 'text-to-image') {
      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspectRatioFormatted,
        ...(seed && { seed }),
      }
      result = await fal.subscribe(endpoint as any, {
        input,
        logs: true,
        onQueueUpdate: (update: any) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    } else {
      if (!input_images || input_images.length === 0) {
        return NextResponse.json(
          { error: 'At least one input image URL is required for Multi-image-edit mode' },
          { status: 400 }
        )
      }
      const input: Record<string, unknown> = useFlash
        ? { prompt, image_urls: input_images, aspect_ratio: aspectRatioFormatted, ...(seed && { seed }) }
        : { prompt, input_images: input_images, aspect_ratio: aspectRatioFormatted, ...(seed && { seed }) }
      result = await fal.subscribe(endpoint as any, {
        input,
        logs: true,
        onQueueUpdate: (update: any) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    }

    const imageUrl = result.data?.images?.[0]?.url || result.data?.image?.url || result.data?.url

    if (!imageUrl) {
      throw new Error(`No image URL returned from ${endpoint}`)
    }

    console.log('✅ Image generated:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      model: useFlash ? 'fal-ai-gemini-25-flash-image' : 'fal-ai-nano-banana',
      mode,
      requestId: result.requestId,
    })
  } catch (error: any) {
    console.error('Nano Banana API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate image',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

