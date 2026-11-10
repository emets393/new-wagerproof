-- 2026-11-10 — all_game_results: college results from ncaab_games_hist; scores exposed for the grader.
-- Project: CFB (jpxnjuwglavsjbgbasnl). Applied via the management API the same day.
--
-- WHY. Every college agent pick since the 2026-27 tip (171 picks, Nov 1-8) was graded `push` with
-- grading_skip_reason='game_postponed'. grade-avatar-picks reads this view for NBA/NCAAB finals and, when a
-- game is missing two days after its date, treats it as postponed. The NCAAB branch was built on
--   * cbb_input_values_archive  -- last archived 2026-10-28 (its writer went with the deleted xgboost chain), and
--   * ncaab_teamrankings_schedule -- a TeamRankings scrape whose make_date() hard-coded the 2025-26 year,
-- so no 2026-27 game ever resolved. ncaab_games_hist is the production model's own finals table
-- (ncaab_team_trends_daily.py, 6:30am ET: CBBD finals + the T-60 close from cbb_team_lines_history);
-- its cbbd_id is cbb_game_schedule.game_id, which is what avatar_picks.game_id stores.
--
-- Both basketball branches now also expose home_score / away_score / total_runs. gradePickFromView already
-- prefers that score-based path (margin + the AGENT's signed spread; total vs the AGENT's line) and only
-- fell back to spread_result / ou_result (computed against whatever line was last archived) because the view
-- had no scores. The fallback misgraded 22 of 446 NBA spread/total picks since Oct 20 ("Under 215.5" on a
-- 213-point game graded lost). The NBA CTEs are unchanged.
CREATE OR REPLACE VIEW public.all_game_results AS
 WITH nba_latest_inputs AS (
         SELECT i.service_date_et,
            i.archived_at_utc,
            i.game_id,
            i.season,
            i.game_date,
            i.game_type,
            i.home_team_id,
            i.home_abbr,
            i.home_team,
            i.away_team_id,
            i.away_abbr,
            i.away_team,
            i.home_moneyline,
            i.home_spread,
            i.total_line,
            i.home_adj_off_rtg_pregame,
            i.home_adj_def_rtg_pregame,
            i.home_adj_pace_pregame,
            i.home_adj_off_rtg_pregame_l3,
            i.home_adj_def_rtg_pregame_l3,
            i.home_adj_pace_pregame_l3,
            i.home_adj_off_rtg_pregame_l5,
            i.home_adj_def_rtg_pregame_l5,
            i.home_adj_pace_pregame_l5,
            i.home_adj_off_rtg_pregame_l3_trend,
            i.home_adj_def_rtg_pregame_l3_trend,
            i.home_adj_pace_pregame_l3_trend,
            i.home_adj_oreb_pct_pregame,
            i.home_adj_dreb_pct_pregame,
            i.home_adj_oreb_pct_pregame_l3,
            i.home_adj_dreb_pct_pregame_l3,
            i.home_ft_pct_pregame_mean,
            i.home_ft_pct_pregame_mean_l3,
            i.home_adj_fg2_pct_pregame,
            i.home_adj_fg3_pct_pregame,
            i.home_adj_fg2_pct_pregame_l3,
            i.home_adj_fg3_pct_pregame_l3,
            i.home_adj_stl_rate_pregame,
            i.home_adj_blk_rate_pregame,
            i.home_adj_blk_rate_pregame_l3,
            i.home_luck,
            i.home_ovr_rtg,
            i.home_consistency,
            i.away_adj_off_rtg_pregame,
            i.away_adj_def_rtg_pregame,
            i.away_adj_pace_pregame,
            i.away_adj_off_rtg_pregame_l3,
            i.away_adj_def_rtg_pregame_l3,
            i.away_adj_pace_pregame_l3,
            i.away_adj_off_rtg_pregame_l5,
            i.away_adj_def_rtg_pregame_l5,
            i.away_adj_pace_pregame_l5,
            i.away_adj_off_rtg_pregame_l3_trend,
            i.away_adj_def_rtg_pregame_l3_trend,
            i.away_adj_pace_pregame_l3_trend,
            i.away_adj_oreb_pct_pregame,
            i.away_adj_dreb_pct_pregame,
            i.away_adj_oreb_pct_pregame_l3,
            i.away_adj_dreb_pct_pregame_l3,
            i.away_ft_pct_pregame_mean,
            i.away_ft_pct_pregame_mean_l3,
            i.away_adj_fg2_pct_pregame,
            i.away_adj_fg3_pct_pregame,
            i.away_adj_fg2_pct_pregame_l3,
            i.away_adj_fg3_pct_pregame_l3,
            i.away_adj_stl_rate_pregame,
            i.away_adj_blk_rate_pregame,
            i.away_adj_blk_rate_pregame_l3,
            i.away_luck,
            i.away_ovr_rtg,
            i.away_consistency,
            i.home_ats_pct,
            i.home_over_pct,
            i.home_win_streak,
            i.home_ats_streak,
            i.home_last_ml,
            i.home_last_ats,
            i.home_last_ou,
            i.home_last_margin,
            i.away_ats_pct,
            i.away_over_pct,
            i.away_win_streak,
            i.away_ats_streak,
            i.away_last_ml,
            i.away_last_ats,
            i.away_last_ou,
            i.away_last_margin,
            i.tipoff_time_et,
            row_number() OVER (PARTITION BY i.game_id ORDER BY i.archived_at_utc DESC) AS rn
           FROM nba_input_values_archive i
        ), nba_final_scores AS (
         SELECT hb.game_id,
            hb.pts AS home_score_actual,
            ab.pts AS away_score_actual
           FROM nba_team_boxscores hb
             JOIN nba_team_boxscores ab ON ab.game_id = hb.game_id AND ab.is_home = 0
          WHERE hb.is_home = 1
        ), nba_typed AS (
         SELECT li.game_id,
            li.game_date,
            li.home_team,
            li.away_team,
            fs.home_score_actual,
            fs.away_score_actual,
                CASE
                    WHEN TRIM(BOTH FROM COALESCE(li.home_spread::text, ''::text)) ~* '^(pk|pick|pickem|pick''em)$'::text THEN 0::numeric
                    WHEN TRIM(BOTH FROM COALESCE(li.home_spread::text, ''::text)) ~ '^[+-]?\d+(\.\d+)?$'::text THEN TRIM(BOTH FROM li.home_spread::text)::numeric
                    ELSE NULL::numeric
                END AS home_spread_num,
                CASE
                    WHEN TRIM(BOTH FROM COALESCE(li.total_line::text, ''::text)) ~ '^\d+(\.\d+)?$'::text THEN TRIM(BOTH FROM li.total_line::text)::numeric
                    ELSE NULL::numeric
                END AS total_line_num
           FROM nba_latest_inputs li
             JOIN nba_final_scores fs ON fs.game_id = li.game_id
          WHERE li.rn = 1
        )
 SELECT 'NBA'::text AS league,
    nba.game_id::text AS game_id,
    nba.game_date,
    nba.home_team,
    nba.away_team,
        CASE
            WHEN nba.home_score_actual > nba.away_score_actual THEN nba.home_team
            WHEN nba.home_score_actual < nba.away_score_actual THEN nba.away_team
            ELSE NULL::text
        END AS ml_result,
        CASE
            WHEN nba.home_spread_num IS NULL THEN NULL::text
            WHEN (nba.home_score_actual::numeric + nba.home_spread_num) > nba.away_score_actual::numeric THEN nba.home_team
            WHEN (nba.home_score_actual::numeric + nba.home_spread_num) < nba.away_score_actual::numeric THEN nba.away_team
            ELSE 'PUSH'::text
        END AS spread_result,
        CASE
            WHEN nba.total_line_num IS NULL THEN NULL::text
            WHEN (nba.home_score_actual + nba.away_score_actual)::numeric > nba.total_line_num THEN 'OVER'::text
            WHEN (nba.home_score_actual + nba.away_score_actual)::numeric < nba.total_line_num THEN 'UNDER'::text
            ELSE 'PUSH'::text
        END AS ou_result
    nba.home_score_actual AS home_score,
    nba.away_score_actual AS away_score,
    (nba.home_score_actual + nba.away_score_actual) AS total_runs
   FROM nba_typed nba
UNION ALL
 SELECT 'NCAAB'::text AS league,
    h.cbbd_id::text AS game_id,
    h.date_et AS game_date,
    h.home_team,
    h.away_team,
        CASE
            WHEN h.home_score > h.away_score THEN h.home_team
            WHEN h.home_score < h.away_score THEN h.away_team
            ELSE NULL::text
        END AS ml_result,
        CASE
            WHEN h.close_spread IS NULL THEN NULL::text
            WHEN (h.home_score::numeric + h.close_spread::numeric) > h.away_score::numeric THEN h.home_team
            WHEN (h.home_score::numeric + h.close_spread::numeric) < h.away_score::numeric THEN h.away_team
            ELSE 'PUSH'::text
        END AS spread_result,
        CASE
            WHEN h.close_total IS NULL THEN NULL::text
            WHEN (h.home_score + h.away_score)::numeric > h.close_total::numeric THEN 'OVER'::text
            WHEN (h.home_score + h.away_score)::numeric < h.close_total::numeric THEN 'UNDER'::text
            ELSE 'PUSH'::text
        END AS ou_result,
    h.home_score,
    h.away_score,
    (h.home_score + h.away_score) AS total_runs
   FROM ncaab_games_hist h
  WHERE h.home_score IS NOT NULL AND h.away_score IS NOT NULL;
