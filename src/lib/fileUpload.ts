import { fal } from '@fal-ai/client'

// Configure Fal AI client for file uploads
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

/**
 * Upload file to Fal AI storage and get URL
 */
export async function uploadFileToFal(file: File): Promise<string> {
  try {
    const url = await fal.storage.upload(file)
    return url
  } catch (error) {
    console.error('File upload error:', error)
    throw new Error('Failed to upload file')
  }
}

/**
 * Convert file to base64 data URI
 */
export function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Validate file type
 */
export function isValidImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isValidVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

