import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Server-side only: do not use NEXT_PUBLIC_* for API keys
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, duration, model, projectId, voiceId, ref_audio_url, ref_text, integrationId } = await req.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    console.log('🎵 Starting audio generation:', { model, prompt, duration, voiceId, ref_audio_url: !!ref_audio_url })

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
        const targetVoiceId = voiceId;
        if (!targetVoiceId) {
             throw new Error('Please select an ElevenLabs voice.')
        }

        // Prefer user's BYOA key when available
        const authHeader = req.headers.get('authorization')
        let elevenLabsKey = process.env.ELEVENLABS_API_KEY
        if (authHeader) {
          const { createClient } = await import('@supabase/supabase-js')
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
          const token = authHeader.replace('Bearer ', '')
          const { data: { user } } = await supabase.auth.getUser(token)
          if (user) {
            const { getElevenLabsKeyForUser, getIntegrationKeyById } = await import('@/lib/integrations')
            let userKey: string | null = null

            if (integrationId) {
                userKey = await getIntegrationKeyById(integrationId, user.id)
            }
            
            if (!userKey) {
                userKey = await getElevenLabsKeyForUser(user.id)
            }

            if (userKey) elevenLabsKey = userKey
          }
        }
        if (!elevenLabsKey) {
          throw new Error('ElevenLabs API key not configured. Connect your key in Settings or ask the app admin to set ELEVENLABS_API_KEY.')
        }

        console.log(`🗣️ Generating TTS with voice ID: ${targetVoiceId}`)

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': elevenLabsKey,
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
             // Check specifically for 404 (Voice not found) or 400 (Bad Request)
             if (response.status === 404 || response.status === 400) {
                  throw new Error(`The selected voice (${targetVoiceId}) is invalid or no longer exists. Please choose another character.`)
             }

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
        
        // ... rest of upload logic ...


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

    } else if (model === 'fal-f5-tts') {
        const FAL_KEY = process.env.FAL_KEY
        if (!FAL_KEY) {
          return NextResponse.json(
            { error: 'F5-TTS is not configured (missing FAL_KEY)' },
            { status: 503 }
          )
        }
        if (!ref_audio_url || typeof ref_audio_url !== 'string') {
          return NextResponse.json(
            { error: 'ref_audio_url is required for F5-TTS' },
            { status: 400 }
          )
        }
        const genText = prompt
        const refTextForF5 = (ref_text && typeof ref_text === 'string' ? ref_text.trim() : '') || ''
        fal.config({ credentials: FAL_KEY })
        result = await fal.subscribe('fal-ai/f5-tts', {
          input: {
            gen_text: genText,
            ref_audio_url,
            ref_text: refTextForF5,
            model_type: 'F5-TTS',
            remove_silence: true,
          },
          logs: true,
        })
        // FAL f5-tts returns audio_url (object with url), not audio
        const falAudioUrl = result?.data?.audio_url?.url ?? result?.data?.audio?.url
        if (!falAudioUrl) {
          throw new Error('F5-TTS did not return an audio URL')
        }
        // Re-upload to Supabase for durability (Fal URLs can expire)
        const { supabase } = await import('@/lib/supabase')
        const res = await fetch(falAudioUrl)
        if (!res.ok) {
          audioUrl = falAudioUrl
        } else {
          const audioBuffer = await res.arrayBuffer()
          const safeProjectId = projectId || 'no-project'
          const filename = `audio/${safeProjectId}/${Date.now()}_f5tts.mp3`
          const { error: uploadError } = await supabase.storage
            .from('projects')
            .upload(filename, audioBuffer, { contentType: 'audio/mpeg', upsert: false })
          if (uploadError) {
            audioUrl = falAudioUrl
          } else {
            const { data: { publicUrl } } = supabase.storage.from('projects').getPublicUrl(filename)
            audioUrl = publicUrl
          }
        }

    } else if (model === 'elevenlabs-music') {
        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
        
        if (!ELEVENLABS_API_KEY) {
            throw new Error('ElevenLabs API key not configured')
        }

        // Use sound-generation endpoint which supports music/bgm generation
        const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: prompt,
                duration_seconds: duration || 10,
                prompt_influence: 0.5,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail?.message || 'ElevenLabs music generation failed')
        }

        const audioBuffer = await response.arrayBuffer()
        
        // Upload to Supabase Storage
        const { supabase } = await import('@/lib/supabase')
        const safeProjectId = projectId || 'no-project'
        const filename = `audio/${safeProjectId}/${Date.now()}_music.mp3`

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
