-- NBA + NCAAB signal definitions (owner 2026-08-15: every non-MLB sport needs
-- user-friendly defs). Tables mirror cfb_signal_defs; seeded with the signals the
-- basketball pipelines can actually fire. New basketball signals follow the same
-- contract: emit + register the def in the same change.
CREATE TABLE IF NOT EXISTS nba_signal_defs (
  signal_key text PRIMARY KEY, display_name text, market text, one_liner text,
  definition text, why_it_works text, bet_direction text, typical_hit text,
  default_conviction text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS ncaab_signal_defs (LIKE nba_signal_defs INCLUDING ALL);
ALTER TABLE nba_signal_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncaab_signal_defs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY nba_defs_read ON nba_signal_defs FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY ncaab_defs_read ON ncaab_signal_defs FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO nba_signal_defs (signal_key, display_name, market, one_liner, definition, why_it_works, bet_direction, typical_hit, default_conviction) VALUES
('nba_dead_home_favorite', 'Nothing-to-Play-For Home Favorite', 'spread',
 'Late season, the home team is eliminated but still favored — back the favorite anyway.',
 'In the final stretch of the season, a home team that has been eliminated from playoff contention is still favored against a team fighting for something. Betting lines punish these "checked-out" favorites hard — usually too hard. We back the eliminated home favorite at the discounted number.',
 'The market over-corrects for effort: everyone assumes an eliminated team stops trying, so the line gets moved several points against them. At home, with pride and jobs on the line, they beat that overly pessimistic number far more often than the market expects — 62% in our multi-season testing, one of the few late-season situations with a real edge.',
 'Back the eliminated home favorite against the spread.', '~62% / +19% ROI (multi-season)', 'med')
ON CONFLICT (signal_key) DO UPDATE SET display_name = EXCLUDED.display_name,
  one_liner = EXCLUDED.one_liner, definition = EXCLUDED.definition,
  why_it_works = EXCLUDED.why_it_works, bet_direction = EXCLUDED.bet_direction,
  typical_hit = EXCLUDED.typical_hit, default_conviction = EXCLUDED.default_conviction;
NOTIFY pgrst, 'reload schema';
