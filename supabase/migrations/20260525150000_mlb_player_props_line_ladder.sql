-- Allow the full alternate-line ladder per (game, book, market, player) by
-- swapping the 4-col unique for a 5-col one that includes line. Ingest now
-- stores 0.5/1.5/2.5... so the UI can offer a line selector.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.mlb_player_props'::regclass AND contype = 'u'
    AND array_length(conkey, 1) = 4;
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.mlb_player_props DROP CONSTRAINT %I', c);
  END IF;
END $$;
ALTER TABLE public.mlb_player_props
  ADD CONSTRAINT mlb_player_props_uniq UNIQUE (game_pk, bookmaker, market, player_name, line);
