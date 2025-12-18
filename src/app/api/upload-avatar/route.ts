import { NextRequest, NextResponse } from 'next/server'
import { uploadAvatarToSupabase } from '@/lib/supabaseStorage'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - User ID is required' },
        { status: 401 }
      )
    }

    // Upload to Supabase Storage
    // Note: RLS policies on storage bucket will verify user has permission
    const fileUrl = await uploadAvatarToSupabase(file, userId)

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload avatar',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}