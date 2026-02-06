# Dubbing & Lip Sync Implementation Plan

## Overview
We are implementing a robust Dubbing and Lip Sync workflow using **ElevenLabs** (for audio/dubbing) and **Fal.ai** (for video extension and lip-syncing).

## Constraints
1.  **Kling Lip Sync Limit:** The `fal-ai/kling-video/lipsync/audio-to-video` endpoint has a hard limit of **10 seconds** for input video.
2.  **Audio Mismatch:** Translated/Generated audio often differs in length from the source video.

## The "Extend + Sync" Logic Flow

We will handle clips up to **10 seconds** for this release.

### 1. Get Audio Duration (`A`)
-   **Dubbing (Video-to-Video):** Call ElevenLabs `POST /v1/dubbing`. It returns `expected_duration_sec`. Use this as `A`.
-   **TTS (Text-to-Speech):** Generate audio first, then read the file duration. Use this as `A`.

### 2. Decision Matrix
Let `V` be the current Video Clip duration.

| Condition | Action | Logic |
| :--- | :--- | :--- |
| **`A > 10s`** | 🛑 **Block** | Return error: "Audio too long (limit 10s). Please trim." |
| **`A > V`** (and `A > 5s`) | 🔄 **Extend → Sync** | 1. Calculate extension needed.<br>2. Call LTX-2 to extend video.<br>3. Call Kling to lip-sync extended video. |
| **`A <= V`** | ✅ **Sync Directly** | Call Kling Lip Sync with original video. |

---

## Technical Implementation

### Endpoint: `POST /api/process-dub-and-sync`

#### Step 1: Calculate Extension (Math)
If extension is needed (`A > V`):
1.  `SecondsToAdd (Δ) = A - V`
2.  `FramesToGenerate = ceil(Δ * 25)`
    *   *Note:* LTX-2 uses ~25 FPS by default.
    *   *Limit:* Max frames for LTX is 481 (~19s), so we are safe within the 10s total limit.

#### Step 2: Extend Video (LTX-2)
*   **Model:** `fal-ai/ltx-2-19b/distilled/extend-video`
*   **Inputs:**
    *   `video_url`: Original clip URL
    *   `prompt`: "Continue the scene naturally..."
    *   `num_frames`: Calculated `FramesToGenerate`
    *   `match_input_fps`: `true`

#### Step 3: Lip Sync (Kling)
*   **Model:** `fal-ai/kling-video/lipsync/audio-to-video`
*   **Inputs:**
    *   `video_url`: Result from Step 2 (or original if no extension)
    *   `audio_url`: Audio from ElevenLabs

### User Prompting (Pre-computation)
To warn users before they generate:
*   **Estimation Formula:** `Estimated Seconds ≈ Character Count / 15`
*   **UI Hint:** If text length > 150 chars, warn: "This may exceed the 10s video limit."

---

## Future Roadmap
-   Support >10s by splitting video into chunks, syncing individually, and stitching.
-   Use `fal-ai/sync-lipsync/v2/pro` for long-form content where strict Kling visual quality is less critical than synchronization.
