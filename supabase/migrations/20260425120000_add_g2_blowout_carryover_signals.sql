-- =====================================================================
-- G2 Blowout Carryover signals
-- =====================================================================
-- Adds 4 new "series" category signals to mlb_game_signals based on the
-- historical analysis of Game 2 outcomes after a Game 1 blowout:
--
--   * Sweet spot: moderate-fav (-110 to -149) blowout winner
--       → 67% G2 win rate, +27% ROI on the moneyline (n=69)
--   * Generic blowout carryover: any 8+ blowout outside sweet spot
--       → 58% G2 win rate, +5.77% ROI baseline (n=226 total)
--   * Pick-em blowout TRAP: 8+ blowout where G1 was a coin flip (-109 to +109)
--       → 38% G2 win rate (regression spot, FADE)
--   * Bounce-back myth: team that LOST G1 by 8+
--       → 41.6% G2 win rate ("revenge spot" is a myth)
--
-- Data source: 3 seasons of mlb_game_log (2023-2025).
--
-- See:
--   - chat session "MLB blowout-carryover analysis" (2026-04-25)
--   - mlb_signal_definitions row inserts below for human-readable
--     descriptions (used by signal-legend UIs).
-- =====================================================================

-- 1. Insert / update signal definitions
INSERT INTO public.mlb_signal_definitions
  (signal_key, category, severity, label, description, metric, threshold_value, threshold_dir, min_games, is_active, notes)
VALUES
  ('g2_blowout_sweet_spot', 'series', 'positive',
   'G2 Sweet-Spot Carryover',
   'Won Game 1 by 8+ as a moderate favorite (-110 to -149). Historical 67% G2 win rate, +27% ROI on the moneyline — the sharpest blowout-carryover edge we found.',
   'g1_margin + g1_ml', 8, 'gt', 0, true,
   'Filters: prev_margin >= 8 AND prev_ml BETWEEN -149 AND -110'),
  ('g2_blowout_winner', 'series', 'positive',
   'G2 Blowout Carryover',
   'Won Game 1 by 8+ runs (outside the sweet-spot price band). Historical 58% G2 win rate, +5.8% ROI on the moneyline.',
   'g1_margin', 8, 'gt', 0, true,
   'Triggers when team won G1 by 8+ but ML was outside -110 to -149'),
  ('g2_blowout_pick_em_trap', 'series', 'negative',
   'G2 Pick-em Blowout Trap',
   'Blew out a near-even-priced opponent (-109 to +109) in Game 1. Historical TRAP — only 38% G2 win rate. Heavy regression risk; do NOT chase the momentum.',
   'g1_margin + g1_ml', 8, 'gt', 0, true,
   'Filters: prev_margin >= 8 AND prev_ml BETWEEN -109 AND 109'),
  ('g2_blowout_loser', 'series', 'negative',
   'G2 Bounce-Back Myth',
   'Got blown out by 8+ runs in Game 1. The "revenge spot" narrative is a myth — historical 41.6% G2 win rate. Market overrates this team in G2.',
   'g1_margin', -8, 'lt', 0, true,
   'Filters: prev_margin <= -8')
ON CONFLICT (signal_key) DO UPDATE SET
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  metric = EXCLUDED.metric,
  threshold_value = EXCLUDED.threshold_value,
  threshold_dir = EXCLUDED.threshold_dir,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Replace mlb_game_signals view (preserves all existing CASE branches +
--    appends the 4 new G2 carryover branches into both home_signals and
--    away_signals arrays). G1 lookup uses game_pk + home_away to avoid
--    abbreviation drift between mlb_schedule and mlb_game_log
--    (e.g., ARI vs AZ, OAK vs ATH).

CREATE OR REPLACE VIEW public.mlb_game_signals AS
WITH today_games AS (
  SELECT * FROM public.mlb_schedule
  WHERE official_date = CURRENT_DATE
    AND is_active = true
    AND COALESCE(is_postponed, false) = false
    AND COALESCE(is_completed, false) = false
),
home_sp AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_starter_pregame
  WHERE official_date = CURRENT_DATE AND home_away = 'home'
  ORDER BY game_pk, computed_at DESC
),
away_sp AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_starter_pregame
  WHERE official_date = CURRENT_DATE AND home_away = 'away'
  ORDER BY game_pk, computed_at DESC
),
home_bp AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_bullpen_pregame
  WHERE official_date = CURRENT_DATE AND home_away = 'home'
  ORDER BY game_pk, computed_at DESC
),
away_bp AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_bullpen_pregame
  WHERE official_date = CURRENT_DATE AND home_away = 'away'
  ORDER BY game_pk, computed_at DESC
),
home_bat AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_batting_pregame
  WHERE official_date = CURRENT_DATE AND home_away = 'home'
  ORDER BY game_pk, computed_at DESC
),
away_bat AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_batting_pregame
  WHERE official_date = CURRENT_DATE AND home_away = 'away'
  ORDER BY game_pk, computed_at DESC
),
home_sched AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_schedule_features
  WHERE official_date = CURRENT_DATE AND home_away = 'home'
  ORDER BY game_pk, computed_at DESC
),
away_sched AS (
  SELECT DISTINCT ON (game_pk) *
  FROM public.mlb_schedule_features
  WHERE official_date = CURRENT_DATE AND home_away = 'away'
  ORDER BY game_pk, computed_at DESC
),
pf AS (
  SELECT venue_name, pf_runs, pf_hr, is_dome
  FROM public.mlb_park_factors
  WHERE season_range = '2023-2025'
),
-- ────────────────────────────────────────────────────────────────────
-- G1 LOOKUPS (new for blowout-carryover signals)
-- For each today's game, find the most recent prior game in the past 6
-- days between the same two teams at the same venue. Pull the home/away
-- team's row from mlb_game_log (margin, closing_ml, runs).
-- Joining via game_pk + home_away avoids team_abbr inconsistencies.
-- ────────────────────────────────────────────────────────────────────
g1_for_home AS (
  SELECT today.game_pk AS today_game_pk,
         g1h.margin    AS g1_margin,
         g1h.closing_ml AS g1_ml,
         g1h.runs_scored AS g1_runs_scored,
         g1h.runs_allowed AS g1_runs_allowed
  FROM today_games today
  LEFT JOIN LATERAL (
    SELECT gl.margin, gl.closing_ml, gl.runs_scored, gl.runs_allowed
    FROM public.mlb_game_log gl
    JOIN public.mlb_schedule s ON s.game_pk = gl.game_pk
    WHERE gl.home_away = 'home'
      AND s.venue_name = today.venue_name
      AND s.home_team_id = today.home_team_id
      AND s.away_team_id = today.away_team_id
      AND gl.official_date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE - 1
      AND gl.runs_scored IS NOT NULL
    ORDER BY gl.official_date DESC, gl.game_pk DESC
    LIMIT 1
  ) g1h ON true
),
g1_for_away AS (
  SELECT today.game_pk AS today_game_pk,
         g1a.margin    AS g1_margin,
         g1a.closing_ml AS g1_ml,
         g1a.runs_scored AS g1_runs_scored,
         g1a.runs_allowed AS g1_runs_allowed
  FROM today_games today
  LEFT JOIN LATERAL (
    SELECT gl.margin, gl.closing_ml, gl.runs_scored, gl.runs_allowed
    FROM public.mlb_game_log gl
    JOIN public.mlb_schedule s ON s.game_pk = gl.game_pk
    WHERE gl.home_away = 'away'
      AND s.venue_name = today.venue_name
      AND s.home_team_id = today.home_team_id
      AND s.away_team_id = today.away_team_id
      AND gl.official_date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE - 1
      AND gl.runs_scored IS NOT NULL
    ORDER BY gl.official_date DESC, gl.game_pk DESC
    LIMIT 1
  ) g1a ON true
)
SELECT g.game_pk,
  g.official_date,
  g.home_team_name,
  g.away_team_name,
  g.home_sp_name,
  g.away_sp_name,
  g.venue_name,
  g.temperature_f,
  g.wind_speed_mph,
  g.wind_direction,
  g.sky,
  -- HOME SIGNALS — preserves all existing branches + 4 new G2 carryover branches
  array_remove(ARRAY[
    CASE WHEN hsp.prior_starts >= 4 AND (hsp.season_pre_xfip - hsp.season_pre_era) > 0.75
         THEN json_build_object('category','pitcher','severity','negative','message',
              hsp.pitcher_name||' ERA ('||round(hsp.season_pre_era::numeric,2)||') is significantly lower than xFIP ('||round(hsp.season_pre_xfip::numeric,2)||') — may be luck-driven, expect regression')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND (hsp.season_pre_era - hsp.season_pre_xfip) > 0.75
         THEN json_build_object('category','pitcher','severity','positive','message',
              hsp.pitcher_name||' ERA ('||round(hsp.season_pre_era::numeric,2)||') is inflated vs xFIP ('||round(hsp.season_pre_xfip::numeric,2)||') — pitching better than ERA shows')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND hsp.last3_minus_season_xfip > 0.50
         THEN json_build_object('category','pitcher','severity','negative','message',
              hsp.pitcher_name||' xFIP has risen '||round(hsp.last3_minus_season_xfip::numeric,2)||' over last 3 starts — trending in wrong direction')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND hsp.last3_minus_season_xfip < -0.50
         THEN json_build_object('category','pitcher','severity','positive','message',
              hsp.pitcher_name||' xFIP has dropped '||round(abs(hsp.last3_minus_season_xfip)::numeric,2)||' over last 3 starts — coming in on a strong run')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND hsp.season_pre_xera IS NOT NULL AND hsp.season_pre_era IS NOT NULL AND (hsp.season_pre_xera - hsp.season_pre_era) > 0.75
         THEN json_build_object('category','pitcher','severity','negative','message',
              hsp.pitcher_name||' ERA ('||round(hsp.season_pre_era::numeric,2)||') is well below xERA ('||round(hsp.season_pre_xera::numeric,2)||') — ERA may be luck-driven, contact quality suggests regression')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND hsp.season_pre_xera IS NOT NULL AND hsp.season_pre_era IS NOT NULL AND (hsp.season_pre_era - hsp.season_pre_xera) > 0.75
         THEN json_build_object('category','pitcher','severity','positive','message',
              hsp.pitcher_name||' ERA ('||round(hsp.season_pre_era::numeric,2)||') is inflated vs xERA ('||round(hsp.season_pre_xera::numeric,2)||') — contact quality shows pitcher is better than ERA suggests')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND hsp.season_pre_xwoba_allowed IS NOT NULL AND hsp.season_pre_xwoba_allowed > 0.360
         THEN json_build_object('category','pitcher','severity','negative','message',
              hsp.pitcher_name||' is allowing high-quality contact (xwOBA '||round(hsp.season_pre_xwoba_allowed::numeric,3)||') — batters squaring him up this season')::text END,
    CASE WHEN hsp.prior_starts >= 4 AND hsp.season_pre_xwoba_allowed IS NOT NULL AND hsp.season_pre_xwoba_allowed < 0.270
         THEN json_build_object('category','pitcher','severity','positive','message',
              hsp.pitcher_name||' is suppressing contact quality (xwOBA '||round(hsp.season_pre_xwoba_allowed::numeric,3)||') — elite contact suppression this season')::text END,
    CASE WHEN hsc.team_season_game_number >= 5 AND hbp.bp_ip_last3d >= 15
         THEN json_build_object('category','bullpen','severity','negative','message',
              g.home_team_name||' bullpen has thrown '||round(hbp.bp_ip_last3d::numeric,1)||' IP in last 3 days — heavy workload, fatigue risk')::text END,
    CASE WHEN hsc.team_season_game_number >= 6 AND hbp.trend_bp_xfip > 0.30
         THEN json_build_object('category','bullpen','severity','negative','message',
              g.home_team_name||' bullpen xFIP has risen +'||round(hbp.trend_bp_xfip::numeric,2)||' over last 5 games — relief corps trending in wrong direction')::text END,
    CASE WHEN hsc.team_season_game_number >= 6 AND hbp.bp_ip_last3d >= 13 AND hbp.trend_bp_xwoba_allowed > 0.020
         THEN json_build_object('category','bullpen','severity','negative','message',
              g.home_team_name||' bullpen is tired AND allowing harder contact recently — elevated regression risk')::text END,
    CASE WHEN hsc.team_season_game_number >= 6 AND hbp.trend_bp_xfip < -0.30 AND COALESCE(hbp.bp_ip_last3d,0) <= 4
         THEN json_build_object('category','bullpen','severity','positive','message',
              g.home_team_name||' bullpen xFIP has dropped '||round(abs(hbp.trend_bp_xfip)::numeric,2)||' over last 5 games and is well-rested')::text END,
    CASE WHEN hsc.team_season_game_number >= 6 AND hbat.trend_woba < -0.020 AND hbat.trend_hard_hit_pct < -0.03
         THEN json_build_object('category','batting','severity','negative','message',
              g.home_team_name||' offense is cooling off — wOBA down '||round(abs(hbat.trend_woba)::numeric,3)||' and hard contact rate declining over last 5 games')::text END,
    CASE WHEN hsc.team_season_game_number >= 6 AND hbat.trend_barrel_pct < -0.015 AND hbat.trend_hard_hit_pct < -0.04
         THEN json_build_object('category','batting','severity','negative','message',
              g.home_team_name||' power metrics declining — barrel rate and hard-hit rate both down over last 5 games')::text END,
    CASE WHEN hsc.team_season_game_number >= 6 AND hbat.trend_woba > 0.025 AND hbat.trend_hard_hit_pct > 0.03
         THEN json_build_object('category','batting','severity','positive','message',
              g.home_team_name||' offense is heating up — wOBA up '||round(hbat.trend_woba::numeric,3)||' and hard contact rising over last 5 games')::text END,
    CASE WHEN hsc.team_season_game_number >= 5 AND hsc.team_pregame_win_loss_streak <= -4
         THEN json_build_object('category','schedule','severity','negative','message',
              g.home_team_name||' have lost '||abs(hsc.team_pregame_win_loss_streak::integer)||' straight — significant cold streak')::text END,
    CASE WHEN hsc.team_season_game_number >= 5 AND hsc.team_pregame_win_loss_streak >= 4
         THEN json_build_object('category','schedule','severity','positive','message',
              g.home_team_name||' have won '||hsc.team_pregame_win_loss_streak::integer||' straight — riding a hot streak')::text END,
    CASE WHEN hsc.team_season_game_number >= 5 AND hsc.team_days_rest >= 3
         THEN json_build_object('category','schedule','severity','positive','message',
              g.home_team_name||' coming in with '||hsc.team_days_rest::integer||' days rest — well-rested advantage')::text END,
    -- ▼▼▼ NEW G2 CARRYOVER SIGNALS ▼▼▼
    CASE WHEN g1h.g1_margin >= 8 AND g1h.g1_ml BETWEEN -149 AND -110
         THEN json_build_object('category','series','severity','positive','message',
              '★ '||g.home_team_name||' won G1 '||g1h.g1_runs_scored||'-'||g1h.g1_runs_allowed||' as a moderate favorite — historical sweet spot (67% G2 win rate, +27% ROI). Lean '||g.home_team_name||' ML.')::text END,
    CASE WHEN g1h.g1_margin >= 8 AND (g1h.g1_ml NOT BETWEEN -149 AND -110) AND (g1h.g1_ml NOT BETWEEN -109 AND 109)
         THEN json_build_object('category','series','severity','positive','message',
              g.home_team_name||' won G1 '||g1h.g1_runs_scored||'-'||g1h.g1_runs_allowed||' — blowout carryover (58% G2 win rate, +5.8% ROI). Lean '||g.home_team_name||' side.')::text END,
    CASE WHEN g1h.g1_margin >= 8 AND g1h.g1_ml BETWEEN -109 AND 109
         THEN json_build_object('category','series','severity','negative','message',
              '⚠️ '||g.home_team_name||' blew out a pick em opponent in G1 ('||g1h.g1_runs_scored||'-'||g1h.g1_runs_allowed||') — historical TRAP (only 38% G2 win rate). FADE the momentum, regression spot.')::text END,
    CASE WHEN g1h.g1_margin <= -8
         THEN json_build_object('category','series','severity','negative','message',
              '⚠️ '||g.home_team_name||' got blown out '||g1h.g1_runs_scored||'-'||g1h.g1_runs_allowed||' in G1 — bounce-back myth (only 41.6% G2 win rate). Don''t chase the revenge narrative.')::text END
  ], NULL::text) AS home_signals,
  -- AWAY SIGNALS — preserves all existing branches + 4 new G2 carryover branches
  array_remove(ARRAY[
    CASE WHEN asp.prior_starts >= 4 AND (asp.season_pre_xfip - asp.season_pre_era) > 0.75
         THEN json_build_object('category','pitcher','severity','negative','message',
              asp.pitcher_name||' ERA ('||round(asp.season_pre_era::numeric,2)||') is significantly lower than xFIP ('||round(asp.season_pre_xfip::numeric,2)||') — may be luck-driven, expect regression')::text END,
    CASE WHEN asp.prior_starts >= 4 AND (asp.season_pre_era - asp.season_pre_xfip) > 0.75
         THEN json_build_object('category','pitcher','severity','positive','message',
              asp.pitcher_name||' ERA ('||round(asp.season_pre_era::numeric,2)||') is inflated vs xFIP ('||round(asp.season_pre_xfip::numeric,2)||') — pitching better than ERA shows')::text END,
    CASE WHEN asp.prior_starts >= 4 AND asp.last3_minus_season_xfip > 0.50
         THEN json_build_object('category','pitcher','severity','negative','message',
              asp.pitcher_name||' xFIP has risen '||round(asp.last3_minus_season_xfip::numeric,2)||' over last 3 starts — trending in wrong direction')::text END,
    CASE WHEN asp.prior_starts >= 4 AND asp.last3_minus_season_xfip < -0.50
         THEN json_build_object('category','pitcher','severity','positive','message',
              asp.pitcher_name||' xFIP has dropped '||round(abs(asp.last3_minus_season_xfip)::numeric,2)||' over last 3 starts — coming in on a strong run')::text END,
    CASE WHEN asp.prior_starts >= 4 AND asp.season_pre_xera IS NOT NULL AND asp.season_pre_era IS NOT NULL AND (asp.season_pre_xera - asp.season_pre_era) > 0.75
         THEN json_build_object('category','pitcher','severity','negative','message',
              asp.pitcher_name||' ERA ('||round(asp.season_pre_era::numeric,2)||') is well below xERA ('||round(asp.season_pre_xera::numeric,2)||') — ERA may be luck-driven, contact quality suggests regression')::text END,
    CASE WHEN asp.prior_starts >= 4 AND asp.season_pre_xera IS NOT NULL AND asp.season_pre_era IS NOT NULL AND (asp.season_pre_era - asp.season_pre_xera) > 0.75
         THEN json_build_object('category','pitcher','severity','positive','message',
              asp.pitcher_name||' ERA ('||round(asp.season_pre_era::numeric,2)||') is inflated vs xERA ('||round(asp.season_pre_xera::numeric,2)||') — contact quality shows pitcher is better than ERA suggests')::text END,
    CASE WHEN asp.prior_starts >= 4 AND asp.season_pre_xwoba_allowed IS NOT NULL AND asp.season_pre_xwoba_allowed > 0.360
         THEN json_build_object('category','pitcher','severity','negative','message',
              asp.pitcher_name||' is allowing high-quality contact (xwOBA '||round(asp.season_pre_xwoba_allowed::numeric,3)||') — batters squaring him up this season')::text END,
    CASE WHEN asp.prior_starts >= 4 AND asp.season_pre_xwoba_allowed IS NOT NULL AND asp.season_pre_xwoba_allowed < 0.270
         THEN json_build_object('category','pitcher','severity','positive','message',
              asp.pitcher_name||' is suppressing contact quality (xwOBA '||round(asp.season_pre_xwoba_allowed::numeric,3)||') — elite contact suppression this season')::text END,
    CASE WHEN asc_.team_season_game_number >= 5 AND abp.bp_ip_last3d >= 15
         THEN json_build_object('category','bullpen','severity','negative','message',
              g.away_team_name||' bullpen has thrown '||round(abp.bp_ip_last3d::numeric,1)||' IP in last 3 days — heavy workload, fatigue risk')::text END,
    CASE WHEN asc_.team_season_game_number >= 6 AND abp.trend_bp_xfip > 0.30
         THEN json_build_object('category','bullpen','severity','negative','message',
              g.away_team_name||' bullpen xFIP has risen +'||round(abp.trend_bp_xfip::numeric,2)||' over last 5 games — relief corps trending in wrong direction')::text END,
    CASE WHEN asc_.team_season_game_number >= 6 AND abp.bp_ip_last3d >= 13 AND abp.trend_bp_xwoba_allowed > 0.020
         THEN json_build_object('category','bullpen','severity','negative','message',
              g.away_team_name||' bullpen is tired AND allowing harder contact recently — elevated regression risk')::text END,
    CASE WHEN asc_.team_season_game_number >= 6 AND abp.trend_bp_xfip < -0.30 AND COALESCE(abp.bp_ip_last3d,0) <= 4
         THEN json_build_object('category','bullpen','severity','positive','message',
              g.away_team_name||' bullpen xFIP has dropped '||round(abs(abp.trend_bp_xfip)::numeric,2)||' over last 5 games and is well-rested')::text END,
    CASE WHEN asc_.team_season_game_number >= 6 AND abat.trend_woba < -0.020 AND abat.trend_hard_hit_pct < -0.03
         THEN json_build_object('category','batting','severity','negative','message',
              g.away_team_name||' offense is cooling off — wOBA down '||round(abs(abat.trend_woba)::numeric,3)||' and hard contact declining over last 5 games')::text END,
    CASE WHEN asc_.team_season_game_number >= 6 AND abat.trend_barrel_pct < -0.015 AND abat.trend_hard_hit_pct < -0.04
         THEN json_build_object('category','batting','severity','negative','message',
              g.away_team_name||' power metrics declining — barrel rate and hard-hit rate both down over last 5 games')::text END,
    CASE WHEN asc_.team_season_game_number >= 6 AND abat.trend_woba > 0.025 AND abat.trend_hard_hit_pct > 0.03
         THEN json_build_object('category','batting','severity','positive','message',
              g.away_team_name||' offense is heating up — wOBA up '||round(abat.trend_woba::numeric,3)||' and hard contact rising over last 5 games')::text END,
    CASE WHEN asc_.team_season_game_number >= 5 AND asc_.team_pregame_win_loss_streak <= -4
         THEN json_build_object('category','schedule','severity','negative','message',
              g.away_team_name||' have lost '||abs(asc_.team_pregame_win_loss_streak::integer)||' straight — significant cold streak')::text END,
    CASE WHEN asc_.team_season_game_number >= 5 AND asc_.team_pregame_win_loss_streak >= 4
         THEN json_build_object('category','schedule','severity','positive','message',
              g.away_team_name||' have won '||asc_.team_pregame_win_loss_streak::integer||' straight — riding a hot streak')::text END,
    CASE WHEN asc_.team_season_game_number >= 5 AND asc_.team_consecutive_home_away_games <= -6
         THEN json_build_object('category','schedule','severity','negative','message',
              g.away_team_name||' are on game '||abs(asc_.team_consecutive_home_away_games::integer)||' of a road trip — extended travel fatigue')::text END,
    CASE WHEN asc_.team_season_game_number >= 5 AND asc_.team_days_rest >= 3
         THEN json_build_object('category','schedule','severity','positive','message',
              g.away_team_name||' coming in with '||asc_.team_days_rest::integer||' days rest — well-rested advantage')::text END,
    -- ▼▼▼ NEW G2 CARRYOVER SIGNALS ▼▼▼
    CASE WHEN g1a.g1_margin >= 8 AND g1a.g1_ml BETWEEN -149 AND -110
         THEN json_build_object('category','series','severity','positive','message',
              '★ '||g.away_team_name||' won G1 '||g1a.g1_runs_scored||'-'||g1a.g1_runs_allowed||' as a moderate favorite — historical sweet spot (67% G2 win rate, +27% ROI). Lean '||g.away_team_name||' ML.')::text END,
    CASE WHEN g1a.g1_margin >= 8 AND (g1a.g1_ml NOT BETWEEN -149 AND -110) AND (g1a.g1_ml NOT BETWEEN -109 AND 109)
         THEN json_build_object('category','series','severity','positive','message',
              g.away_team_name||' won G1 '||g1a.g1_runs_scored||'-'||g1a.g1_runs_allowed||' — blowout carryover (58% G2 win rate, +5.8% ROI). Lean '||g.away_team_name||' side.')::text END,
    CASE WHEN g1a.g1_margin >= 8 AND g1a.g1_ml BETWEEN -109 AND 109
         THEN json_build_object('category','series','severity','negative','message',
              '⚠️ '||g.away_team_name||' blew out a pick em opponent in G1 ('||g1a.g1_runs_scored||'-'||g1a.g1_runs_allowed||') — historical TRAP (only 38% G2 win rate). FADE the momentum, regression spot.')::text END,
    CASE WHEN g1a.g1_margin <= -8
         THEN json_build_object('category','series','severity','negative','message',
              '⚠️ '||g.away_team_name||' got blown out '||g1a.g1_runs_scored||'-'||g1a.g1_runs_allowed||' in G1 — bounce-back myth (only 41.6% G2 win rate). Don''t chase the revenge narrative.')::text END
  ], NULL::text) AS away_signals,
  -- GAME SIGNALS — unchanged
  array_remove(ARRAY[
    CASE WHEN g.temperature_f > 85 AND g.wind_direction ILIKE '%out%'
         THEN json_build_object('category','weather','severity','over','message',
              'Hot weather ('||round(g.temperature_f::numeric,0)||'°F) with wind blowing out — elevated scoring, lean OVER')::text END,
    CASE WHEN g.temperature_f < 50
         THEN json_build_object('category','weather','severity','under','message',
              'Cold conditions ('||round(g.temperature_f::numeric,0)||'°F) — suppresses offense, lean UNDER')::text END,
    CASE WHEN g.wind_speed_mph > 15 AND g.wind_direction ILIKE '%in%'
         THEN json_build_object('category','weather','severity','under','message',
              'Strong wind ('||round(g.wind_speed_mph::numeric,0)||' mph) blowing IN — suppresses HR and fly balls, lean UNDER')::text END,
    CASE WHEN g.wind_speed_mph > 15 AND g.wind_direction ILIKE '%out%'
         THEN json_build_object('category','weather','severity','over','message',
              'Strong wind ('||round(g.wind_speed_mph::numeric,0)||' mph) blowing OUT — elevated HR potential, lean OVER')::text END,
    CASE WHEN pf.pf_runs > 106 AND pf.is_dome = false
         THEN json_build_object('category','park','severity','over','message',
              g.venue_name||' is a hitter-friendly park (run factor '||round(pf.pf_runs::numeric,0)||') — elevated scoring baseline')::text END,
    CASE WHEN pf.pf_runs < 94
         THEN json_build_object('category','park','severity','under','message',
              g.venue_name||' is a pitcher-friendly park (run factor '||round(pf.pf_runs::numeric,0)||') — suppressed scoring environment')::text END,
    CASE WHEN pf.pf_hr > 115
         THEN json_build_object('category','park','severity','over','message',
              g.venue_name||' is one of the best HR parks in baseball (HR factor '||round(pf.pf_hr::numeric,0)||')')::text END
  ], NULL::text) AS game_signals
FROM today_games g
LEFT JOIN home_sp     hsp ON g.game_pk = hsp.game_pk
LEFT JOIN away_sp     asp ON g.game_pk = asp.game_pk
LEFT JOIN home_bp     hbp ON g.game_pk = hbp.game_pk
LEFT JOIN away_bp     abp ON g.game_pk = abp.game_pk
LEFT JOIN home_bat    hbat ON g.game_pk = hbat.game_pk
LEFT JOIN away_bat    abat ON g.game_pk = abat.game_pk
LEFT JOIN home_sched  hsc  ON g.game_pk = hsc.game_pk
LEFT JOIN away_sched  asc_ ON g.game_pk = asc_.game_pk
LEFT JOIN pf                ON g.venue_name = pf.venue_name
LEFT JOIN g1_for_home  g1h  ON g.game_pk = g1h.today_game_pk
LEFT JOIN g1_for_away  g1a  ON g.game_pk = g1a.today_game_pk;
