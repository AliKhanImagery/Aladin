-- Transcribe (Voice Lab): cost in credits per request (Fal Whisper).
insert into public.credit_pricing (key, cost, active) values
  ('audio.whisper.transcribe', 3, true)
on conflict (key) do update set
  cost = excluded.cost,
  active = excluded.active,
  updated_at = now();
