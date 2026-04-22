-- =====================================================================
-- Backfill total pick_selection to use the Vegas line from the payload
-- instead of the model's ou_fair_total.
--
-- Bug: agent V2 worker was producing picks like "Over 11.43" where 11.43
-- is the model's ou_fair_total. The pick string should use the market
-- line (archived_game_data.vegas_lines.total). The code fix in commit
-- b1c10e7 prevents future occurrences; this backfill corrects rows
-- that were already saved with the bad line.
--
-- How to run (Supabase dashboard → SQL editor):
--   1. Run Step 1 (SELECT). Review the list — every row should show a
--      sane new_selection like "Over 8.5" / "Under 9.5".
--   2. If the preview looks right, run Step 2 (UPDATE).
--   3. Spot-check a few rows in the mobile app / web.
-- =====================================================================

-- ── Step 1: Dry run. Shows every row that would change. ────────────────
SELECT
  id,
  sport,
  game_id,
  matchup,
  game_date,
  pick_selection AS current_selection,
  CASE
    WHEN pick_selection ILIKE 'over%'  THEN 'Over '  || (archived_game_data->'vegas_lines'->>'total')
    WHEN pick_selection ILIKE 'under%' THEN 'Under ' || (archived_game_data->'vegas_lines'->>'total')
    ELSE pick_selection
  END AS new_selection,
  created_at
FROM avatar_picks
WHERE bet_type = 'total'
  AND archived_game_data->'vegas_lines'->>'total' IS NOT NULL
  AND pick_selection IS DISTINCT FROM CASE
    WHEN pick_selection ILIKE 'over%'  THEN 'Over '  || (archived_game_data->'vegas_lines'->>'total')
    WHEN pick_selection ILIKE 'under%' THEN 'Under ' || (archived_game_data->'vegas_lines'->>'total')
    ELSE pick_selection
  END
ORDER BY created_at DESC;


-- ── Step 2: Apply the backfill. Run only after reviewing Step 1. ──────
-- Returns the count + rewritten rows so you can save a log of what changed.
UPDATE avatar_picks
SET pick_selection = CASE
  WHEN pick_selection ~* '^\s*over\b'  THEN 'Over '  || (archived_game_data->'vegas_lines'->>'total')
  WHEN pick_selection ~* '^\s*under\b' THEN 'Under ' || (archived_game_data->'vegas_lines'->>'total')
  ELSE pick_selection
END
WHERE bet_type = 'total'
  AND archived_game_data->'vegas_lines'->>'total' IS NOT NULL
  AND pick_selection IS DISTINCT FROM CASE
    WHEN pick_selection ILIKE 'over%'  THEN 'Over '  || (archived_game_data->'vegas_lines'->>'total')
    WHEN pick_selection ILIKE 'under%' THEN 'Under ' || (archived_game_data->'vegas_lines'->>'total')
    ELSE pick_selection
  END
RETURNING id, sport, matchup, pick_selection, created_at;
