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

