-- Fix missing credit pricing rows for Vidu and Reeve
insert into public.credit_pricing (key, cost, active) values
  ('video.vidu.5s', 60, true),
  ('video.vidu.10s', 110, true),
  ('image.reeve.text_to_image', 10, true),
  ('image.reeve.remix', 15, true)
on conflict (key) do update 
set cost = excluded.cost, active = excluded.active;

-- Ensure Nano Banana pricing aligns if needed (Leaving existing values for now unless instructed to change DB)
-- User mentioned "Nano Banana (25c)" in prompt, but DB has 12/18. 
-- If we want to update Nano Banana to 25:
-- update public.credit_pricing set cost = 25 where key = 'image.nano_banana.text_to_image';
-- For now, I only insert missing rows to avoid breaking existing logic without confirmation.
