-- Migration: Add asset_context column to projects table
-- This stores the detected asset context (characters, products, locations, and settings)
-- so that confirmed assets persist with the project and can be reused on revisit.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS asset_context JSONB;

-- Optional: you can index this if you plan to query by asset properties later.
-- For now we keep it simple since it's mostly loaded as part of the project JSON.


