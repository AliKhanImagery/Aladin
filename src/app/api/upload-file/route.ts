import { NextRequest, NextResponse } from 'next/server'
import { uploadFileToFal } from '@/lib/fileUpload'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Enforce max upload size (2MB) so users can manage Fal/Flux constraints upstream.
    // Note: This is the raw file size; image megapixels may still exceed model limits.
    const MAX_BYTES = 2 * 1024 * 1024
    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File too large', details: 'Max file size is 2MB. Please compress or resize the image and try again.' },
        { status: 413 }
      )
    }

    // Upload to Fal AI storage
    const fileUrl = await uploadFileToFal(file)

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    })
  } catch (error: any) {
    console.error('File upload error:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

