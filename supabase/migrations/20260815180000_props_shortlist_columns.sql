-- Prop shortlist columns (get_top_props wiring, 2026-08-15): the weekly props generator
-- now PERSISTS its internal volume-model prediction + a deterministic rank so agents
-- select from a curated shortlist instead of scanning the matrix.
--   rank_tier: 'A-validated' (P14/P17/P18 fired at production thresholds)
--            | 'B-context' (top-decile scale-free model edge; NOT a validated bet)
--            | NULL (unranked / injury-excluded)
--   rank_pos: 1..N within the week (A block first).
ALTER TABLE nfl_slate_props
  ADD COLUMN IF NOT EXISTS model_pred numeric,
  ADD COLUMN IF NOT EXISTS model_edge numeric,
  ADD COLUMN IF NOT EXISTS rank_tier text,
  ADD COLUMN IF NOT EXISTS rank_pos integer;
DROP VIEW IF EXISTS nfl_dryrun_props;
CREATE VIEW nfl_dryrun_props AS SELECT * FROM nfl_slate_props;
GRANT SELECT ON nfl_dryrun_props TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
