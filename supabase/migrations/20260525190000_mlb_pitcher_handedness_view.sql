-- Tiny lookup view for pitcher handedness. mlb_pitcher_logs has ~70k rows
-- (one per start), but only ~1.2k DISTINCT (pitcher_id, pitch_hand) pairs.
-- The hourly runner's fetch_handedness_lookup() was paginating the whole
-- table to PostgREST and timing out after 30s on deep offsets — this view
-- gives it a single-shot read.
CREATE OR REPLACE VIEW public.v_mlb_pitcher_handedness AS
  SELECT DISTINCT pitcher_id, pitch_hand
  FROM public.mlb_pitcher_logs
  WHERE pitch_hand IS NOT NULL AND pitcher_id IS NOT NULL;

GRANT SELECT ON public.v_mlb_pitcher_handedness TO anon, authenticated, service_role;
