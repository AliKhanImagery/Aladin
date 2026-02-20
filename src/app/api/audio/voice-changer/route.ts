import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  try {
    const FAL_KEY = process.env.FAL_KEY
    if (!FAL_KEY) {
      return NextResponse.json(
        { error: 'Voice changer is not configured (missing FAL_KEY)' },
        { status: 503 }
      )
    }
    fal.config({ credentials: FAL_KEY })

    let ref_audio_url: string
    let ref_text_for_f5: string = ''
    let recordingUrl: string

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File
      const refUrl = formData.get('ref_audio_url') as string
      const refTextRaw = (formData.get('ref_text') as string)?.trim()
      ref_text_for_f5 = (refTextRaw && typeof refTextRaw === 'string' ? refTextRaw : '') || ''
      const transcriptOverride = (formData.get('transcript') as string)?.trim()
      if (!file || !refUrl || typeof refUrl !== 'string') {
        return NextResponse.json(
          { error: 'file and ref_audio_url are required' },
          { status: 400 }
        )
      }
      ref_audio_url = refUrl.trim()
      if (transcriptOverride) {
        const f5Result = await fal.subscribe('fal-ai/f5-tts', {
          input: {
            gen_text: transcriptOverride,
            ref_audio_url,
            ref_text: ref_text_for_f5,
            model_type: 'F5-TTS',
            remove_silence: true,
          },
          logs: true,
        })
        // FAL f5-tts returns audio_url (object with url), or sometimes audio.url
        const data = f5Result?.data as { audio_url?: { url?: string }; audio?: { url?: string } } | undefined
        const falAudioUrl = data?.audio_url?.url ?? data?.audio?.url
        if (!falAudioUrl) {
          return NextResponse.json({ error: 'F5-TTS did not return audio' }, { status: 500 })
        }
        const { supabase } = await import('@/lib/supabase')
        const projectId = req.nextUrl.searchParams.get('projectId') || 'no-project'
        let audioUrl = falAudioUrl
        try {
          const res = await fetch(falAudioUrl)
          if (res.ok) {
            const audioBuffer = await res.arrayBuffer()
            const filename = `audio/${projectId}/${Date.now()}_voicechanger.mp3`
            const { error: uploadErr } = await supabase.storage
              .from('projects')
              .upload(filename, audioBuffer, { contentType: 'audio/mpeg', upsert: false })
            if (!uploadErr) {
              const { data: { publicUrl } } = supabase.storage.from('projects').getPublicUrl(filename)
              audioUrl = publicUrl
            }
          }
        } catch (_) {}
        const duration = Math.max(1, Math.ceil(transcriptOverride.length * 0.12))
        return NextResponse.json({ success: true, audioUrl, duration, transcript: transcriptOverride })
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const ext = (file.name.split('.').pop() || 'webm').toLowerCase()
      const path = `voice-changer-temp/${crypto.randomUUID()}.${ext}`
      const arrayBuffer = await file.arrayBuffer()
      const { error: uploadError } = await supabase.storage
        .from('user-media')
        .upload(path, arrayBuffer, { contentType: file.type, upsert: false })
      if (uploadError) {
        console.error('Voice changer temp upload failed:', uploadError)
        return NextResponse.json({ error: 'Failed to upload recording' }, { status: 500 })
      }
      const { data: { publicUrl } } = supabase.storage.from('user-media').getPublicUrl(path)
      recordingUrl = publicUrl
    } else {
      const body = await req.json()
      const { recording_url, ref_audio_url: refUrl, ref_text: refText } = body
      ref_text_for_f5 = (refText && typeof refText === 'string' ? refText.trim() : '') || ''
      if (!recording_url || !refUrl || typeof refUrl !== 'string') {
        return NextResponse.json(
          { error: 'recording_url and ref_audio_url are required' },
          { status: 400 }
        )
      }
      ref_audio_url = refUrl.trim()
      recordingUrl = recording_url
    }

    // 1. Transcribe with Whisper
    const whisperResult = await fal.subscribe('fal-ai/whisper', {
      input: { audio_url: recordingUrl },
      logs: true,
    })
    const text = (whisperResult?.data?.text ?? '').trim()
    if (!text) {
      return NextResponse.json(
        { error: 'No speech detected in the recording' },
        { status: 400 }
      )
    }

    // 2. Synthesize with F5-TTS
    const f5Result = await fal.subscribe('fal-ai/f5-tts', {
      input: {
        gen_text: text,
        ref_audio_url,
        ref_text: ref_text_for_f5,
        model_type: 'F5-TTS',
        remove_silence: true,
      },
      logs: true,
    })
    // FAL f5-tts returns audio_url (object with url), or sometimes audio.url
    const data = f5Result?.data as { audio_url?: { url?: string }; audio?: { url?: string } } | undefined
    const falAudioUrl = data?.audio_url?.url ?? data?.audio?.url
    if (!falAudioUrl) {
      return NextResponse.json(
        { error: 'F5-TTS did not return audio' },
        { status: 500 }
      )
    }

    // 3. Optionally re-upload to projects bucket for durability
    const { supabase } = await import('@/lib/supabase')
    const projectId = req.nextUrl.searchParams.get('projectId') || 'no-project'
    let audioUrl = falAudioUrl
    try {
      const res = await fetch(falAudioUrl)
      if (res.ok) {
        const audioBuffer = await res.arrayBuffer()
        const filename = `audio/${projectId}/${Date.now()}_voicechanger.mp3`
        const { error: uploadErr } = await supabase.storage
          .from('projects')
          .upload(filename, audioBuffer, { contentType: 'audio/mpeg', upsert: false })
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('projects').getPublicUrl(filename)
          audioUrl = publicUrl
        }
      }
    } catch (_) {
      // keep Fal URL as fallback
    }

    // Rough duration estimate (e.g. ~0.15s per character) or leave for client
    const duration = Math.max(1, Math.ceil((text.length * 0.12)))

    return NextResponse.json({
      success: true,
      audioUrl,
      duration,
      transcript: text,
    })
  } catch (error: any) {
    console.error('Voice changer error:', error)
    return NextResponse.json(
      { error: error.message || 'Voice conversion failed' },
      { status: 500 }
    )
  }
}
