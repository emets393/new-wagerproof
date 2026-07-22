CREATE OR REPLACE FUNCTION public.cfb_system_rows(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(
  "exploded_id" text,
  "unique_id" text,
  "game_id" bigint,
  "season" integer,
  "week" integer,
  "is_home" boolean,
  "team" text,
  "opponent" text,
  "team_conference" text,
  "opponent_conference" text,
  "team_score" integer,
  "opp_score" integer,
  "kick_hour_et" numeric,
  "fg_spread" numeric,
  "fg_total" numeric,
  "total_points" integer,
  "is_favorite" boolean,
  "fg_covered" integer,
  "fg_won" integer,
  "ou_result" integer,
  "tt_line" numeric,
  "tt_over" integer,
  "h1_spread" numeric,
  "h1_covered" integer,
  "h1_total" numeric,
  "h1_total_over" integer,
  "h1_won" integer,
  "is_conference_game" boolean,
  "neutral_site" boolean,
  "is_primetime" boolean,
  "temperature" numeric,
  "wind_speed" numeric,
  "precipitation" numeric,
  "has_tt" boolean,
  "has_h1" boolean,
  "has_weather" boolean,
  "game_type" text,
  "team_ml" numeric,
  "team_rank" integer,
  "opp_rank" integer,
  "overtime" boolean,
  "last_fg_won" integer,
  "last_fg_covered" integer,
  "last_ou_result" integer,
  "last_is_favorite" boolean,
  "last_overtime" boolean,
  "last_margin" numeric,
  "weather_condition" text,
  "dome" boolean,
  "team_gp_s2d" integer,
  "team_wins_s2d" integer,
  "team_losses_s2d" integer,
  "team_win_pct" numeric,
  "team_win_streak" integer,
  "team_loss_streak" integer,
  "team_ats_wins_s2d" integer,
  "team_ats_losses_s2d" integer,
  "team_ats_win_pct" numeric,
  "team_ats_win_streak" integer,
  "team_ats_loss_streak" integer,
  "team_avg_cover_margin" numeric,
  "team_over_count_s2d" integer,
  "team_ou_games_s2d" integer,
  "team_over_pct" numeric,
  "team_over_streak" integer,
  "team_under_streak" integer,
  "team_ppg" numeric,
  "team_pa_pg" numeric,
  "team_point_diff_pg" numeric,
  "team_prev_wins" integer,
  "team_prev_losses" integer,
  "team_prev_win_pct" numeric,
  "team_made_playoffs_prev" boolean,
  "h2h_last_win" integer,
  "h2h_last_ats_win" integer,
  "h2h_last_over" integer,
  "h2h_last_home" boolean,
  "h2h_last_fav" boolean,
  "h2h_last_margin" numeric,
  "h2h_last_spread" numeric,
  "h2h_last_total" numeric,
  "h2h_last_ml" numeric,
  "h2h_last_season" integer,
  "h2h_same_season" boolean,
  "opp_gp_s2d" integer,
  "opp_wins_s2d" integer,
  "opp_losses_s2d" integer,
  "opp_win_pct" numeric,
  "opp_win_streak" integer,
  "opp_loss_streak" integer,
  "opp_ats_wins_s2d" integer,
  "opp_ats_losses_s2d" integer,
  "opp_ats_win_pct" numeric,
  "opp_ats_win_streak" integer,
  "opp_ats_loss_streak" integer,
  "opp_avg_cover_margin" numeric,
  "opp_over_count_s2d" integer,
  "opp_ou_games_s2d" integer,
  "opp_over_pct" numeric,
  "opp_over_streak" integer,
  "opp_under_streak" integer,
  "opp_ppg" numeric,
  "opp_pa_pg" numeric,
  "opp_point_diff_pg" numeric,
  "opp_prev_wins" integer,
  "opp_prev_losses" integer,
  "opp_prev_win_pct" numeric,
  "opp_made_playoffs_prev" boolean,
  "opp_last_fg_won" integer,
  "opp_last_fg_covered" integer,
  "opp_last_ou_result" integer,
  "opp_last_is_favorite" boolean,
  "opp_last_overtime" boolean,
  "opp_last_margin" integer,
  "game_date" date,
  "day_of_week" text,
  "fg_spread_px" numeric,
  "fg_total_over_px" numeric,
  "fg_total_under_px" numeric,
  "rest_days" integer,
  "pre_bye" boolean,
  "h1_ml_px" numeric,
  "h1_spread_px" numeric,
  "h1_total_over_px" numeric,
  "h1_total_under_px" numeric,
  "tt_over_px" numeric,
  "tt_under_px" numeric,
  hit integer,
  bet_profit numeric,
  under_profit numeric,
  opp_hit integer,
  opp_profit numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT b.*,
    
    CASE p_bet_type
      WHEN 'fg_spread' THEN b.fg_covered WHEN 'fg_ml' THEN b.fg_won
      WHEN 'fg_total' THEN b.ou_result  WHEN 'team_total' THEN b.tt_over
      WHEN 'h1_spread' THEN b.h1_covered WHEN 'h1_ml' THEN b.h1_won
      WHEN 'h1_total' THEN b.h1_total_over END AS hit,
    -- real-price per-row profit (decimal closing px 2021+; flat -110 fallback; ML rows w/o price excluded)
    CASE p_bet_type
      WHEN 'fg_ml' THEN CASE WHEN b.team_ml IS NOT NULL AND b.team_score IS DISTINCT FROM b.opp_score
        THEN CASE WHEN b.fg_won=1 THEN CASE WHEN b.team_ml > 0 THEN b.team_ml/100.0 ELSE 100.0/ABS(b.team_ml) END ELSE -1 END END
      WHEN 'h1_ml' THEN CASE WHEN b.h1_ml_px IS NOT NULL
        THEN CASE WHEN b.h1_won=1 THEN b.h1_ml_px - 1 ELSE -1 END END
      WHEN 'fg_spread' THEN CASE WHEN b.fg_covered=1 THEN COALESCE(b.fg_spread_px - 1, 0.909) ELSE -1 END
      WHEN 'h1_spread' THEN CASE WHEN b.h1_covered=1 THEN COALESCE(b.h1_spread_px - 1, 0.909) ELSE -1 END
      WHEN 'fg_total' THEN CASE WHEN b.ou_result=1 THEN COALESCE(b.fg_total_over_px - 1, 0.909) ELSE -1 END
      WHEN 'h1_total' THEN CASE WHEN b.h1_total_over=1 THEN COALESCE(b.h1_total_over_px - 1, 0.909) ELSE -1 END
      WHEN 'team_total' THEN CASE WHEN b.tt_over=1 THEN COALESCE(b.tt_over_px - 1, 0.909) ELSE -1 END
    END AS bet_profit,
    CASE p_bet_type
      WHEN 'fg_total' THEN CASE WHEN b.ou_result=0 THEN COALESCE(b.fg_total_under_px - 1, 0.909) ELSE -1 END
      WHEN 'h1_total' THEN CASE WHEN b.h1_total_over=0 THEN COALESCE(b.h1_total_under_px - 1, 0.909) ELSE -1 END
      WHEN 'team_total' THEN CASE WHEN b.tt_over=0 THEN COALESCE(b.tt_under_px - 1, 0.909) ELSE -1 END
    END AS under_profit,
    opp.o_hit::integer AS opp_hit,
    opp.o_profit::numeric AS opp_profit
  FROM cfb_analysis_base b
  LEFT JOIN LATERAL (
    SELECT
      
    CASE p_bet_type
      WHEN 'fg_spread' THEN o.fg_covered WHEN 'fg_ml' THEN o.fg_won
      WHEN 'fg_total' THEN o.ou_result  WHEN 'team_total' THEN o.tt_over
      WHEN 'h1_spread' THEN o.h1_covered WHEN 'h1_ml' THEN o.h1_won
      WHEN 'h1_total' THEN o.h1_total_over END AS o_hit,
      
    -- real-price per-row profit (decimal closing px 2021+; flat -110 fallback; ML rows w/o price excluded)
    CASE p_bet_type
      WHEN 'fg_ml' THEN CASE WHEN o.team_ml IS NOT NULL AND o.team_score IS DISTINCT FROM o.opp_score
        THEN CASE WHEN o.fg_won=1 THEN CASE WHEN o.team_ml > 0 THEN o.team_ml/100.0 ELSE 100.0/ABS(o.team_ml) END ELSE -1 END END
      WHEN 'h1_ml' THEN CASE WHEN o.h1_ml_px IS NOT NULL
        THEN CASE WHEN o.h1_won=1 THEN o.h1_ml_px - 1 ELSE -1 END END
      WHEN 'fg_spread' THEN CASE WHEN o.fg_covered=1 THEN COALESCE(o.fg_spread_px - 1, 0.909) ELSE -1 END
      WHEN 'h1_spread' THEN CASE WHEN o.h1_covered=1 THEN COALESCE(o.h1_spread_px - 1, 0.909) ELSE -1 END
      WHEN 'fg_total' THEN CASE WHEN o.ou_result=1 THEN COALESCE(o.fg_total_over_px - 1, 0.909) ELSE -1 END
      WHEN 'h1_total' THEN CASE WHEN o.h1_total_over=1 THEN COALESCE(o.h1_total_over_px - 1, 0.909) ELSE -1 END
      WHEN 'team_total' THEN CASE WHEN o.tt_over=1 THEN COALESCE(o.tt_over_px - 1, 0.909) ELSE -1 END
    END AS o_profit
    FROM cfb_analysis_base o
    -- upper(): MLB base still carries mixed-case 'Ath' duplicate rows; a case-blind
    -- inequality stops the mirror join from matching the same team's duplicate.
    WHERE o.unique_id = b.unique_id AND upper(o.team) <> upper(b.team)
    LIMIT 1
  ) opp ON p_bet_type IN ('fg_spread','fg_ml','h1_spread','h1_ml')
  WHERE 
    (p_filters->>'min_games' IS NULL OR b.team_gp_s2d >= (p_filters->>'min_games')::int)
    AND (p_filters->>'win_pct_min' IS NULL OR b.team_win_pct >= (p_filters->>'win_pct_min')::numeric)
    AND (p_filters->>'win_pct_max' IS NULL OR b.team_win_pct <= (p_filters->>'win_pct_max')::numeric)
    AND (p_filters->>'ats_win_pct_min' IS NULL OR b.team_ats_win_pct >= (p_filters->>'ats_win_pct_min')::numeric)
    AND (p_filters->>'ats_win_pct_max' IS NULL OR b.team_ats_win_pct <= (p_filters->>'ats_win_pct_max')::numeric)
    AND (p_filters->>'over_pct_min' IS NULL OR b.team_over_pct >= (p_filters->>'over_pct_min')::numeric)
    AND (p_filters->>'over_pct_max' IS NULL OR b.team_over_pct <= (p_filters->>'over_pct_max')::numeric)
    AND (p_filters->>'win_streak_min' IS NULL OR b.team_win_streak >= (p_filters->>'win_streak_min')::numeric)
    AND (p_filters->>'win_streak_max' IS NULL OR b.team_win_streak <= (p_filters->>'win_streak_max')::numeric)
    AND (p_filters->>'loss_streak_min' IS NULL OR b.team_loss_streak >= (p_filters->>'loss_streak_min')::numeric)
    AND (p_filters->>'loss_streak_max' IS NULL OR b.team_loss_streak <= (p_filters->>'loss_streak_max')::numeric)
    AND (p_filters->>'ats_win_streak_min' IS NULL OR b.team_ats_win_streak >= (p_filters->>'ats_win_streak_min')::numeric)
    AND (p_filters->>'ats_win_streak_max' IS NULL OR b.team_ats_win_streak <= (p_filters->>'ats_win_streak_max')::numeric)
    AND (p_filters->>'over_streak_min' IS NULL OR b.team_over_streak >= (p_filters->>'over_streak_min')::numeric)
    AND (p_filters->>'over_streak_max' IS NULL OR b.team_over_streak <= (p_filters->>'over_streak_max')::numeric)
    AND (p_filters->>'under_streak_min' IS NULL OR b.team_under_streak >= (p_filters->>'under_streak_min')::numeric)
    AND (p_filters->>'under_streak_max' IS NULL OR b.team_under_streak <= (p_filters->>'under_streak_max')::numeric)
    AND (p_filters->>'avg_cover_margin_min' IS NULL OR b.team_avg_cover_margin >= (p_filters->>'avg_cover_margin_min')::numeric)
    AND (p_filters->>'avg_cover_margin_max' IS NULL OR b.team_avg_cover_margin <= (p_filters->>'avg_cover_margin_max')::numeric)
    AND (p_filters->>'ppg_min' IS NULL OR b.team_ppg >= (p_filters->>'ppg_min')::numeric)
    AND (p_filters->>'ppg_max' IS NULL OR b.team_ppg <= (p_filters->>'ppg_max')::numeric)
    AND (p_filters->>'pa_pg_min' IS NULL OR b.team_pa_pg >= (p_filters->>'pa_pg_min')::numeric)
    AND (p_filters->>'pa_pg_max' IS NULL OR b.team_pa_pg <= (p_filters->>'pa_pg_max')::numeric)
    AND (p_filters->>'point_diff_pg_min' IS NULL OR b.team_point_diff_pg >= (p_filters->>'point_diff_pg_min')::numeric)
    AND (p_filters->>'point_diff_pg_max' IS NULL OR b.team_point_diff_pg <= (p_filters->>'point_diff_pg_max')::numeric)
    AND (p_filters->>'prev_wins_min' IS NULL OR b.team_prev_wins >= (p_filters->>'prev_wins_min')::numeric)
    AND (p_filters->>'prev_wins_max' IS NULL OR b.team_prev_wins <= (p_filters->>'prev_wins_max')::numeric)
    AND (p_filters->>'prev_win_pct_min' IS NULL OR b.team_prev_win_pct >= (p_filters->>'prev_win_pct_min')::numeric)
    AND (p_filters->>'prev_win_pct_max' IS NULL OR b.team_prev_win_pct <= (p_filters->>'prev_win_pct_max')::numeric)
    AND (p_filters->>'opp_win_pct_min' IS NULL OR b.opp_win_pct >= (p_filters->>'opp_win_pct_min')::numeric)
    AND (p_filters->>'opp_win_pct_max' IS NULL OR b.opp_win_pct <= (p_filters->>'opp_win_pct_max')::numeric)
    AND (p_filters->>'opp_ats_win_pct_min' IS NULL OR b.opp_ats_win_pct >= (p_filters->>'opp_ats_win_pct_min')::numeric)
    AND (p_filters->>'opp_ats_win_pct_max' IS NULL OR b.opp_ats_win_pct <= (p_filters->>'opp_ats_win_pct_max')::numeric)
    AND (p_filters->>'opp_over_pct_min' IS NULL OR b.opp_over_pct >= (p_filters->>'opp_over_pct_min')::numeric)
    AND (p_filters->>'opp_over_pct_max' IS NULL OR b.opp_over_pct <= (p_filters->>'opp_over_pct_max')::numeric)
    AND (p_filters->>'opp_win_streak_min' IS NULL OR b.opp_win_streak >= (p_filters->>'opp_win_streak_min')::numeric)
    AND (p_filters->>'opp_win_streak_max' IS NULL OR b.opp_win_streak <= (p_filters->>'opp_win_streak_max')::numeric)
    AND (p_filters->>'opp_prev_win_pct_min' IS NULL OR b.opp_prev_win_pct >= (p_filters->>'opp_prev_win_pct_min')::numeric)
    AND (p_filters->>'opp_prev_win_pct_max' IS NULL OR b.opp_prev_win_pct <= (p_filters->>'opp_prev_win_pct_max')::numeric)
    AND (p_filters->>'made_playoffs_prev' IS NULL OR b.team_made_playoffs_prev = (p_filters->>'made_playoffs_prev')::boolean)
    AND (p_filters->>'opp_made_playoffs_prev' IS NULL OR b.opp_made_playoffs_prev = (p_filters->>'opp_made_playoffs_prev')::boolean)
    AND (p_filters->>'h2h_last_home' IS NULL OR b.h2h_last_home = (p_filters->>'h2h_last_home')::boolean)
    AND (p_filters->>'h2h_last_fav' IS NULL OR b.h2h_last_fav = (p_filters->>'h2h_last_fav')::boolean)
    AND (p_filters->>'h2h_same_season' IS NULL OR b.h2h_same_season = (p_filters->>'h2h_same_season')::boolean)
    AND (p_filters->>'h2h_last_win' IS NULL OR b.h2h_last_win = (p_filters->>'h2h_last_win')::int)
    AND (p_filters->>'h2h_last_ats_win' IS NULL OR b.h2h_last_ats_win = (p_filters->>'h2h_last_ats_win')::int)
    AND (p_filters->>'h2h_last_over' IS NULL OR b.h2h_last_over = (p_filters->>'h2h_last_over')::int)
    AND (p_filters->>'above_500' IS NULL OR (b.team_win_pct > 0.5) = (p_filters->>'above_500')::boolean)
    AND (p_filters->>'win_pct_gt_opp' IS NULL OR (b.team_win_pct > b.opp_win_pct) = (p_filters->>'win_pct_gt_opp')::boolean)
    AND (p_filters->>'more_wins_than_opp_prev' IS NULL OR (b.team_prev_wins > b.opp_prev_wins) = (p_filters->>'more_wins_than_opp_prev')::boolean)
    AND (p_filters->>'h2h_spread_lower' IS NULL OR (b.h2h_last_spread < b.fg_spread) = (p_filters->>'h2h_spread_lower')::boolean)
    AND (p_filters->>'h2h_spread_higher' IS NULL OR (b.h2h_last_spread > b.fg_spread) = (p_filters->>'h2h_spread_higher')::boolean)
    AND (p_filters->>'last_margin_min' IS NULL OR b.last_margin >= (p_filters->>'last_margin_min')::int)
    AND (p_filters->>'last_margin_max' IS NULL OR b.last_margin <= (p_filters->>'last_margin_max')::int)
    AND (p_filters->>'opp_last_margin_min' IS NULL OR b.opp_last_margin >= (p_filters->>'opp_last_margin_min')::int)
    AND (p_filters->>'opp_last_margin_max' IS NULL OR b.opp_last_margin <= (p_filters->>'opp_last_margin_max')::int)
    AND (p_filters->>'opp_last_won' IS NULL OR b.opp_last_fg_won = (p_filters->>'opp_last_won')::int)
    AND (p_filters->>'opp_last_covered' IS NULL OR b.opp_last_fg_covered = (p_filters->>'opp_last_covered')::int)
    AND (p_filters->>'opp_last_over' IS NULL OR b.opp_last_ou_result = (p_filters->>'opp_last_over')::int)
    AND (p_filters->>'opp_last_favorite' IS NULL OR b.opp_last_is_favorite = (p_filters->>'opp_last_favorite')::boolean)
    AND (p_filters->>'opp_last_overtime' IS NULL OR b.opp_last_overtime = (p_filters->>'opp_last_overtime')::boolean)
    AND (p_filters->'day_of_week' IS NULL OR b.day_of_week IN (SELECT jsonb_array_elements_text(p_filters->'day_of_week')))
    AND (p_filters->>'opp_loss_streak_min' IS NULL OR b.opp_loss_streak >= (p_filters->>'opp_loss_streak_min')::numeric)
    AND (p_filters->>'opp_loss_streak_max' IS NULL OR b.opp_loss_streak <= (p_filters->>'opp_loss_streak_max')::numeric)
    AND (p_filters->>'opp_ppg_min' IS NULL OR b.opp_ppg >= (p_filters->>'opp_ppg_min')::numeric)
    AND (p_filters->>'opp_ppg_max' IS NULL OR b.opp_ppg <= (p_filters->>'opp_ppg_max')::numeric)
    AND (p_filters->>'opp_pa_pg_min' IS NULL OR b.opp_pa_pg >= (p_filters->>'opp_pa_pg_min')::numeric)
    AND (p_filters->>'opp_pa_pg_max' IS NULL OR b.opp_pa_pg <= (p_filters->>'opp_pa_pg_max')::numeric)
    AND (p_filters->>'rest_min' IS NULL OR b.rest_days >= (p_filters->>'rest_min')::numeric)
    AND (p_filters->>'rest_max' IS NULL OR b.rest_days <= (p_filters->>'rest_max')::numeric)
    AND (p_filters->>'pre_bye' IS NULL OR b.pre_bye = (p_filters->>'pre_bye')::boolean)
    AND (p_filters->>'season_min' IS NULL OR b.season >= (p_filters->>'season_min')::int)
    AND (p_filters->>'season_max' IS NULL OR b.season <= (p_filters->>'season_max')::int)
    AND (p_filters->>'week_min' IS NULL OR b.week >= (p_filters->>'week_min')::int)
    AND (p_filters->>'week_max' IS NULL OR b.week <= (p_filters->>'week_max')::int)
    AND (p_filters->>'ml_min' IS NULL OR b.team_ml >= (p_filters->>'ml_min')::numeric)
    AND (p_filters->>'ml_max' IS NULL OR b.team_ml <= (p_filters->>'ml_max')::numeric)
    AND (p_filters->>'h1_ml_min' IS NULL OR b.h1_ml_px >= (CASE WHEN abs((p_filters->>'h1_ml_min')::numeric) >= 100
      THEN CASE WHEN (p_filters->>'h1_ml_min')::numeric < 0
        THEN 1 + 100 / abs((p_filters->>'h1_ml_min')::numeric)
        ELSE 1 + (p_filters->>'h1_ml_min')::numeric / 100 END
      ELSE (p_filters->>'h1_ml_min')::numeric END))
    AND (p_filters->>'h1_ml_max' IS NULL OR b.h1_ml_px <= (CASE WHEN abs((p_filters->>'h1_ml_max')::numeric) >= 100
      THEN CASE WHEN (p_filters->>'h1_ml_max')::numeric < 0
        THEN 1 + 100 / abs((p_filters->>'h1_ml_max')::numeric)
        ELSE 1 + (p_filters->>'h1_ml_max')::numeric / 100 END
      ELSE (p_filters->>'h1_ml_max')::numeric END))
    AND (p_filters->>'wind_min' IS NULL OR b.wind_speed >= (p_filters->>'wind_min')::numeric)
    AND (p_filters->>'opp_ml_min' IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.team_ml >= (p_filters->>'opp_ml_min')::numeric))
    AND (p_filters->>'opp_ml_max' IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.team_ml <= (p_filters->>'opp_ml_max')::numeric))
    AND (p_filters->>'opp_tt_min' IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.tt_line >= (p_filters->>'opp_tt_min')::numeric))
    AND (p_filters->>'opp_tt_max' IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.tt_line <= (p_filters->>'opp_tt_max')::numeric))
    AND (p_filters->>'ranked_matchup' IS NULL
         OR ((p_filters->>'ranked_matchup')='both' AND b.team_rank IS NOT NULL AND b.opp_rank IS NOT NULL)
         OR ((p_filters->>'ranked_matchup')='neither' AND b.team_rank IS NULL AND b.opp_rank IS NULL)
         OR ((p_filters->>'ranked_matchup')='either' AND (b.team_rank IS NOT NULL OR b.opp_rank IS NOT NULL))
         OR ((p_filters->>'ranked_matchup')='home_ranked' AND (CASE WHEN b.is_home THEN (b.team_rank IS NOT NULL AND b.opp_rank IS NULL) ELSE (b.opp_rank IS NOT NULL AND b.team_rank IS NULL) END))
         OR ((p_filters->>'ranked_matchup')='away_ranked' AND (CASE WHEN b.is_home THEN (b.opp_rank IS NOT NULL AND b.team_rank IS NULL) ELSE (b.team_rank IS NOT NULL AND b.opp_rank IS NULL) END)))
    AND (p_filters->>'side' IS NULL OR b.is_home = ((p_filters->>'side')='home'))
    AND (p_filters->>'fav_dog' IS NULL OR b.is_favorite = ((p_filters->>'fav_dog')='favorite'))
    AND (p_filters->>'spread_min' IS NULL OR b.fg_spread >= (p_filters->>'spread_min')::numeric)
    AND (p_filters->>'spread_max' IS NULL OR b.fg_spread <= (p_filters->>'spread_max')::numeric)
    AND (p_filters->>'abs_spread_min' IS NULL OR abs(b.fg_spread) >= (p_filters->>'abs_spread_min')::numeric)
    AND (p_filters->>'abs_spread_max' IS NULL OR abs(b.fg_spread) <= (p_filters->>'abs_spread_max')::numeric)
    AND (p_filters->>'total_min' IS NULL OR b.fg_total >= (p_filters->>'total_min')::numeric)
    AND (p_filters->>'total_max' IS NULL OR b.fg_total <= (p_filters->>'total_max')::numeric)
    AND (p_filters->>'tt_min' IS NULL OR b.tt_line >= (p_filters->>'tt_min')::numeric)
    AND (p_filters->>'tt_max' IS NULL OR b.tt_line <= (p_filters->>'tt_max')::numeric)
    AND (p_filters->>'h1_spread_min' IS NULL OR b.h1_spread >= (p_filters->>'h1_spread_min')::numeric)
    AND (p_filters->>'h1_spread_max' IS NULL OR b.h1_spread <= (p_filters->>'h1_spread_max')::numeric)
    AND (p_filters->>'h1_abs_spread_min' IS NULL OR abs(b.h1_spread) >= (p_filters->>'h1_abs_spread_min')::numeric)
    AND (p_filters->>'h1_abs_spread_max' IS NULL OR abs(b.h1_spread) <= (p_filters->>'h1_abs_spread_max')::numeric)
    AND (p_filters->>'h1_total_min' IS NULL OR b.h1_total >= (p_filters->>'h1_total_min')::numeric)
    AND (p_filters->>'h1_total_max' IS NULL OR b.h1_total <= (p_filters->>'h1_total_max')::numeric)
    AND (p_filters->>'conference_game' IS NULL OR b.is_conference_game = (p_filters->>'conference_game')::boolean)
    AND (p_filters->>'neutral_site' IS NULL OR b.neutral_site = (p_filters->>'neutral_site')::boolean)
    AND (p_filters->>'primetime' IS NULL OR b.is_primetime = (p_filters->>'primetime')::boolean)
    AND (p_filters->>'conference' IS NULL OR b.team_conference = (p_filters->>'conference'))
    AND (p_filters->>'game_type' IS NULL
         OR ((p_filters->>'game_type')='postseason' AND b.game_type IN ('bowl','playoff'))
         OR b.game_type = (p_filters->>'game_type'))
    AND (p_filters->>'temp_min' IS NULL OR b.temperature >= (p_filters->>'temp_min')::numeric)
    AND (p_filters->>'temp_max' IS NULL OR b.temperature <= (p_filters->>'temp_max')::numeric)
    AND (p_filters->>'wind_max' IS NULL OR b.wind_speed <= (p_filters->>'wind_max')::numeric)
    AND (p_filters->>'weather' IS NULL OR b.weather_condition = (p_filters->>'weather'))
    AND (p_filters->>'dome' IS NULL OR b.dome = (p_filters->>'dome')::boolean)
    AND (p_filters->'team' IS NULL OR b.team IN (SELECT jsonb_array_elements_text(p_filters->'team')))
    AND (p_filters->'opponent' IS NULL OR b.opponent IN (SELECT jsonb_array_elements_text(p_filters->'opponent')))
    AND (p_filters->>'last_won' IS NULL OR b.last_fg_won = (p_filters->>'last_won')::int)
    AND (p_filters->>'last_covered' IS NULL OR b.last_fg_covered = (p_filters->>'last_covered')::int)
    AND (p_filters->>'last_over' IS NULL OR b.last_ou_result = (p_filters->>'last_over')::int)
    AND (p_filters->>'last_favorite' IS NULL OR b.last_is_favorite = (p_filters->>'last_favorite')::boolean)
    AND (p_filters->>'last_overtime' IS NULL OR b.last_overtime = (p_filters->>'last_overtime')::boolean);
$function$