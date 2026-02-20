import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getElevenLabsIntegrations } from '@/lib/integrations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const integrations = await getElevenLabsIntegrations(user.id)
    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ connected: false, voices: [] })
    }

    const allVoices: any[] = []
    const connectionStatuses: Record<string, { status: string, message?: string }> = {}
    let hasError = false
    let errorType = null
    let errorDetail = null

    // Fetch in parallel
    await Promise.all(integrations.map(async (integration) => {
      try {
        const res = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': integration.api_key },
        })

        if (res.status === 401 || res.status === 403) {
          const errBody = await res.json().catch(() => ({}))
          const msg = errBody.detail?.message || errBody.detail || 'Invalid API key'
          connectionStatuses[integration.id] = { status: 'error', message: msg }
          
          console.error(`ElevenLabs Auth Error (${integration.name}):`, errBody)
          hasError = true
          errorType = 'invalid_key'
          errorDetail = msg
          return
        }

        if (!res.ok) {
          const msg = `API Error: ${res.status}`
          connectionStatuses[integration.id] = { status: 'error', message: msg }
          
          console.error(`ElevenLabs API error (${integration.name}):`, res.status)
          hasError = true
          errorType = 'api_error'
          return
        }

        connectionStatuses[integration.id] = { status: 'connected' }
        const data = await res.json()
        const voices = (data.voices || []).map((v: any) => ({
          voice_id: v.voice_id,
          name: v.name || 'Unnamed',
          preview_url: v.preview_url || (v.samples?.[0]?.audio_url) || null,
          category: v.category || null,
          source_id: integration.id, // Track which key this came from
          source_name: integration.name // Optional, for UI
        }))
        allVoices.push(...voices)
      } catch (err: any) {
        connectionStatuses[integration.id] = { status: 'error', message: err.message || 'Network error' }
        console.error(`Fetch failed for ${integration.name}:`, err)
        hasError = true
      }
    }))

    // Return voices and statuses
    return NextResponse.json({
      connected: !hasError || allVoices.length > 0,
      voices: allVoices,
      connectionStatuses,
      error: hasError ? (errorType || 'api_error') : null,
      details: errorDetail
    })
  } catch (e: any) {
    console.error('ElevenLabs voices GET:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error', connected: false, voices: [] },
      { status: 500 }
    )
  }
}
