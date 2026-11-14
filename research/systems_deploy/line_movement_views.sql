-- ============================================================================
-- Line-movement access layer for the app (NFL + CFB), keyed by the SAME game_id
-- the game cards already use (nfl/cfb_slate_games.game_id).
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
-- so we attach game_id by mapping slate abbrs -> the same city names.
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
  FROM nfl_slate_games g
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

-- CFB: ncaaf_odds_history is keyed by the ODDS-API event id (a hash), NOT the CFBD game_id the
-- game cards use. Remap event id -> CFBD game_id via kickoff + accent/apostrophe-insensitive
-- team-prefix match (Odds-API sends mascot names: "Illinois Fighting Illini"). FG markets only;
-- 1H/TT lines land in ncaaf_event_odds separately.
CREATE EXTENSION IF NOT EXISTS unaccent;
-- cfb_line_movement v2 (2026-09-18): NEUTRAL-SITE ORIENTATION. The Odds API can designate the
-- opposite home team from CFBD/ESPN (Kansas vs Arizona State at Wembley: Odds API home = ASU,
-- cfb_slate_games home = Kansas). The old map joined home->home AND away->away only, so the game
-- had no line series -> no fg_spread_close on the card -> health-sweep RED. Now: match either
-- orientation and, when swapped, flip every home-referenced field into the slate's orientation.
DROP VIEW IF EXISTS public.cfb_line_movement;
CREATE VIEW public.cfb_line_movement AS
WITH mv AS (
  SELECT h.game_id AS event_id, h.season, h.snapshot AS snap_ts, count(*) AS n_books,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (h.spread_home::double precision)) AS fg_spread_home,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (h.total::double precision))       AS fg_total,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (h.home_ml::double precision))     AS ml_home,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (h.away_ml::double precision))     AS ml_away
  FROM ncaaf_odds_history h
  WHERE h.game_id IS NOT NULL
  GROUP BY h.game_id, h.season, h.snapshot
), map AS (
  SELECT DISTINCT h.game_id AS event_id, g.game_id AS cfbd_id,
    (unaccent(lower(replace(h.home_team,'''',''))) NOT LIKE unaccent(lower(replace(g.home_team,'''',''))) || '%') AS flipped
  FROM ncaaf_odds_history h
  JOIN cfb_slate_games g
    ON h.commence_time = g.kickoff
   AND (
        (unaccent(lower(replace(h.home_team,'''',''))) LIKE unaccent(lower(replace(g.home_team,'''',''))) || '%'
     AND unaccent(lower(replace(h.away_team,'''',''))) LIKE unaccent(lower(replace(g.away_team,'''',''))) || '%')
     OR (unaccent(lower(replace(h.home_team,'''',''))) LIKE unaccent(lower(replace(g.away_team,'''',''))) || '%'
     AND unaccent(lower(replace(h.away_team,'''',''))) LIKE unaccent(lower(replace(g.home_team,'''',''))) || '%')
   )
), ev AS (
  SELECT e.game_id::bigint AS game_id, e.season, e.snap_ts, count(DISTINCT e.book) AS n_books,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (e.price::double precision)) FILTER (WHERE e.market = 'h2h_h1'    AND lower(e.name) LIKE lower(e.home) || '%')     AS h1_ml_h,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (e.price::double precision)) FILTER (WHERE e.market = 'h2h_h1'    AND lower(e.name) NOT LIKE lower(e.home) || '%') AS h1_ml_a,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (e.point::double precision)) FILTER (WHERE e.market = 'spreads_h1' AND lower(e.name) LIKE lower(e.home) || '%')     AS h1_sp_h,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (e.point::double precision)) FILTER (WHERE e.market = 'totals_h1'  AND lower(e.name) = 'over')                       AS h1_total,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (e.point::double precision)) FILTER (WHERE e.market = 'team_totals' AND lower(e.name) = 'over' AND unaccent(lower(replace(e.description,'''',''))) LIKE unaccent(lower(replace(e.home,'''',''))) || '%') AS tt_h,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (e.point::double precision)) FILTER (WHERE e.market = 'team_totals' AND lower(e.name) = 'over' AND unaccent(lower(replace(e.description,'''',''))) LIKE unaccent(lower(replace(e.away,'''',''))) || '%') AS tt_a,
    bool_or(unaccent(lower(replace(e.home,'''',''))) NOT LIKE unaccent(lower(replace(g.home_team,'''',''))) || '%') AS flipped
  FROM ncaaf_event_odds e
  LEFT JOIN cfb_slate_games g ON g.game_id = e.game_id::bigint
  GROUP BY e.game_id, e.season, e.snap_ts
)
SELECT map.cfbd_id AS game_id, mv.season, mv.snap_ts, mv.n_books,
  CASE WHEN map.flipped THEN -mv.fg_spread_home ELSE mv.fg_spread_home END AS fg_spread_home,
  mv.fg_total,
  CASE WHEN map.flipped THEN mv.ml_away ELSE mv.ml_home END AS ml_home,
  CASE WHEN map.flipped THEN mv.ml_home ELSE mv.ml_away END AS ml_away,
  NULL::double precision AS h1_ml_home, NULL::double precision AS h1_ml_away,
  NULL::double precision AS h1_spread_home, NULL::double precision AS h1_total,
  NULL::double precision AS tt_home, NULL::double precision AS tt_away
FROM mv JOIN map ON map.event_id = mv.event_id
UNION ALL
SELECT ev.game_id, ev.season, ev.snap_ts, ev.n_books,
  NULL, NULL, NULL, NULL,
  CASE WHEN ev.flipped THEN ev.h1_ml_a ELSE ev.h1_ml_h END,
  CASE WHEN ev.flipped THEN ev.h1_ml_h ELSE ev.h1_ml_a END,
  CASE WHEN ev.flipped THEN -ev.h1_sp_h ELSE ev.h1_sp_h END,
  ev.h1_total,
  CASE WHEN ev.flipped THEN ev.tt_a ELSE ev.tt_h END,
  CASE WHEN ev.flipped THEN ev.tt_h ELSE ev.tt_a END
FROM ev;

