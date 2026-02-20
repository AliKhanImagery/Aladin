import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fal } from '@fal-ai/client'
import { getServerSupabaseClient } from '@/lib/mediaStorage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const PRICING_KEY = 'audio.whisper.transcribe'

async function getAuthenticatedUserAndToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (user && !error) return { user, accessToken: token }
  }
  const cookieHeader = request.headers.get('cookie') || ''
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
  const cookiePattern = new RegExp(`sb-${projectRef.replace(/[^a-z0-9]/gi, '')}-auth-token=([^;]+)`, 'i')
  const match = cookieHeader.match(cookiePattern) || cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/i)
  if (match?.[1]) {
    let token = match[1]
    try {
      const sessionData = JSON.parse(decodeURIComponent(match[1]))
      token = sessionData.access_token || sessionData.accessToken || token
    } catch { /* token as-is */ }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (user && !error) return { user, accessToken: token }
  }
  return { user: null, accessToken: null }
}

export async function POST(req: NextRequest) {
  try {
    const FAL_KEY = process.env.FAL_KEY
    if (!FAL_KEY) {
      return NextResponse.json(
        { error: 'Transcribe is not configured (missing FAL_KEY)' },
        { status: 503 }
      )
    }
    fal.config({ credentials: FAL_KEY })

    const { user, accessToken } = await getAuthenticatedUserAndToken(req)
    if (!user || !accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User authentication required' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const languageRaw = (formData.get('language') as string)?.trim()
    const language = languageRaw && languageRaw !== 'auto' ? languageRaw : undefined

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      )
    }

    const billingClient = await getServerSupabaseClient(accessToken)
    const { data: priceRow, error: priceError } = await billingClient
      .from('credit_pricing')
      .select('cost')
      .eq('key', PRICING_KEY)
      .eq('active', true)
      .single()

    if (priceError || !priceRow?.cost || priceRow.cost < 1) {
      return NextResponse.json(
        { error: 'Transcribe pricing not available' },
        { status: 503 }
      )
    }
    const cost = Number(priceRow.cost)

    const spendResult = await billingClient.rpc('spend_credits', {
      p_cost: cost,
      p_reason: PRICING_KEY,
      p_metadata: { language: language || 'auto' },
    })

    if (spendResult.error) {
      const msg = spendResult.error.message || ''
      if (msg.includes('insufficient_credits')) {
        return NextResponse.json(
          { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS', required: cost },
          { status: 402 }
        )
      }
      return NextResponse.json(
        { error: 'Billing error', details: msg },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const ext = (file.name.split('.').pop() || 'webm').toLowerCase()
    const path = `voice-changer-temp/${crypto.randomUUID()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('user-media')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Transcribe temp upload failed:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload audio' },
        { status: 500 }
      )
    }
    const { data: { publicUrl } } = supabase.storage.from('user-media').getPublicUrl(path)

    const whisperInput: { audio_url: string; language?: string } = { audio_url: publicUrl }
    if (language) whisperInput.language = language

    const result = await fal.subscribe('fal-ai/whisper', {
      input: whisperInput as { audio_url: string; language?: 'en' | 'es' | 'fr' },
      logs: true,
    })
    const text = (result?.data?.text ?? '').trim()

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('Transcribe error:', error)
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    )
  }
}
