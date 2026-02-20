import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const name = formData.get('name') as string
        const file = formData.get('file') as File
        const description = formData.get('description') as string
        const ref_text = (formData.get('ref_text') as string)?.trim() || null

        if (!name || !file) {
            return NextResponse.json({ error: 'Name and file are required' }, { status: 400 })
        }

        // Authenticate user
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const authHeader = req.headers.get('authorization')
        
        if (!authHeader) {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user has hit limit (5) before even trying to clone
        const { count, error: countError } = await supabase
            .from('voice_characters')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
        
        if ((count || 0) >= 5) {
            return NextResponse.json({ error: 'Voice limit reached (max 5)' }, { status: 403 })
        }

        // 1. Upload the sample file to Supabase Storage (F5 uses ref_audio_url from preview_url)
        const fileExt = (file.name.split('.').pop() || 'mp3').toLowerCase()
        const voiceId = crypto.randomUUID()
        const filename = `voice-samples/${user.id}/${voiceId}.${fileExt}`
        const arrayBuffer = await file.arrayBuffer()

        const { error: uploadError } = await supabase.storage
            .from('user-media')
            .upload(filename, arrayBuffer, {
                contentType: file.type,
                upsert: true
            })

        if (uploadError) {
            console.error('Storage upload failed:', uploadError)
            return NextResponse.json({ error: 'Failed to upload voice sample' }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage
            .from('user-media')
            .getPublicUrl(filename)
        const previewUrl = publicUrl

        // 2. Save to our database (provider fal-f5; preview_url is ref_audio_url for F5-TTS)
        const { data: voiceRecord, error: dbError } = await supabase
            .from('voice_characters')
            .insert({
                user_id: user.id,
                name,
                provider: 'fal-f5',
                provider_voice_id: voiceId,
                preview_url: previewUrl,
                ref_text
            })
            .select()
            .single()

        if (dbError) {
            console.error('Failed to save voice record:', dbError)
            return NextResponse.json({ error: 'Voice sample saved but failed to save to database' }, { status: 500 })
        }

        return NextResponse.json({ success: true, voice: voiceRecord })

    } catch (error: any) {
        console.error('Clone error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
