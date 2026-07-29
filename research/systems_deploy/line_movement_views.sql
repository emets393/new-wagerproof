-- ============================================================================
-- Line-movement access layer for the app (NFL + CFB), keyed by the SAME game_id
-- the game cards already use (nfl/cfb_dryrun_games.game_id).
--
-- The raw archive is captured hourly by the Odds-API jobs:
--   NFL -> nfl_historical_odds   (one row per game/book/market per snap_ts)
--   CFB -> ncaaf_odds_history    (one row per game/book per snapshot; FG markets)
-- Each run inserts a new snapshot, so movement = ordering rows by snap_ts.
--
-- These views collapse the per-book rows into a CONSENSUS (median) line per snapshot
-- for the point markets (spread/total/1H/team-total — median is clean in point space).
-- Moneyline is intentionally omitted from the consensus (median of American odds is
-- meaningless across the +/-100 boundary); read per-book ML from the raw tables.
--
-- Frontend usage:
--   * current line  = the row with MAX(snap_ts) for a game_id
--   * movement chart = all rows for a game_id ordered by snap_ts
-- ============================================================================

-- NFL history is keyed by city-style team names (Odds-API to_city) + season, NOT game_id,
-- so we attach game_id by mapping dryrun abbrs -> the same city names.
CREATE OR REPLACE VIEW public.nfl_line_movement AS
WITH tm(ab, loc) AS (VALUES
  ('ARI','Arizona'),('ATL','Atlanta'),('BAL','Baltimore'),('BUF','Buffalo'),
  ('CAR','Carolina'),('CHI','Chicago'),('CIN','Cincinnati'),('CLE','Cleveland'),
  ('DAL','Dallas'),('DEN','Denver'),('DET','Detroit'),('GB','Green Bay'),
  ('HOU','Houston'),('IND','Indianapolis'),('JAX','Jacksonville'),('KC','Kansas City'),
  ('LA','LA Rams'),('LAR','LA Rams'),('LAC','LA Chargers'),('LV','Las Vegas'),
  ('OAK','Las Vegas'),('MIA','Miami'),('MIN','Minnesota'),('NE','New England'),
  ('NO','New Orleans'),('NYG','NY Giants'),('NYJ','NY Jets'),('PHI','Philadelphia'),
  ('PIT','Pittsburgh'),('SEA','Seattle'),('SF','San Francisco'),('TB','Tampa Bay'),
  ('TEN','Tennessee'),('WAS','Washington'),('WSH','Washington')
),
d AS (
  SELECT g.game_id, g.season, th.loc AS home_loc, ta.loc AS away_loc
  FROM nfl_dryrun_games g
  JOIN tm th ON th.ab = g.home_ab
  JOIN tm ta ON ta.ab = g.away_ab
)
SELECT
  d.game_id, h.season, h.snap_ts, count(*) AS n_books,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY h.spread_home::numeric)     AS fg_spread_home,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY h.total_point::numeric)     AS fg_total,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY h.h1_spread_home::numeric)  AS h1_spread_home,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY h.h1_total_point::numeric)  AS h1_total,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY h.tt_home_point::numeric)   AS tt_home,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY h.tt_away_point::numeric)   AS tt_away
FROM nfl_historical_odds h
JOIN d ON d.season = h.season AND d.home_loc = h.home_team AND d.away_loc = h.away_team
GROUP BY d.game_id, h.season, h.snap_ts;

-- CFB history already carries the CFBD game_id (= cfb_dryrun_games.game_id). FG markets only;
-- 1H/TT lines land in ncaaf_event_odds separately.
CREATE OR REPLACE VIEW public.cfb_line_movement AS
SELECT
  game_id, season, snapshot AS snap_ts, count(*) AS n_books,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY spread_home::numeric) AS fg_spread_home,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY total::numeric)       AS fg_total
FROM ncaaf_odds_history
WHERE game_id IS NOT NULL
GROUP BY game_id, season, snapshot;
