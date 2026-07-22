-- nfl_analysis_upcoming v2 (2026-07-22): full filter-key parity with nfl_analysis.
-- Slate context (lines/ML/wx/referee) from nfl_dryrun_games; current form (records,
-- streaks, rates), last-game flags, prev-year, H2H, stadium and division context are
-- computed live from nfl_analysis_base. Keys that CANNOT be honored on a slate
-- (pre_bye needs next week's schedule; playoff_round never matches a regular slate)
-- conservatively return ZERO games instead of silently ignoring the filter.
CREATE OR REPLACE FUNCTION public.nfl_analysis_upcoming(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
WITH cs AS (
  SELECT CASE WHEN EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/New_York')) >= 8
              THEN EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/New_York'))::int
              ELSE EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/New_York'))::int - 1 END AS season
),
ex AS (
  SELECT g.season, g.week, g.gameday, g.kickoff, g.slot, g.assigned_referee AS referee,
    true AS is_home, g.home_ab AS team, g.away_ab AS opponent, g.home_team AS team_name, g.away_team AS opp_name,
    g.fg_spread_close AS team_spread, g.fg_total_close AS total,
    g.tt_home_close AS tt_line, g.tt_away_close AS opp_tt_line,
    g.h1_spread_close AS h1_spread, g.h1_total_close AS h1_total,
    g.fg_ml_home_close AS team_ml, g.fg_ml_away_close AS opp_ml, g.h1_ml_home_close AS h1_ml_am,
    g.wx_temp_f, g.wx_wind_mph, g.wx_icon, g.wx_summary
  FROM nfl_dryrun_games g WHERE g.kickoff > now()
  UNION ALL
  SELECT g.season, g.week, g.gameday, g.kickoff, g.slot, g.assigned_referee,
    false, g.away_ab, g.home_ab, g.away_team, g.home_team,
    (-g.fg_spread_close), g.fg_total_close,
    g.tt_away_close, g.tt_home_close,
    (-g.h1_spread_close), g.h1_total_close,
    g.fg_ml_away_close, g.fg_ml_home_close, g.h1_ml_away_close,
    g.wx_temp_f, g.wx_wind_mph, g.wx_icon, g.wx_summary
  FROM nfl_dryrun_games g WHERE g.kickoff > now()
),
bcur AS (SELECT b.* FROM nfl_analysis_base b, cs WHERE b.season = cs.season AND b.season_type = 'regular'),
aggc AS (
  SELECT team_abbr,
    count(*) FILTER (WHERE fg_won IS NOT NULL) AS gp,
    count(*) FILTER (WHERE fg_won = 1) AS wins,
    (count(*) FILTER (WHERE fg_won = 1))::numeric / NULLIF(count(*) FILTER (WHERE fg_won IS NOT NULL), 0) AS win_pct,
    (count(*) FILTER (WHERE fg_covered = 1))::numeric / NULLIF(count(*) FILTER (WHERE fg_covered IS NOT NULL), 0) AS ats_win_pct,
    (count(*) FILTER (WHERE ou_result = 1))::numeric / NULLIF(count(*) FILTER (WHERE ou_result IS NOT NULL), 0) AS over_pct,
    avg((team_score - opp_score) + fg_spread) FILTER (WHERE fg_covered IS NOT NULL) AS avg_cover_margin,
    avg(team_score) FILTER (WHERE fg_won IS NOT NULL) AS ppg,
    avg(opp_score) FILTER (WHERE fg_won IS NOT NULL) AS pa_pg,
    avg(team_score - opp_score) FILTER (WHERE fg_won IS NOT NULL) AS point_diff_pg
  FROM bcur GROUP BY team_abbr
),
tw AS (SELECT team_abbr, fg_won AS v, row_number() OVER (PARTITION BY team_abbr ORDER BY game_date DESC, kickoff DESC) rn FROM bcur WHERE fg_won IS NOT NULL),
sw AS (SELECT team_abbr,
    coalesce(min(rn) FILTER (WHERE v = 0) - 1, count(*)::int) AS win_streak,
    coalesce(min(rn) FILTER (WHERE v = 1) - 1, count(*)::int) AS loss_streak
  FROM tw GROUP BY team_abbr),
ta AS (SELECT team_abbr, fg_covered AS v, row_number() OVER (PARTITION BY team_abbr ORDER BY game_date DESC, kickoff DESC) rn FROM bcur WHERE fg_covered IS NOT NULL),
sa AS (SELECT team_abbr, coalesce(min(rn) FILTER (WHERE v = 0) - 1, count(*)::int) AS ats_win_streak FROM ta GROUP BY team_abbr),
tu AS (SELECT team_abbr, ou_result AS v, row_number() OVER (PARTITION BY team_abbr ORDER BY game_date DESC, kickoff DESC) rn FROM bcur WHERE ou_result IS NOT NULL),
su AS (SELECT team_abbr,
    coalesce(min(rn) FILTER (WHERE v = 0) - 1, count(*)::int) AS over_streak,
    coalesce(min(rn) FILTER (WHERE v = 1) - 1, count(*)::int) AS under_streak
  FROM tu GROUP BY team_abbr),
pyr AS (
  SELECT b.team_abbr,
    count(*) FILTER (WHERE b.fg_won = 1 AND b.season_type = 'regular') AS prev_wins,
    (count(*) FILTER (WHERE b.fg_won = 1 AND b.season_type = 'regular'))::numeric
      / NULLIF(count(*) FILTER (WHERE b.fg_won IS NOT NULL AND b.season_type = 'regular'), 0) AS prev_win_pct,
    bool_or(b.season_type <> 'regular') AS made_playoffs
  FROM nfl_analysis_base b, cs WHERE b.season = cs.season - 1 GROUP BY b.team_abbr
),
lastcs AS (
  SELECT DISTINCT ON (team_abbr) team_abbr, fg_won AS lw, fg_covered AS lc, ou_result AS lo,
    is_favorite AS lf, overtime AS lot, (team_score - opp_score) AS lmargin, game_date AS lgameday
  FROM bcur ORDER BY team_abbr, game_date DESC, kickoff DESC
),
lastany AS (
  SELECT DISTINCT ON (team_abbr) team_abbr, fg_covered AS ls_spread, ou_result AS ls_ou, fg_won AS ls_ml, coach
  FROM nfl_analysis_base ORDER BY team_abbr, game_date DESC, kickoff DESC
),
stad AS (
  SELECT DISTINCT ON (team_abbr) team_abbr, dome, surface
  FROM nfl_analysis_base WHERE is_home ORDER BY team_abbr, game_date DESC
),
divmap AS (
  SELECT DISTINCT ON (team_abbr) team_abbr, team_division
  FROM nfl_analysis_base WHERE team_division IS NOT NULL ORDER BY team_abbr, game_date DESC
),
h2h AS (
  SELECT DISTINCT ON (b.team_abbr, b.opponent_abbr) b.team_abbr, b.opponent_abbr,
    b.fg_won AS hw, b.fg_covered AS hc, b.ou_result AS ho, b.is_home AS hh, b.is_favorite AS hf,
    b.season AS hs, b.fg_spread AS hspread
  FROM nfl_analysis_base b
  JOIN (SELECT DISTINCT team, opponent FROM ex) p ON p.team = b.team_abbr AND p.opponent = b.opponent_abbr
  ORDER BY b.team_abbr, b.opponent_abbr, b.game_date DESC, b.kickoff DESC
),
m AS (
  SELECT e.*, cs.season AS cur_season,
    (e.slot IN ('snf','monday','thu_fri')) AS is_primetime,
    (e.team_spread < 0) AS is_favorite,
    trim(to_char(e.gameday, 'Dy')) AS day_of_week,
    dm.team_division, dmo.team_division AS opp_division,
    (dm.team_division = dmo.team_division) AS is_division,
    st.dome, st.surface,
    a.gp, a.wins, a.win_pct, a.ats_win_pct, a.over_pct, a.avg_cover_margin, a.ppg, a.pa_pg, a.point_diff_pg,
    w.win_streak, w.loss_streak, sa.ats_win_streak, su.over_streak, su.under_streak,
    ao.win_pct AS opp_win_pct, ao.ats_win_pct AS opp_ats_win_pct, ao.over_pct AS opp_over_pct,
    ao.ppg AS opp_ppg, ao.pa_pg AS opp_pa_pg,
    wo.win_streak AS opp_win_streak, wo.loss_streak AS opp_loss_streak,
    pt.prev_wins, pt.prev_win_pct, pt.made_playoffs,
    po.prev_wins AS opp_prev_wins, po.prev_win_pct AS opp_prev_win_pct, po.made_playoffs AS opp_made_playoffs,
    lc.lw AS last_won_v, lc.lc AS last_covered_v, lc.lo AS last_over_v, lc.lf AS last_favorite_v,
    lc.lot AS last_overtime_v, lc.lmargin AS last_margin_v,
    (e.gameday - lc.lgameday) AS rest_days,
    lco.lw AS opp_last_won_v, lco.lc AS opp_last_covered_v, lco.lo AS opp_last_over_v,
    lco.lf AS opp_last_favorite_v, lco.lot AS opp_last_overtime_v, lco.lmargin AS opp_last_margin_v,
    la.ls_spread, la.ls_ou, la.ls_ml, la.coach,
    h.hw AS h2h_last_win_v, h.hc AS h2h_last_ats_v, h.ho AS h2h_last_over_v, h.hh AS h2h_last_home_v,
    h.hf AS h2h_last_fav_v, h.hs AS h2h_last_season_v, h.hspread AS h2h_last_spread_v,
    (h.hs = cs.season) AS h2h_same_season_v,
    CASE WHEN e.h1_ml_am IS NULL THEN NULL
         WHEN e.h1_ml_am < 0 THEN 1 + 100.0/abs(e.h1_ml_am) ELSE 1 + e.h1_ml_am/100.0 END AS h1_ml_px
  FROM ex e CROSS JOIN cs
  LEFT JOIN divmap dm  ON dm.team_abbr = e.team
  LEFT JOIN divmap dmo ON dmo.team_abbr = e.opponent
  LEFT JOIN stad st ON st.team_abbr = CASE WHEN e.is_home THEN e.team ELSE e.opponent END
  LEFT JOIN aggc a  ON a.team_abbr = e.team
  LEFT JOIN aggc ao ON ao.team_abbr = e.opponent
  LEFT JOIN sw w    ON w.team_abbr = e.team
  LEFT JOIN sw wo   ON wo.team_abbr = e.opponent
  LEFT JOIN sa      ON sa.team_abbr = e.team
  LEFT JOIN su      ON su.team_abbr = e.team
  LEFT JOIN pyr pt  ON pt.team_abbr = e.team
  LEFT JOIN pyr po  ON po.team_abbr = e.opponent
  LEFT JOIN lastcs lc  ON lc.team_abbr = e.team
  LEFT JOIN lastcs lco ON lco.team_abbr = e.opponent
  LEFT JOIN lastany la ON la.team_abbr = e.team
  LEFT JOIN h2h h ON h.team_abbr = e.team AND h.opponent_abbr = e.opponent
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'week', week, 'kickoff', kickoff, 'slot', slot, 'matchup', team_name||' vs '||opp_name,
    'team', team, 'opponent', opponent, 'is_home', is_home, 'is_favorite', is_favorite,
    'team_spread', team_spread, 'total', total, 'tt_line', tt_line,
    'h1_spread', h1_spread, 'h1_total', h1_total, 'referee', referee,
    'team_ml', team_ml, 'day_of_week', day_of_week, 'is_division', is_division,
    'rest_days', rest_days, 'win_pct', round(win_pct::numeric,3), 'win_streak', win_streak,
    'loss_streak', loss_streak, 'ats_win_pct', round(ats_win_pct::numeric,3),
    'over_pct', round(over_pct::numeric,3), 'opp_win_pct', round(opp_win_pct::numeric,3),
    'h2h_last_win', h2h_last_win_v) ORDER BY kickoff), '[]'::jsonb)
FROM m
WHERE
  (p_filters->>'side' IS NULL OR is_home = ((p_filters->>'side')='home'))
  AND (p_filters->>'fav_dog' IS NULL OR is_favorite = ((p_filters->>'fav_dog')='favorite'))
  AND (p_filters->>'spread_min' IS NULL OR team_spread >= (p_filters->>'spread_min')::numeric)
  AND (p_filters->>'spread_max' IS NULL OR team_spread <= (p_filters->>'spread_max')::numeric)
  AND (p_filters->>'abs_spread_min' IS NULL OR abs(team_spread) >= (p_filters->>'abs_spread_min')::numeric)
  AND (p_filters->>'abs_spread_max' IS NULL OR abs(team_spread) <= (p_filters->>'abs_spread_max')::numeric)
  AND (p_filters->>'total_min' IS NULL OR total >= (p_filters->>'total_min')::numeric)
  AND (p_filters->>'total_max' IS NULL OR total <= (p_filters->>'total_max')::numeric)
  AND (p_filters->>'tt_min' IS NULL OR tt_line >= (p_filters->>'tt_min')::numeric)
  AND (p_filters->>'tt_max' IS NULL OR tt_line <= (p_filters->>'tt_max')::numeric)
  AND (p_filters->>'h1_spread_min' IS NULL OR h1_spread >= (p_filters->>'h1_spread_min')::numeric)
  AND (p_filters->>'h1_spread_max' IS NULL OR h1_spread <= (p_filters->>'h1_spread_max')::numeric)
  AND (p_filters->>'h1_abs_spread_min' IS NULL OR abs(h1_spread) >= (p_filters->>'h1_abs_spread_min')::numeric)
  AND (p_filters->>'h1_abs_spread_max' IS NULL OR abs(h1_spread) <= (p_filters->>'h1_abs_spread_max')::numeric)
  AND (p_filters->>'h1_total_min' IS NULL OR h1_total >= (p_filters->>'h1_total_min')::numeric)
  AND (p_filters->>'h1_total_max' IS NULL OR h1_total <= (p_filters->>'h1_total_max')::numeric)
  AND (p_filters->>'primetime' IS NULL OR is_primetime = (p_filters->>'primetime')::boolean)
  AND (p_filters->>'referee' IS NULL OR referee = (p_filters->>'referee'))
  AND (p_filters->'team' IS NULL OR team IN (SELECT jsonb_array_elements_text(p_filters->'team')))
  AND (p_filters->'opponent' IS NULL OR opponent IN (SELECT jsonb_array_elements_text(p_filters->'opponent')))
  AND (p_filters->>'season_min' IS NULL OR season >= (p_filters->>'season_min')::int)
  AND (p_filters->>'season_max' IS NULL OR season <= (p_filters->>'season_max')::int)
  AND (p_filters->>'week_min' IS NULL OR week >= (p_filters->>'week_min')::int)
  AND (p_filters->>'week_max' IS NULL OR week <= (p_filters->>'week_max')::int)
  AND (p_filters->>'season_type' IS NULL OR (p_filters->>'season_type') = 'regular')
  AND (p_filters->>'playoff_round' IS NULL OR false)
  AND (p_filters->>'pre_bye' IS NULL OR false)
  AND (p_filters->>'ml_min' IS NULL OR team_ml >= (p_filters->>'ml_min')::numeric)
  AND (p_filters->>'ml_max' IS NULL OR team_ml <= (p_filters->>'ml_max')::numeric)
  AND (p_filters->>'h1_ml_min' IS NULL OR h1_ml_px >= (CASE WHEN abs((p_filters->>'h1_ml_min')::numeric) >= 100
    THEN CASE WHEN (p_filters->>'h1_ml_min')::numeric < 0
      THEN 1 + 100 / abs((p_filters->>'h1_ml_min')::numeric)
      ELSE 1 + (p_filters->>'h1_ml_min')::numeric / 100 END
    ELSE (p_filters->>'h1_ml_min')::numeric END))
  AND (p_filters->>'h1_ml_max' IS NULL OR h1_ml_px <= (CASE WHEN abs((p_filters->>'h1_ml_max')::numeric) >= 100
    THEN CASE WHEN (p_filters->>'h1_ml_max')::numeric < 0
      THEN 1 + 100 / abs((p_filters->>'h1_ml_max')::numeric)
      ELSE 1 + (p_filters->>'h1_ml_max')::numeric / 100 END
    ELSE (p_filters->>'h1_ml_max')::numeric END))
  AND (p_filters->>'opp_ml_min' IS NULL OR opp_ml >= (p_filters->>'opp_ml_min')::numeric)
  AND (p_filters->>'opp_ml_max' IS NULL OR opp_ml <= (p_filters->>'opp_ml_max')::numeric)
  AND (p_filters->>'opp_tt_min' IS NULL OR opp_tt_line >= (p_filters->>'opp_tt_min')::numeric)
  AND (p_filters->>'opp_tt_max' IS NULL OR opp_tt_line <= (p_filters->>'opp_tt_max')::numeric)
  AND (p_filters->>'division' IS NULL OR is_division = (p_filters->>'division')::boolean)
  AND (p_filters->'day_of_week' IS NULL OR day_of_week IN (SELECT jsonb_array_elements_text(p_filters->'day_of_week')))
  AND (p_filters->'team_division' IS NULL OR team_division IN (SELECT jsonb_array_elements_text(p_filters->'team_division')))
  AND (p_filters->>'dome' IS NULL OR dome = (p_filters->>'dome')::boolean)
  AND (p_filters->>'surface' IS NULL OR surface ILIKE '%'||(p_filters->>'surface')||'%')
  AND (p_filters->>'temp_min' IS NULL OR wx_temp_f >= (p_filters->>'temp_min')::numeric)
  AND (p_filters->>'temp_max' IS NULL OR wx_temp_f <= (p_filters->>'temp_max')::numeric)
  AND (p_filters->>'wind_min' IS NULL OR wx_wind_mph >= (p_filters->>'wind_min')::numeric)
  AND (p_filters->>'wind_max' IS NULL OR wx_wind_mph <= (p_filters->>'wind_max')::numeric)
  AND (p_filters->>'precip' IS NULL
       OR ((p_filters->>'precip')='rain' AND (wx_icon ILIKE '%rain%' OR wx_summary ILIKE '%rain%'))
       OR ((p_filters->>'precip')='snow' AND (wx_icon ILIKE '%snow%' OR wx_summary ILIKE '%snow%'))
       OR ((p_filters->>'precip')='none' AND NOT (COALESCE(wx_icon,'') ILIKE '%rain%' OR COALESCE(wx_summary,'') ILIKE '%rain%'
            OR COALESCE(wx_icon,'') ILIKE '%snow%' OR COALESCE(wx_summary,'') ILIKE '%snow%')))
  AND (p_filters->>'rest_min' IS NULL OR rest_days >= (p_filters->>'rest_min')::numeric)
  AND (p_filters->>'rest_max' IS NULL OR rest_days <= (p_filters->>'rest_max')::numeric)
  AND (p_filters->>'coach' IS NULL OR coach = (p_filters->>'coach'))
  AND (p_filters->>'min_games' IS NULL OR gp >= (p_filters->>'min_games')::int)
  AND (p_filters->>'win_pct_min' IS NULL OR win_pct >= (p_filters->>'win_pct_min')::numeric)
  AND (p_filters->>'win_pct_max' IS NULL OR win_pct <= (p_filters->>'win_pct_max')::numeric)
  AND (p_filters->>'ats_win_pct_min' IS NULL OR ats_win_pct >= (p_filters->>'ats_win_pct_min')::numeric)
  AND (p_filters->>'ats_win_pct_max' IS NULL OR ats_win_pct <= (p_filters->>'ats_win_pct_max')::numeric)
  AND (p_filters->>'over_pct_min' IS NULL OR over_pct >= (p_filters->>'over_pct_min')::numeric)
  AND (p_filters->>'over_pct_max' IS NULL OR over_pct <= (p_filters->>'over_pct_max')::numeric)
  AND (p_filters->>'win_streak_min' IS NULL OR win_streak >= (p_filters->>'win_streak_min')::numeric)
  AND (p_filters->>'win_streak_max' IS NULL OR win_streak <= (p_filters->>'win_streak_max')::numeric)
  AND (p_filters->>'loss_streak_min' IS NULL OR loss_streak >= (p_filters->>'loss_streak_min')::numeric)
  AND (p_filters->>'loss_streak_max' IS NULL OR loss_streak <= (p_filters->>'loss_streak_max')::numeric)
  AND (p_filters->>'ats_win_streak_min' IS NULL OR ats_win_streak >= (p_filters->>'ats_win_streak_min')::numeric)
  AND (p_filters->>'ats_win_streak_max' IS NULL OR ats_win_streak <= (p_filters->>'ats_win_streak_max')::numeric)
  AND (p_filters->>'over_streak_min' IS NULL OR over_streak >= (p_filters->>'over_streak_min')::numeric)
  AND (p_filters->>'over_streak_max' IS NULL OR over_streak <= (p_filters->>'over_streak_max')::numeric)
  AND (p_filters->>'under_streak_min' IS NULL OR under_streak >= (p_filters->>'under_streak_min')::numeric)
  AND (p_filters->>'under_streak_max' IS NULL OR under_streak <= (p_filters->>'under_streak_max')::numeric)
  AND (p_filters->>'avg_cover_margin_min' IS NULL OR avg_cover_margin >= (p_filters->>'avg_cover_margin_min')::numeric)
  AND (p_filters->>'avg_cover_margin_max' IS NULL OR avg_cover_margin <= (p_filters->>'avg_cover_margin_max')::numeric)
  AND (p_filters->>'ppg_min' IS NULL OR ppg >= (p_filters->>'ppg_min')::numeric)
  AND (p_filters->>'ppg_max' IS NULL OR ppg <= (p_filters->>'ppg_max')::numeric)
  AND (p_filters->>'pa_pg_min' IS NULL OR pa_pg >= (p_filters->>'pa_pg_min')::numeric)
  AND (p_filters->>'pa_pg_max' IS NULL OR pa_pg <= (p_filters->>'pa_pg_max')::numeric)
  AND (p_filters->>'point_diff_pg_min' IS NULL OR point_diff_pg >= (p_filters->>'point_diff_pg_min')::numeric)
  AND (p_filters->>'point_diff_pg_max' IS NULL OR point_diff_pg <= (p_filters->>'point_diff_pg_max')::numeric)
  AND (p_filters->>'prev_wins_min' IS NULL OR prev_wins >= (p_filters->>'prev_wins_min')::numeric)
  AND (p_filters->>'prev_wins_max' IS NULL OR prev_wins <= (p_filters->>'prev_wins_max')::numeric)
  AND (p_filters->>'prev_win_pct_min' IS NULL OR prev_win_pct >= (p_filters->>'prev_win_pct_min')::numeric)
  AND (p_filters->>'prev_win_pct_max' IS NULL OR prev_win_pct <= (p_filters->>'prev_win_pct_max')::numeric)
  AND (p_filters->>'made_playoffs_prev' IS NULL OR made_playoffs = (p_filters->>'made_playoffs_prev')::boolean)
  AND (p_filters->>'opp_made_playoffs_prev' IS NULL OR opp_made_playoffs = (p_filters->>'opp_made_playoffs_prev')::boolean)
  AND (p_filters->>'opp_win_pct_min' IS NULL OR opp_win_pct >= (p_filters->>'opp_win_pct_min')::numeric)
  AND (p_filters->>'opp_win_pct_max' IS NULL OR opp_win_pct <= (p_filters->>'opp_win_pct_max')::numeric)
  AND (p_filters->>'opp_ats_win_pct_min' IS NULL OR opp_ats_win_pct >= (p_filters->>'opp_ats_win_pct_min')::numeric)
  AND (p_filters->>'opp_ats_win_pct_max' IS NULL OR opp_ats_win_pct <= (p_filters->>'opp_ats_win_pct_max')::numeric)
  AND (p_filters->>'opp_over_pct_min' IS NULL OR opp_over_pct >= (p_filters->>'opp_over_pct_min')::numeric)
  AND (p_filters->>'opp_over_pct_max' IS NULL OR opp_over_pct <= (p_filters->>'opp_over_pct_max')::numeric)
  AND (p_filters->>'opp_win_streak_min' IS NULL OR opp_win_streak >= (p_filters->>'opp_win_streak_min')::numeric)
  AND (p_filters->>'opp_win_streak_max' IS NULL OR opp_win_streak <= (p_filters->>'opp_win_streak_max')::numeric)
  AND (p_filters->>'opp_loss_streak_min' IS NULL OR opp_loss_streak >= (p_filters->>'opp_loss_streak_min')::numeric)
  AND (p_filters->>'opp_loss_streak_max' IS NULL OR opp_loss_streak <= (p_filters->>'opp_loss_streak_max')::numeric)
  AND (p_filters->>'opp_ppg_min' IS NULL OR opp_ppg >= (p_filters->>'opp_ppg_min')::numeric)
  AND (p_filters->>'opp_ppg_max' IS NULL OR opp_ppg <= (p_filters->>'opp_ppg_max')::numeric)
  AND (p_filters->>'opp_pa_pg_min' IS NULL OR opp_pa_pg >= (p_filters->>'opp_pa_pg_min')::numeric)
  AND (p_filters->>'opp_pa_pg_max' IS NULL OR opp_pa_pg <= (p_filters->>'opp_pa_pg_max')::numeric)
  AND (p_filters->>'opp_prev_win_pct_min' IS NULL OR opp_prev_win_pct >= (p_filters->>'opp_prev_win_pct_min')::numeric)
  AND (p_filters->>'opp_prev_win_pct_max' IS NULL OR opp_prev_win_pct <= (p_filters->>'opp_prev_win_pct_max')::numeric)
  AND (p_filters->>'above_500' IS NULL OR (win_pct > 0.5) = (p_filters->>'above_500')::boolean)
  AND (p_filters->>'win_pct_gt_opp' IS NULL OR (win_pct > opp_win_pct) = (p_filters->>'win_pct_gt_opp')::boolean)
  AND (p_filters->>'more_wins_than_opp_prev' IS NULL OR (prev_wins > opp_prev_wins) = (p_filters->>'more_wins_than_opp_prev')::boolean)
  AND (p_filters->>'last_won' IS NULL OR last_won_v = (p_filters->>'last_won')::int)
  AND (p_filters->>'last_covered' IS NULL OR last_covered_v = (p_filters->>'last_covered')::int)
  AND (p_filters->>'last_over' IS NULL OR last_over_v = (p_filters->>'last_over')::int)
  AND (p_filters->>'last_favorite' IS NULL OR last_favorite_v = (p_filters->>'last_favorite')::boolean)
  AND (p_filters->>'last_overtime' IS NULL OR last_overtime_v = (p_filters->>'last_overtime')::boolean)
  AND (p_filters->>'last_margin_min' IS NULL OR last_margin_v >= (p_filters->>'last_margin_min')::int)
  AND (p_filters->>'last_margin_max' IS NULL OR last_margin_v <= (p_filters->>'last_margin_max')::int)
  AND (p_filters->>'last_spread' IS NULL OR ls_spread = (p_filters->>'last_spread')::int)
  AND (p_filters->>'last_ou' IS NULL OR ls_ou = (p_filters->>'last_ou')::int)
  AND (p_filters->>'last_ml' IS NULL OR ls_ml = (p_filters->>'last_ml')::int)
  AND (p_filters->>'opp_last_won' IS NULL OR opp_last_won_v = (p_filters->>'opp_last_won')::int)
  AND (p_filters->>'opp_last_covered' IS NULL OR opp_last_covered_v = (p_filters->>'opp_last_covered')::int)
  AND (p_filters->>'opp_last_over' IS NULL OR opp_last_over_v = (p_filters->>'opp_last_over')::int)
  AND (p_filters->>'opp_last_favorite' IS NULL OR opp_last_favorite_v = (p_filters->>'opp_last_favorite')::boolean)
  AND (p_filters->>'opp_last_overtime' IS NULL OR opp_last_overtime_v = (p_filters->>'opp_last_overtime')::boolean)
  AND (p_filters->>'opp_last_margin_min' IS NULL OR opp_last_margin_v >= (p_filters->>'opp_last_margin_min')::int)
  AND (p_filters->>'opp_last_margin_max' IS NULL OR opp_last_margin_v <= (p_filters->>'opp_last_margin_max')::int)
  AND (p_filters->>'h2h_last_win' IS NULL OR h2h_last_win_v = (p_filters->>'h2h_last_win')::int)
  AND (p_filters->>'h2h_last_ats_win' IS NULL OR h2h_last_ats_v = (p_filters->>'h2h_last_ats_win')::int)
  AND (p_filters->>'h2h_last_over' IS NULL OR h2h_last_over_v = (p_filters->>'h2h_last_over')::int)
  AND (p_filters->>'h2h_last_home' IS NULL OR h2h_last_home_v = (p_filters->>'h2h_last_home')::boolean)
  AND (p_filters->>'h2h_last_fav' IS NULL OR h2h_last_fav_v = (p_filters->>'h2h_last_fav')::boolean)
  AND (p_filters->>'h2h_same_season' IS NULL OR h2h_same_season_v = (p_filters->>'h2h_same_season')::boolean)
  AND (p_filters->>'h2h_spread_lower' IS NULL OR (h2h_last_spread_v < team_spread) = (p_filters->>'h2h_spread_lower')::boolean)
  AND (p_filters->>'h2h_spread_higher' IS NULL OR (h2h_last_spread_v > team_spread) = (p_filters->>'h2h_spread_higher')::boolean);
$function$
