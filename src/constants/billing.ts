export const BILLING_PLANS_V2 = {
  STARTER: {
    id: 'starter',
    name: 'Starter',
    coins: 800,
    priceMonthly: 7.99,
    description: '2+ Full Video Productions',
    // Replace with actual Lemon Squeezy Variant IDs when available
    variantIdMonthly: '1246457', 
    variantIdYearly: '1246388',
    features: [
      '800 Coins / month',
      'Standard generation speed',
      'Public gallery access',
      'Basic models (Flux Dev)',
    ],
    notIncluded: [
      'Commercial usage rights',
      'Priority support',
    ],
    popular: false,
  },
  CREATOR: {
    id: 'creator',
    name: 'Creator',
    coins: 2000,
    priceMonthly: 17.99,
    description: 'Social Media Bundle',
    variantIdMonthly: '1246442',
    variantIdYearly: '1246471',
    features: [
      '2,000 Coins / month',
      'Fast generation speed',
      'Commercial usage rights',
      'Access to Flux Pro & Kling',
      'Private gallery',
    ],
    notIncluded: [
      'API access',
    ],
    popular: false,
  },
  STUDIO: {
    id: 'studio',
    name: 'Studio',
    coins: 6000,
    priceMonthly: 47.99,
    description: 'Professional Library',
    variantIdMonthly: '1246447',
    variantIdYearly: '1246478',
    features: [
      '6,000 Coins / month',
      'Turbo generation speed',
      '10% Volume Discount',
      'Priority support (Email)',
      'Early access to new models',
    ],
    notIncluded: [],
    popular: true,
  },
} as const;

/** Display price = cost * CREDIT_DISPLAY_MULTIPLIER (2.5x our cost) */
export const CREDIT_DISPLAY_MULTIPLIER = 2.5

export function getDisplayCredits(cost: number): number {
  return Math.round(cost * CREDIT_DISPLAY_MULTIPLIER)
}

export const CREDIT_COSTS = {
  VIDEO_GENERATION: '25-110', // Range covers LTX (25) to Kling 10s (110)
  NANO_BANANA: '12',          // Nano Pro & Nano Fast: image.nano_banana.text_to_image (12)
  EDITS: '15-18',             // Matches image.flux.edit (15) and image.nano_banana.edit (18)
} as const;

export const CREDIT_PRICING_KEYS = {
  VIDEO_VIDU_5S: 'video.vidu.5s',
  VIDEO_VIDU_10S: 'video.vidu.10s',
  VIDEO_LTX_2S: 'video.ltx.2s',
  VIDEO_KLING_5S: 'video.kling.5s',
  VIDEO_KLING_10S: 'video.kling.10s',
  IMAGE_REEVE_TEXT: 'image.reeve.text_to_image',
  IMAGE_REEVE_EDIT: 'image.reeve.edit',
  IMAGE_REEVE_REMIX: 'image.reeve.remix',
  IMAGE_NANO_BANANA_TEXT: 'image.nano_banana.text_to_image',
  IMAGE_NANO_BANANA_EDIT: 'image.nano_banana.edit',
  IMAGE_FLUX_TEXT: 'image.flux.text_to_image',
  IMAGE_FLUX_EDIT: 'image.flux.edit',
  AUDIO_WHISPER_TRANSCRIBE: 'audio.whisper.transcribe',
} as const
