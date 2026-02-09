# Asset Vision DNA & Detected-Asset Naming

Branch: `feature/asset-vision-dna`

## 1. Skip naming for detected assets

- **Problem:** When the user uploads or picks an image for an already detected asset, the app still shows "Name this Reference". The name is already known from detection.
- **Fix:** Pass `presetName` from IdeaAnalysisScreen into AssetLibraryModal when opening for a detected asset. When `presetName` is set, on asset select call `onSelect(url, presetName)` and close immediately—do not show the naming modal.

## 2. Naming → reference plug-in (confirmed, no change)

- Asset **name** is used so that when the user (or story) writes that name in a prompt, we auto-plug the reference image and consistency instructions. Logic already correct.

## 3. Vision DNA (character / product / object, not location)

- **Idea:** When an asset has an image, derive a short visual "DNA" from that image and inject `"Name, DNA"` whenever that asset is referenced (e.g. "Imran Khan, a clean shaved with medium length black hair, wearing black coat and white shalwar kamiz").
- **When:** Run vision **once** when the user presses "Continue to Storyboard" (Initialize Story), not on every upload. Saves cost and avoids abuse.
- **Scope:** Character, product, object only. No vision for locations.
- **Implementation:**
  - New API: e.g. `POST /api/extract-asset-dna` — input: `imageUrl`, `assetType` (character | product | object). Uses Gemini vision; returns one short DNA sentence.
  - At "Continue to Storyboard": for each character/product/object with `resultImageUrl`, call the API once, get DNA, attach to asset context (e.g. `visualDna` or `appearanceDetails`).
  - Where prompts are built (generate-clip-prompts, IdeaTab): use `${name}, ${visualDna}` when referencing the asset.

## Status

- [x] Plan doc
- [x] Skip naming (presetName in AssetLibraryModal + IdeaAnalysisScreen)
- [x] API extract-asset-dna (POST /api/extract-asset-dna; requires GEMINI_API_KEY)
- [x] Run vision once at Continue to Storyboard; store DNA in context
- [x] Inject "Name, DNA" in generate-clip-prompts and IdeaTab
