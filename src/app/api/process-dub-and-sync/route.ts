import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { getServerSupabaseClient } from '@/lib/mediaStorage'

// Configure Fal
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

/**
 * Orchestrates the Dubbing + Extension + LipSync flow
 * 
 * Logic:
 * 1. Validates inputs
 * 2. Checks durations (Audio A vs Video V)
 * 3. Extends video if A > V (up to 10s limit)
 * 4. Runs Kling LipSync
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse & Validate
    const body = await request.json()
    const { 
      videoUrl, 
      audioUrl, 
      videoDuration, 
      audioDuration, // Expected or actual duration in seconds
      prompt = "Continue the scene naturally, maintaining the same style and motion." 
    } = body

    if (!videoUrl || !audioUrl || !videoDuration || !audioDuration) {
      return NextResponse.json(
        { error: 'Missing required fields: videoUrl, audioUrl, videoDuration, audioDuration' }, 
        { status: 400 }
      )
    }

    // 2. Duration Check & Constraints
    // Kling limit is 10s. If audio is longer, we can't use Kling cleanly on the whole clip.
    if (audioDuration > 10) {
      return NextResponse.json(
        { 
          error: 'Audio duration exceeds 10s limit.',
          code: 'DURATION_LIMIT_EXCEEDED',
          details: 'Kling LipSync only supports videos up to 10 seconds.'
        }, 
        { status: 400 }
      )
    }

    let targetVideoUrl = videoUrl

    // 3. Extend Logic: If Audio is longer than Video (and > 5s), extend first
    if (audioDuration > videoDuration && audioDuration > 5) {
      console.log(`🔄 Extending video... Audio (${audioDuration}s) > Video (${videoDuration}s)`)
      
      const secondsToAdd = audioDuration - videoDuration
      // LTX-2 uses ~25fps. Calculate frames needed.
      const framesToGenerate = Math.ceil(secondsToAdd * 25)
      
      // Minimum practical frames for LTX might be around 16-24, but let's trust the math
      // Add a small buffer (e.g. 5 frames) to ensure we cover the audio
      const numFrames = framesToGenerate + 5

      try {
        const extensionResult: any = await fal.subscribe('fal-ai/ltx-2-19b/distilled/extend-video', {
          input: {
            video_url: videoUrl,
            prompt: prompt,
            num_frames: numFrames,
            match_input_fps: true
          },
          logs: true,
        })
        
        if (extensionResult?.data?.video?.url) {
          targetVideoUrl = extensionResult.data.video.url
          console.log('✅ Video extended:', targetVideoUrl)
        } else {
          throw new Error('No video URL in extension result')
        }
      } catch (extError: any) {
        console.error('❌ Extension failed:', extError)
        // Fallback: Try to sync with original, or fail? 
        // For now, let's fail because sync will look bad if audio >> video
        return NextResponse.json(
          { error: 'Failed to extend video', details: extError.message }, 
          { status: 500 }
        )
      }
    }

    // 4. Lip Sync (Kling)
    console.log('👄 Starting Kling LipSync...')
    const syncResult: any = await fal.subscribe('fal-ai/kling-video/lipsync/audio-to-video', {
      input: {
        video_url: targetVideoUrl,
        audio_url: audioUrl
      },
      logs: true
    })

    if (!syncResult?.data?.video?.url) {
      throw new Error('No video URL in lip-sync result')
    }

    const finalUrl = syncResult.data.video.url
    console.log('✅ LipSync complete:', finalUrl)

    // TODO: Store finalUrl to Supabase (user_videos) if needed, or return to client to handle save

    return NextResponse.json({
      success: true,
      videoUrl: finalUrl,
      wasExtended: targetVideoUrl !== videoUrl
    })

  } catch (error: any) {
    console.error('❌ Process Dub & Sync Error:', error)
    return NextResponse.json(
      { error: 'Processing failed', details: error.message }, 
      { status: 500 }
    )
  }
}
