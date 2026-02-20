-- Add optional transcript for reference audio (helps F5-TTS / Urdu-Hindi quality).
-- Non-destructive: only adds a nullable column.
ALTER TABLE voice_characters
ADD COLUMN IF NOT EXISTS ref_text text;
