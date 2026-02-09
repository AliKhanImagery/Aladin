'use client'

import { StudioLayout } from '@/components/editor/StudioLayout'
import { AudioGenerationDrawer } from '@/components/drawers/AudioGenerationDrawer'

export default function TimelineTab() {
  return (
    <>
      <StudioLayout />
      <AudioGenerationDrawer />
    </>
  )
}
