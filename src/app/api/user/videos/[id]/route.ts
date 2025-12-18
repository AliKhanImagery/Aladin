import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// DELETE - Delete user video
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Verify ownership before deleting
    const { data: video, error: fetchError } = await supabase
      .from('user_videos')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('user_videos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting user video:', error)
      return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/user/videos/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

