import { NextRequest, NextResponse } from 'next/server'
import { downloadAndStoreMedia } from '@/lib/mediaStorage'
import { supabase } from '@/lib/supabase'

/**
 * API Endpoint: Store Media from External URL
 * 
 * Downloads media from external URL (e.g., Fal AI) and stores it permanently
 * in Supabase Storage, then saves metadata to database.
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      externalUrl, 
      type, // 'image' | 'video' | 'thumbnail'
      projectId,
      clipId,
      metadata = {} 
    } = await request.json()

    // Validate inputs
    if (!externalUrl || typeof externalUrl !== 'string') {
      return NextResponse.json(
        { error: 'externalUrl is required and must be a string' },
        { status: 400 }
      )
    }

    if (!type || !['image', 'video', 'thumbnail'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: image, video, thumbnail' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`🔄 Storing media from external URL:`, {
      url: externalUrl.substring(0, 100),
      type,
      userId: user.id,
      projectId,
      clipId,
    })

    // Download and store in Supabase Storage
    const storageResult = await downloadAndStoreMedia(
      externalUrl,
      user.id,
      type,
      {
        projectId,
        clipId,
        ...metadata,
      }
    )

    if (!storageResult.success) {
      console.error('❌ Failed to store media:', storageResult.error)
      return NextResponse.json(
        {
          error: storageResult.error || 'Failed to store media',
          errorCode: storageResult.errorCode,
        },
        { status: 500 }
      )
    }

    // Save metadata to database
    const tableName = type === 'video' ? 'user_videos' : 'user_images'
    const urlField = type === 'video' ? 'video_url' : 'image_url'

    const dbRecord: any = {
      user_id: user.id,
      [urlField]: storageResult.publicUrl, // Use Supabase Storage URL
      storage_path: storageResult.storagePath,
      storage_bucket: storageResult.bucket,
      project_id: projectId || null,
      clip_id: clipId || null,
      metadata: metadata || {},
    }

    // Add type-specific fields
    if (metadata.prompt) dbRecord.prompt = metadata.prompt
    if (metadata.model) dbRecord.model = metadata.model
    if (metadata.aspect_ratio) dbRecord.aspect_ratio = metadata.aspect_ratio
    if (metadata.duration) dbRecord.duration = metadata.duration
    if (metadata.thumbnail_url) dbRecord.thumbnail_url = metadata.thumbnail_url

    const { data: dbData, error: dbError } = await supabase
      .from(tableName)
      .insert(dbRecord)
      .select()
      .single()

    if (dbError) {
      console.error('❌ Failed to save metadata to database:', dbError)
      // Don't fail the whole operation - file is already in storage
      // Just log the error and return the storage result
      console.warn('⚠️ Media stored but metadata save failed. Storage URL:', storageResult.publicUrl)
    }

    return NextResponse.json({
      success: true,
      storagePath: storageResult.storagePath,
      publicUrl: storageResult.publicUrl,
      bucket: storageResult.bucket,
      dbRecord: dbData || null,
      warning: dbError ? 'Media stored but metadata save failed' : undefined,
    })
  } catch (error: any) {
    console.error('❌ Exception in store-media API:', error)
    return NextResponse.json(
      {
        error: 'Failed to store media',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

