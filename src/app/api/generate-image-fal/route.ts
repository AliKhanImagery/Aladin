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
      reference_image_urls = [],
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

    if (!reference_image_urls || reference_image_urls.length === 0) {
      return NextResponse.json(
        { error: 'At least one reference image URL is required for Vidu reference-to-image' },
        { status: 400 }
      )
    }

    // Ensure aspect_ratio is in correct format (string like "16:9")
    const aspectRatioFormatted = typeof aspect_ratio === 'string' ? aspect_ratio : '16:9'
    
    console.log('🎨 Generating image with Fal AI Vidu:', {
      prompt: prompt.substring(0, 50) + '...',
      referenceImagesCount: reference_image_urls.length,
      aspectRatio: aspectRatioFormatted,
      aspectRatioType: typeof aspectRatioFormatted,
    })

    // Call Fal AI Vidu Reference-to-Image
    const result = await fal.subscribe('fal-ai/vidu/reference-to-image', {
      input: {
        prompt: prompt,
        reference_image_urls: reference_image_urls,
        aspect_ratio: aspectRatioFormatted, // Must be string: "16:9", "9:16", "1:1"
        ...(seed && { seed }),
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
        }
      },
    })

    const imageUrl = result.data?.image?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from Fal AI')
    }

    console.log('✅ Fal AI image generated:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      model: 'fal-ai-vidu',
      requestId: result.requestId,
    })
  } catch (error: any) {
    console.error('Fal AI Image Generation Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate image',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

