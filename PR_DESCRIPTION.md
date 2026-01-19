# Omni Editor v1 Beta - Unified Creative Workflow

## Summary
This major update introduces the **Omni Editor**, a complete redesign of the `ClipDetailDrawer`. It unifies image and video generation into a single "Stage" with distinct "Visualize" and "Animate" workflows. It also adds a global asset library, duplicate file detection, a generation history strip, and intelligent prompt injection for character consistency.

## 🎯 Main Features

### 1. Omni Editor Redesign (ClipDetailDrawer)
- **Unified Stage**: Single preview area for both images and videos.
- **Workflow Switcher**: Toggle between "Visualize" (Image) and "Animate" (Video) modes.
- **Visualize Mode**:
  - "The Director": Focused prompt editing.
  - "Influences": Visual grid of reference assets with naming capabilities.
  - "History Strip": Horizontal scroll of previous generations with instant restore.
- **Animate Mode**:
  - "The Action": Motion prompt editing.
  - "Start Frame": Clear selection of the source image for video generation.
  - "Engine Controls": Refined LTX (1-5s slider) and Kling (5s/10s) controls.

### 2. Global Asset Library
- **Unified Picker**: New `AssetLibraryModal` for selecting or uploading assets.
- **Duplicate Detection**: Prevents uploading the same file twice by checking filename and size.
- **Smart Naming**: Dedicated flow to name assets (e.g., "Imran Khan") immediately after selection.

### 3. Intelligent Prompt Consistency (Global Asset Fallback)
- **Automatic Injection**: If a clip prompt mentions a character/product name (e.g., "Imran Khan") that exists in the project assets, the system automatically injects:
  - "CRITICAL: [Name] MUST match reference..." instructions.
  - The correct asset URL into the `reference_image_urls` list.
- **Project-Level Context**: Works even if the specific clip wasn't manually tagged with the asset, ensuring consistency across the entire story.

### 4. UX Polish
- **Instant Feedback**: Clicking a history item immediately updates the stage and prompt.
- **Refined Controls**: LTX slider now supports 1-5s in 1s intervals.
- **Visual Clarity**: Removed clutter, improved spacing, and added clear labels.

## 📁 Files Changed

### Components
- `src/components/ClipDetailDrawer.tsx` - **Complete Rewrite** for Omni Editor logic.
- `src/components/AssetLibraryModal.tsx` - **New Component** for unified asset management.
- `src/components/IdeaAnalysisScreen.tsx` - Integrated new Asset Library modal.
- `src/components/tabs/IdeaTab.tsx` - Implemented **Global Asset Fallback** logic for prompts.

### Libraries & Types
- `src/lib/userMedia.ts` - Updated `getUserImages` to support clip-specific filtering.
- `src/types/index.ts` - Updated `Clip` and `GenerationMetadata` interfaces.

## 🧪 Testing Checklist

- [ ] **Omni Editor UI**: Verify "Visualize" and "Animate" toggle works.
- [ ] **Asset Library**: Upload a new file, try to upload it again (check duplicate warning), and select an existing file.
- [ ] **History Strip**: Generate an image, see it appear in history, and click previous items to restore them.
- [ ] **Video Generation**: Test LTX slider (1-5s) and Kling buttons.
- [ ] **Consistency Fallback**:
  1. Create a project with a character named "Hero".
  2. In a clip *without* the asset manually attached, write a prompt "Hero stands in the rain."
  3. Verify the generated image uses the reference face of "Hero".
