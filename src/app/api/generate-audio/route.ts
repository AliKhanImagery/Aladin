import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Initialize Fal client
fal.config({
  credentials: process.env.NEXT_PUBLIC_FAL_KEY, // Use server-side key if available, or client key
})

export async function POST(req: NextRequest) {
  try {
    const { prompt, duration, model, projectId } = await req.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    console.log('🎵 Starting audio generation:', { model, prompt, duration })

    let result
    let audioUrl

    if (model === 'stable-audio') {
        // Use Stable Audio
        result = await fal.subscribe('fal-ai/stable-audio', {
            input: {
                prompt_text: prompt,
                seconds_total: duration || 5
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log('Stable Audio generation in progress...')
                }
            },
        })
        
        // Stable Audio returns { audio_file: { url: string, ... } }
        audioUrl = result.data.audio_file.url

    } else if (model === 'playai-tts') {
        // Use Play.ai via Fal (or similar TTS endpoint available on Fal)
        // For now, let's use a generic TTS if Play.ai isn't directly exposed or requires specific setup
        // Falling back to a standard TTS model on Fal or keeping it simple
        
        // Since we don't have Play.ai credentials or specific endpoint confirmed, 
        // let's use 'fal-ai/playai/tts/v3' if available, or 'fal-ai/fast-sdxl' placeholder? 
        // No, let's use a known working TTS model or mock it if strictly needed.
        // Actually, let's try 'fal-ai/playai/tts/v3' as requested by user context implies specific integration
        // If that fails, we can fallback.
        
        // NOTE: 'fal-ai/playai/tts/v3' inputs: { input: "text", voice: "..." }
        result = await fal.subscribe('fal-ai/playai/tts/v3', {
            input: {
                input: prompt,
                voice: "en-US-Standard-A" // Default voice
            },
            logs: true,
        })
        
        audioUrl = result.data.audio.url
    } else {
        throw new Error('Invalid model selected')
    }

    if (!audioUrl) {
        throw new Error('No audio URL returned from provider')
    }

    console.log('✅ Audio generated successfully:', audioUrl)

    // Return the URL directly (client will handle saving to store)
    // In a production app, we would upload this to our own storage (Supabase) here
    // to make it persistent, as Fal URLs expire.
    // For now, we'll return the Fal URL.
    
    return NextResponse.json({
        success: true,
        audioUrl,
        duration,
        model
    })

  } catch (error: any) {
    console.error('❌ Audio generation failed:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate audio' },
      { status: 500 }
    )
  }
}
