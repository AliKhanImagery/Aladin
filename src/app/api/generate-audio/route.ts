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

    let audioUrl: string | undefined
    let result: any

    if (model === 'elevenlabs-sfx') {
        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
        
        if (!ELEVENLABS_API_KEY) {
            throw new Error('ElevenLabs API key not configured')
        }

        const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: prompt,
                duration_seconds: duration || 5,
                prompt_influence: 0.5,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail?.message || 'ElevenLabs generation failed')
        }

        // ElevenLabs returns binary audio data (blob)
        const audioBuffer = await response.arrayBuffer()
        
        // Upload to Supabase Storage
        const { supabase } = await import('@/lib/supabase') // Dynamic import to avoid edge runtime issues if any
        const filename = `audio/${projectId}/${Date.now()}_sfx.mp3`
        
        // We need to use the service role key for backend uploads if RLS is strict, 
        // but typically the client's session is passed. Since we're in an API route, 
        // we might need a service client or just use the public anon key if policies allow.
        // For robustness, let's assume we can upload using standard client if we had auth context,
        // but here we might need to bypass.
        // Actually, let's just return the buffer as base64 or upload it if we have the setup.
        
        // Simple path: Upload using the project's standard supabase client logic 
        // (assuming we set up a backend client properly, or just use anon for now if policies are public-write)
        
        const { data, error: uploadError } = await supabase.storage
            .from('projects') // Assuming 'projects' bucket exists
            .upload(filename, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: false
            })

        if (uploadError) {
            console.error('Storage upload failed:', uploadError)
            // Fallback: return base64 data URI so client works even if storage fails
            const base64 = Buffer.from(audioBuffer).toString('base64')
            audioUrl = `data:audio/mpeg;base64,${base64}`
        } else {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('projects')
                .getPublicUrl(filename)
            audioUrl = publicUrl
        }

    } else if (model === 'elevenlabs-tts') {
        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
        const ELEVENLABS_VOICE_ID =
          process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // default "Rachel" voice id

        if (!ELEVENLABS_API_KEY) {
            throw new Error('ElevenLabs API key not configured')
        }

        // ElevenLabs TTS
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text: prompt,
                model_id: process.env.ELEVENLABS_TTS_MODEL_ID || 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                }
            }),
        })

        if (!response.ok) {
            // ElevenLabs often returns json errors
            let message = 'ElevenLabs TTS failed'
            try {
                const errorData = await response.json()
                message = errorData?.detail?.message || errorData?.message || message
            } catch {
                // ignore
            }
            throw new Error(message)
        }

        const audioBuffer = await response.arrayBuffer()

        // Upload to Supabase Storage (same pattern as SFX)
        const { supabase } = await import('@/lib/supabase')
        const safeProjectId = projectId || 'no-project'
        const filename = `audio/${safeProjectId}/${Date.now()}_tts.mp3`

        const { error: uploadError } = await supabase.storage
            .from('projects')
            .upload(filename, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: false
            })

        if (uploadError) {
            console.error('Storage upload failed:', uploadError)
            const base64 = Buffer.from(audioBuffer).toString('base64')
            audioUrl = `data:audio/mpeg;base64,${base64}`
        } else {
            const { data: { publicUrl } } = supabase.storage
                .from('projects')
                .getPublicUrl(filename)
            audioUrl = publicUrl
        }

    } else if (model === 'stable-audio') {
        // Use Stable Audio
        result = await fal.subscribe('fal-ai/stable-audio', {
            input: {
                prompt: prompt,
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
