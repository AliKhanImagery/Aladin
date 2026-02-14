import { NextRequest, NextResponse } from 'next/server'

const GEMINI_VISION_MODEL = 'gemini-1.5-flash'

type AssetType = 'character' | 'product' | 'object'

const PROMPTS: Record<AssetType, string> = {
  character: `Look at this person. In ONE ultra-short sentence (max 25 characters), summarize only the most vital visual details: face/hair/clothing. Example: "Man in black coat". Reply with only that sentence, no quotes or preamble.`,
  product: `Look at this product. In ONE ultra-short sentence (max 25 characters), summarize its key visual details. Example: "Red soda can". Reply with only that sentence, no quotes or preamble.`,
  object: `Look at this object. In ONE ultra-short sentence (max 25 characters), summarize its key visual details. Example: "Silver wristwatch". Reply with only that sentence, no quotes or preamble.`,
}

/**
 * Fetches image from URL and returns base64 + mime type.
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(imageUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const base64 = buf.toString('base64')
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const mimeType = contentType.split(';')[0].trim()
  return { data: base64, mimeType }
}

/**
 * Extracts a short visual "DNA" from an asset image using Gemini vision.
 * Used once at "Continue to Storyboard" for characters, products, and objects (not locations).
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { imageUrl, assetType } = body as { imageUrl?: string; assetType?: AssetType }

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'Valid imageUrl is required' },
        { status: 400 }
      )
    }
    if (!assetType || !PROMPTS[assetType]) {
      return NextResponse.json(
        { error: 'assetType must be one of: character, product, object' },
        { status: 400 }
      )
    }

    const { data: base64Data, mimeType } = await fetchImageAsBase64(imageUrl)
    const prompt = PROMPTS[assetType]

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            max_output_tokens: 128,
            temperature: 0.2,
          },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini extract-asset-dna error:', response.status, errText)
      return NextResponse.json(
        { error: 'Vision extraction failed', details: errText.slice(0, 200) },
        { status: 502 }
      )
    }

    const result = await response.json()
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text
    let dna = typeof text === 'string' ? text.trim() : ''

    // Enforce strict 25 character limit manually if model exceeds it
    if (dna.length > 25) {
      dna = dna.slice(0, 25).trim()
    }

    return NextResponse.json({ dna: dna || '' })
  } catch (e: any) {
    console.error('extract-asset-dna error:', e?.message || e)
    return NextResponse.json(
      { error: e?.message || 'Extraction failed' },
      { status: 500 }
    )
  }
}
