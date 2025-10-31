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
      duration = 4,
      resolution = '720p',
      reference_image_urls = [],
      image_url,
      aspect_ratio = '16:9',
      movement_amplitude = 'auto',
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

    console.log('🎬 Generating video with Fal AI Vidu:', {
      prompt: prompt.substring(0, 50) + '...',
      duration,
      resolution,
      hasReferenceImages: reference_image_urls.length > 0,
      hasImage: !!image_url,
    })

    let result

    // Determine which Vidu model to use
    if (image_url) {
      // Image-to-Video: Start from an existing image
      console.log('Using Q2 Image-to-Video model')
      result = await fal.subscribe('fal-ai/vidu/q2-image-to-video', {
        input: {
          prompt: prompt,
          image_url: image_url,
          duration: duration.toString(),
          resolution: resolution as '720p' | '1080p',
          movement_amplitude: movement_amplitude,
          ...(seed && { seed }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    } else if (reference_image_urls.length > 0) {
      // Reference-to-Video: Use reference images for consistent characters
      console.log('Using Q1 Reference-to-Video model')
      result = await fal.subscribe('fal-ai/vidu/q1-reference-to-video', {
        input: {
          prompt: prompt,
          reference_image_urls: reference_image_urls,
          aspect_ratio: aspect_ratio,
          movement_amplitude: movement_amplitude,
          ...(seed && { seed }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    } else {
      // Text-to-Video: Pure text prompt
      console.log('Using Q2 Text-to-Video model')
      result = await fal.subscribe('fal-ai/vidu/q2-text-to-video', {
        input: {
          prompt: prompt,
          duration: duration.toString(),
          resolution: resolution as '720p' | '1080p',
          movement_amplitude: movement_amplitude,
          ...(seed && { seed }),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            console.log('🔄 Fal AI progress:', update.logs?.map((log: any) => log.message))
          }
        },
      })
    }

    const videoUrl = result.data?.video?.url

    if (!videoUrl) {
      throw new Error('No video URL returned from Fal AI')
    }

    console.log('✅ Fal AI video generated:', videoUrl)

    return NextResponse.json({
      success: true,
      videoUrl,
      model: reference_image_urls.length > 0 
        ? 'fal-ai-vidu-reference-to-video'
        : image_url
        ? 'fal-ai-vidu-image-to-video'
        : 'fal-ai-vidu-text-to-video',
      requestId: result.requestId,
      duration: result.data?.duration || duration,
    })
  } catch (error: any) {
    console.error('Fal AI Video Generation Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate video',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

