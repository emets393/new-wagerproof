-- Schema and column names for the two "today's games + predictions + accuracy" views.
-- Run against the CFB Supabase project (same DB where the views were created).

SELECT
  table_name AS view_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'nba_todays_games_predictions_with_accuracy',
    'ncaab_todays_games_predictions_with_accuracy'
  )
ORDER BY table_name, ordinal_position;
