import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getIntegrationKeyById, getElevenLabsKeyForUser } from '@/lib/integrations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('audio') as File
    const voiceId = formData.get('voice_id') as string
    const integrationId = formData.get('integration_id') as string | null
    const projectId = req.nextUrl.searchParams.get('projectId') || 'no-project'

    if (!file || !voiceId) {
      return NextResponse.json(
        { error: 'Audio file and voice_id are required' },
        { status: 400 }
      )
    }

    // Get API Key
    let apiKey: string | null = null
    if (integrationId) {
      apiKey = await getIntegrationKeyById(integrationId, user.id)
    } else {
      apiKey = await getElevenLabsKeyForUser(user.id)
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No ElevenLabs API key found. Please connect your account in Settings.' },
        { status: 400 }
      )
    }

    // Prepare for ElevenLabs STS (voice conversion). Do not use TTS model_id - v2 models don't support STS.
    const elFormData = new FormData()
    elFormData.append('audio', file)
    // Omitting model_id lets the STS endpoint use its default STS-capable model.

    // Call ElevenLabs STS
    const response = await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('ElevenLabs STS Error:', errorData)

      // Parse ElevenLabs error shape: detail can be { message }, string, or array of messages
      const detail = errorData.detail
      let message = errorData.message || 'Failed to transform voice'
      if (detail) {
        if (typeof detail === 'string') message = detail
        else if (detail?.message) message = detail.message
        else if (Array.isArray(detail) && detail.length > 0) message = detail.map((d: any) => d?.message || d).filter(Boolean).join('. ')
      }

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: message || 'Invalid API key' }, { status: response.status })
      }
      if (response.status === 429) {
        return NextResponse.json({ error: message || 'ElevenLabs quota exceeded' }, { status: 429 })
      }

      return NextResponse.json(
        { error: message },
        { status: response.status }
      )
    }

    // Get audio buffer
    const audioBuffer = await response.arrayBuffer()

    // Save to user-media bucket (same as F5 voice-changer; projects bucket may not exist)
    const filename = `audio/${projectId}/${Date.now()}_sts_${voiceId}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('user-media')
      .upload(filename, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      const msg = uploadError.message || 'Storage upload failed'
      return NextResponse.json(
        { error: `Failed to save audio: ${msg}. Ensure the "user-media" bucket exists and is writable.` },
        { status: 500 }
      )
    }

    const { data: { publicUrl } } = supabase.storage
      .from('user-media')
      .getPublicUrl(filename)

    // Calculate duration roughly (mp3 is ~128kbps => ~16KB/s)
    // Actually better to let client handle it or use metadata, but for now approximation is okay
    // or just return 0 and let client update it on load
    const estimatedDuration = Math.max(1, Math.ceil(audioBuffer.byteLength / 16000))

    return NextResponse.json({
      success: true,
      audioUrl: publicUrl,
      duration: estimatedDuration
    })

  } catch (error: any) {
    console.error('Voice changer error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
