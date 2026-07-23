CREATE OR REPLACE FUNCTION public.cfb_system_rows(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb, p_include_opp boolean DEFAULT true)
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
  CROSS JOIN LATERAL (SELECT p_filters->>'above_500' AS "above_500_t",
    p_filters->>'abs_spread_max' AS "abs_spread_max_t",
    p_filters->>'abs_spread_min' AS "abs_spread_min_t",
    p_filters->>'ats_win_pct_max' AS "ats_win_pct_max_t",
    p_filters->>'ats_win_pct_min' AS "ats_win_pct_min_t",
    p_filters->>'ats_win_streak_max' AS "ats_win_streak_max_t",
    p_filters->>'ats_win_streak_min' AS "ats_win_streak_min_t",
    p_filters->>'avg_cover_margin_max' AS "avg_cover_margin_max_t",
    p_filters->>'avg_cover_margin_min' AS "avg_cover_margin_min_t",
    p_filters->>'conference' AS "conference_t",
    p_filters->>'conference_game' AS "conference_game_t",
    p_filters->>'dome' AS "dome_t",
    p_filters->>'fav_dog' AS "fav_dog_t",
    p_filters->>'game_type' AS "game_type_t",
    p_filters->>'h1_abs_spread_max' AS "h1_abs_spread_max_t",
    p_filters->>'h1_abs_spread_min' AS "h1_abs_spread_min_t",
    p_filters->>'h1_ml_max' AS "h1_ml_max_t",
    p_filters->>'h1_ml_min' AS "h1_ml_min_t",
    p_filters->>'h1_spread_max' AS "h1_spread_max_t",
    p_filters->>'h1_spread_min' AS "h1_spread_min_t",
    p_filters->>'h1_total_max' AS "h1_total_max_t",
    p_filters->>'h1_total_min' AS "h1_total_min_t",
    p_filters->>'h2h_last_ats_win' AS "h2h_last_ats_win_t",
    p_filters->>'h2h_last_fav' AS "h2h_last_fav_t",
    p_filters->>'h2h_last_home' AS "h2h_last_home_t",
    p_filters->>'h2h_last_over' AS "h2h_last_over_t",
    p_filters->>'h2h_last_win' AS "h2h_last_win_t",
    p_filters->>'h2h_same_season' AS "h2h_same_season_t",
    p_filters->>'h2h_spread_higher' AS "h2h_spread_higher_t",
    p_filters->>'h2h_spread_lower' AS "h2h_spread_lower_t",
    p_filters->>'last_covered' AS "last_covered_t",
    p_filters->>'last_favorite' AS "last_favorite_t",
    p_filters->>'last_margin_max' AS "last_margin_max_t",
    p_filters->>'last_margin_min' AS "last_margin_min_t",
    p_filters->>'last_over' AS "last_over_t",
    p_filters->>'last_overtime' AS "last_overtime_t",
    p_filters->>'last_won' AS "last_won_t",
    p_filters->>'loss_streak_max' AS "loss_streak_max_t",
    p_filters->>'loss_streak_min' AS "loss_streak_min_t",
    p_filters->>'made_playoffs_prev' AS "made_playoffs_prev_t",
    p_filters->>'min_games' AS "min_games_t",
    p_filters->>'ml_max' AS "ml_max_t",
    p_filters->>'ml_min' AS "ml_min_t",
    p_filters->>'more_wins_than_opp_prev' AS "more_wins_than_opp_prev_t",
    p_filters->>'neutral_site' AS "neutral_site_t",
    p_filters->>'opp_ats_win_pct_max' AS "opp_ats_win_pct_max_t",
    p_filters->>'opp_ats_win_pct_min' AS "opp_ats_win_pct_min_t",
    p_filters->>'opp_last_covered' AS "opp_last_covered_t",
    p_filters->>'opp_last_favorite' AS "opp_last_favorite_t",
    p_filters->>'opp_last_margin_max' AS "opp_last_margin_max_t",
    p_filters->>'opp_last_margin_min' AS "opp_last_margin_min_t",
    p_filters->>'opp_last_over' AS "opp_last_over_t",
    p_filters->>'opp_last_overtime' AS "opp_last_overtime_t",
    p_filters->>'opp_last_won' AS "opp_last_won_t",
    p_filters->>'opp_loss_streak_max' AS "opp_loss_streak_max_t",
    p_filters->>'opp_loss_streak_min' AS "opp_loss_streak_min_t",
    p_filters->>'opp_made_playoffs_prev' AS "opp_made_playoffs_prev_t",
    p_filters->>'opp_ml_max' AS "opp_ml_max_t",
    p_filters->>'opp_ml_min' AS "opp_ml_min_t",
    p_filters->>'opp_over_pct_max' AS "opp_over_pct_max_t",
    p_filters->>'opp_over_pct_min' AS "opp_over_pct_min_t",
    p_filters->>'opp_pa_pg_max' AS "opp_pa_pg_max_t",
    p_filters->>'opp_pa_pg_min' AS "opp_pa_pg_min_t",
    p_filters->>'opp_ppg_max' AS "opp_ppg_max_t",
    p_filters->>'opp_ppg_min' AS "opp_ppg_min_t",
    p_filters->>'opp_prev_win_pct_max' AS "opp_prev_win_pct_max_t",
    p_filters->>'opp_prev_win_pct_min' AS "opp_prev_win_pct_min_t",
    p_filters->>'opp_tt_max' AS "opp_tt_max_t",
    p_filters->>'opp_tt_min' AS "opp_tt_min_t",
    p_filters->>'opp_win_pct_max' AS "opp_win_pct_max_t",
    p_filters->>'opp_win_pct_min' AS "opp_win_pct_min_t",
    p_filters->>'opp_win_streak_max' AS "opp_win_streak_max_t",
    p_filters->>'opp_win_streak_min' AS "opp_win_streak_min_t",
    p_filters->>'over_pct_max' AS "over_pct_max_t",
    p_filters->>'over_pct_min' AS "over_pct_min_t",
    p_filters->>'over_streak_max' AS "over_streak_max_t",
    p_filters->>'over_streak_min' AS "over_streak_min_t",
    p_filters->>'pa_pg_max' AS "pa_pg_max_t",
    p_filters->>'pa_pg_min' AS "pa_pg_min_t",
    p_filters->>'point_diff_pg_max' AS "point_diff_pg_max_t",
    p_filters->>'point_diff_pg_min' AS "point_diff_pg_min_t",
    p_filters->>'ppg_max' AS "ppg_max_t",
    p_filters->>'ppg_min' AS "ppg_min_t",
    p_filters->>'pre_bye' AS "pre_bye_t",
    p_filters->>'prev_win_pct_max' AS "prev_win_pct_max_t",
    p_filters->>'prev_win_pct_min' AS "prev_win_pct_min_t",
    p_filters->>'prev_wins_max' AS "prev_wins_max_t",
    p_filters->>'prev_wins_min' AS "prev_wins_min_t",
    p_filters->>'primetime' AS "primetime_t",
    p_filters->>'ranked_matchup' AS "ranked_matchup_t",
    p_filters->>'rest_max' AS "rest_max_t",
    p_filters->>'rest_min' AS "rest_min_t",
    p_filters->>'season_max' AS "season_max_t",
    p_filters->>'season_min' AS "season_min_t",
    p_filters->>'side' AS "side_t",
    p_filters->>'spread_max' AS "spread_max_t",
    p_filters->>'spread_min' AS "spread_min_t",
    p_filters->>'temp_max' AS "temp_max_t",
    p_filters->>'temp_min' AS "temp_min_t",
    p_filters->>'total_max' AS "total_max_t",
    p_filters->>'total_min' AS "total_min_t",
    p_filters->>'tt_max' AS "tt_max_t",
    p_filters->>'tt_min' AS "tt_min_t",
    p_filters->>'under_streak_max' AS "under_streak_max_t",
    p_filters->>'under_streak_min' AS "under_streak_min_t",
    p_filters->>'weather' AS "weather_t",
    p_filters->>'week_max' AS "week_max_t",
    p_filters->>'week_min' AS "week_min_t",
    p_filters->>'win_pct_gt_opp' AS "win_pct_gt_opp_t",
    p_filters->>'win_pct_max' AS "win_pct_max_t",
    p_filters->>'win_pct_min' AS "win_pct_min_t",
    p_filters->>'win_streak_max' AS "win_streak_max_t",
    p_filters->>'win_streak_min' AS "win_streak_min_t",
    p_filters->>'wind_max' AS "wind_max_t",
    p_filters->>'wind_min' AS "wind_min_t",
    p_filters->'day_of_week' AS "day_of_week_j",
    p_filters->'opponent' AS "opponent_j",
    p_filters->'team' AS "team_j" OFFSET 0) f
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
    -- upper(): case-blind so a mixed-case duplicate row can never self-match.
    -- ORDER BY: deterministic mirror if a >2-row game ever appears.
    WHERE p_include_opp AND p_bet_type IN ('fg_spread','fg_ml','h1_spread','h1_ml')
      AND o.unique_id = b.unique_id AND upper(o.team) <> upper(b.team)
    ORDER BY o.team
    LIMIT 1
  ) opp ON true
  WHERE 
    (f."min_games_t" IS NULL OR b.team_gp_s2d >= (f."min_games_t")::int)
    AND (f."win_pct_min_t" IS NULL OR b.team_win_pct >= (f."win_pct_min_t")::numeric)
    AND (f."win_pct_max_t" IS NULL OR b.team_win_pct <= (f."win_pct_max_t")::numeric)
    AND (f."ats_win_pct_min_t" IS NULL OR b.team_ats_win_pct >= (f."ats_win_pct_min_t")::numeric)
    AND (f."ats_win_pct_max_t" IS NULL OR b.team_ats_win_pct <= (f."ats_win_pct_max_t")::numeric)
    AND (f."over_pct_min_t" IS NULL OR b.team_over_pct >= (f."over_pct_min_t")::numeric)
    AND (f."over_pct_max_t" IS NULL OR b.team_over_pct <= (f."over_pct_max_t")::numeric)
    AND (f."win_streak_min_t" IS NULL OR b.team_win_streak >= (f."win_streak_min_t")::numeric)
    AND (f."win_streak_max_t" IS NULL OR b.team_win_streak <= (f."win_streak_max_t")::numeric)
    AND (f."loss_streak_min_t" IS NULL OR b.team_loss_streak >= (f."loss_streak_min_t")::numeric)
    AND (f."loss_streak_max_t" IS NULL OR b.team_loss_streak <= (f."loss_streak_max_t")::numeric)
    AND (f."ats_win_streak_min_t" IS NULL OR b.team_ats_win_streak >= (f."ats_win_streak_min_t")::numeric)
    AND (f."ats_win_streak_max_t" IS NULL OR b.team_ats_win_streak <= (f."ats_win_streak_max_t")::numeric)
    AND (f."over_streak_min_t" IS NULL OR b.team_over_streak >= (f."over_streak_min_t")::numeric)
    AND (f."over_streak_max_t" IS NULL OR b.team_over_streak <= (f."over_streak_max_t")::numeric)
    AND (f."under_streak_min_t" IS NULL OR b.team_under_streak >= (f."under_streak_min_t")::numeric)
    AND (f."under_streak_max_t" IS NULL OR b.team_under_streak <= (f."under_streak_max_t")::numeric)
    AND (f."avg_cover_margin_min_t" IS NULL OR b.team_avg_cover_margin >= (f."avg_cover_margin_min_t")::numeric)
    AND (f."avg_cover_margin_max_t" IS NULL OR b.team_avg_cover_margin <= (f."avg_cover_margin_max_t")::numeric)
    AND (f."ppg_min_t" IS NULL OR b.team_ppg >= (f."ppg_min_t")::numeric)
    AND (f."ppg_max_t" IS NULL OR b.team_ppg <= (f."ppg_max_t")::numeric)
    AND (f."pa_pg_min_t" IS NULL OR b.team_pa_pg >= (f."pa_pg_min_t")::numeric)
    AND (f."pa_pg_max_t" IS NULL OR b.team_pa_pg <= (f."pa_pg_max_t")::numeric)
    AND (f."point_diff_pg_min_t" IS NULL OR b.team_point_diff_pg >= (f."point_diff_pg_min_t")::numeric)
    AND (f."point_diff_pg_max_t" IS NULL OR b.team_point_diff_pg <= (f."point_diff_pg_max_t")::numeric)
    AND (f."prev_wins_min_t" IS NULL OR b.team_prev_wins >= (f."prev_wins_min_t")::numeric)
    AND (f."prev_wins_max_t" IS NULL OR b.team_prev_wins <= (f."prev_wins_max_t")::numeric)
    AND (f."prev_win_pct_min_t" IS NULL OR b.team_prev_win_pct >= (f."prev_win_pct_min_t")::numeric)
    AND (f."prev_win_pct_max_t" IS NULL OR b.team_prev_win_pct <= (f."prev_win_pct_max_t")::numeric)
    AND (f."opp_win_pct_min_t" IS NULL OR b.opp_win_pct >= (f."opp_win_pct_min_t")::numeric)
    AND (f."opp_win_pct_max_t" IS NULL OR b.opp_win_pct <= (f."opp_win_pct_max_t")::numeric)
    AND (f."opp_ats_win_pct_min_t" IS NULL OR b.opp_ats_win_pct >= (f."opp_ats_win_pct_min_t")::numeric)
    AND (f."opp_ats_win_pct_max_t" IS NULL OR b.opp_ats_win_pct <= (f."opp_ats_win_pct_max_t")::numeric)
    AND (f."opp_over_pct_min_t" IS NULL OR b.opp_over_pct >= (f."opp_over_pct_min_t")::numeric)
    AND (f."opp_over_pct_max_t" IS NULL OR b.opp_over_pct <= (f."opp_over_pct_max_t")::numeric)
    AND (f."opp_win_streak_min_t" IS NULL OR b.opp_win_streak >= (f."opp_win_streak_min_t")::numeric)
    AND (f."opp_win_streak_max_t" IS NULL OR b.opp_win_streak <= (f."opp_win_streak_max_t")::numeric)
    AND (f."opp_prev_win_pct_min_t" IS NULL OR b.opp_prev_win_pct >= (f."opp_prev_win_pct_min_t")::numeric)
    AND (f."opp_prev_win_pct_max_t" IS NULL OR b.opp_prev_win_pct <= (f."opp_prev_win_pct_max_t")::numeric)
    AND (f."made_playoffs_prev_t" IS NULL OR b.team_made_playoffs_prev = (f."made_playoffs_prev_t")::boolean)
    AND (f."opp_made_playoffs_prev_t" IS NULL OR b.opp_made_playoffs_prev = (f."opp_made_playoffs_prev_t")::boolean)
    AND (f."h2h_last_home_t" IS NULL OR b.h2h_last_home = (f."h2h_last_home_t")::boolean)
    AND (f."h2h_last_fav_t" IS NULL OR b.h2h_last_fav = (f."h2h_last_fav_t")::boolean)
    AND (f."h2h_same_season_t" IS NULL OR b.h2h_same_season = (f."h2h_same_season_t")::boolean)
    AND (f."h2h_last_win_t" IS NULL OR b.h2h_last_win = (f."h2h_last_win_t")::int)
    AND (f."h2h_last_ats_win_t" IS NULL OR b.h2h_last_ats_win = (f."h2h_last_ats_win_t")::int)
    AND (f."h2h_last_over_t" IS NULL OR b.h2h_last_over = (f."h2h_last_over_t")::int)
    AND (f."above_500_t" IS NULL OR (b.team_win_pct > 0.5) = (f."above_500_t")::boolean)
    AND (f."win_pct_gt_opp_t" IS NULL OR (b.team_win_pct > b.opp_win_pct) = (f."win_pct_gt_opp_t")::boolean)
    AND (f."more_wins_than_opp_prev_t" IS NULL OR (b.team_prev_wins > b.opp_prev_wins) = (f."more_wins_than_opp_prev_t")::boolean)
    AND (f."h2h_spread_lower_t" IS NULL OR (b.h2h_last_spread < b.fg_spread) = (f."h2h_spread_lower_t")::boolean)
    AND (f."h2h_spread_higher_t" IS NULL OR (b.h2h_last_spread > b.fg_spread) = (f."h2h_spread_higher_t")::boolean)
    AND (f."last_margin_min_t" IS NULL OR b.last_margin >= (f."last_margin_min_t")::int)
    AND (f."last_margin_max_t" IS NULL OR b.last_margin <= (f."last_margin_max_t")::int)
    AND (f."opp_last_margin_min_t" IS NULL OR b.opp_last_margin >= (f."opp_last_margin_min_t")::int)
    AND (f."opp_last_margin_max_t" IS NULL OR b.opp_last_margin <= (f."opp_last_margin_max_t")::int)
    AND (f."opp_last_won_t" IS NULL OR b.opp_last_fg_won = (f."opp_last_won_t")::int)
    AND (f."opp_last_covered_t" IS NULL OR b.opp_last_fg_covered = (f."opp_last_covered_t")::int)
    AND (f."opp_last_over_t" IS NULL OR b.opp_last_ou_result = (f."opp_last_over_t")::int)
    AND (f."opp_last_favorite_t" IS NULL OR b.opp_last_is_favorite = (f."opp_last_favorite_t")::boolean)
    AND (f."opp_last_overtime_t" IS NULL OR b.opp_last_overtime = (f."opp_last_overtime_t")::boolean)
    AND (f."day_of_week_j" IS NULL OR b.day_of_week IN (SELECT jsonb_array_elements_text(f."day_of_week_j")))
    AND (f."opp_loss_streak_min_t" IS NULL OR b.opp_loss_streak >= (f."opp_loss_streak_min_t")::numeric)
    AND (f."opp_loss_streak_max_t" IS NULL OR b.opp_loss_streak <= (f."opp_loss_streak_max_t")::numeric)
    AND (f."opp_ppg_min_t" IS NULL OR b.opp_ppg >= (f."opp_ppg_min_t")::numeric)
    AND (f."opp_ppg_max_t" IS NULL OR b.opp_ppg <= (f."opp_ppg_max_t")::numeric)
    AND (f."opp_pa_pg_min_t" IS NULL OR b.opp_pa_pg >= (f."opp_pa_pg_min_t")::numeric)
    AND (f."opp_pa_pg_max_t" IS NULL OR b.opp_pa_pg <= (f."opp_pa_pg_max_t")::numeric)
    AND (f."rest_min_t" IS NULL OR b.rest_days >= (f."rest_min_t")::numeric)
    AND (f."rest_max_t" IS NULL OR b.rest_days <= (f."rest_max_t")::numeric)
    AND (f."pre_bye_t" IS NULL OR b.pre_bye = (f."pre_bye_t")::boolean)
    AND (f."season_min_t" IS NULL OR b.season >= (f."season_min_t")::int)
    AND (f."season_max_t" IS NULL OR b.season <= (f."season_max_t")::int)
    AND (f."week_min_t" IS NULL OR b.week >= (f."week_min_t")::int)
    AND (f."week_max_t" IS NULL OR b.week <= (f."week_max_t")::int)
    AND (f."ml_min_t" IS NULL OR b.team_ml >= (f."ml_min_t")::numeric)
    AND (f."ml_max_t" IS NULL OR b.team_ml <= (f."ml_max_t")::numeric)
    AND (f."h1_ml_min_t" IS NULL OR b.h1_ml_px >= (CASE WHEN abs((f."h1_ml_min_t")::numeric) >= 100
      THEN CASE WHEN (f."h1_ml_min_t")::numeric < 0
        THEN 1 + 100 / abs((f."h1_ml_min_t")::numeric)
        ELSE 1 + (f."h1_ml_min_t")::numeric / 100 END
      ELSE (f."h1_ml_min_t")::numeric END))
    AND (f."h1_ml_max_t" IS NULL OR b.h1_ml_px <= (CASE WHEN abs((f."h1_ml_max_t")::numeric) >= 100
      THEN CASE WHEN (f."h1_ml_max_t")::numeric < 0
        THEN 1 + 100 / abs((f."h1_ml_max_t")::numeric)
        ELSE 1 + (f."h1_ml_max_t")::numeric / 100 END
      ELSE (f."h1_ml_max_t")::numeric END))
    AND (f."wind_min_t" IS NULL OR b.wind_speed >= (f."wind_min_t")::numeric)
    AND (f."opp_ml_min_t" IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.team_ml >= (f."opp_ml_min_t")::numeric))
    AND (f."opp_ml_max_t" IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.team_ml <= (f."opp_ml_max_t")::numeric))
    AND (f."opp_tt_min_t" IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.tt_line >= (f."opp_tt_min_t")::numeric))
    AND (f."opp_tt_max_t" IS NULL OR EXISTS (
         SELECT 1 FROM cfb_analysis_base o
         WHERE o.unique_id = b.unique_id AND o.team <> b.team
           AND o.tt_line <= (f."opp_tt_max_t")::numeric))
    AND (f."ranked_matchup_t" IS NULL
         OR ((f."ranked_matchup_t")='both' AND b.team_rank IS NOT NULL AND b.opp_rank IS NOT NULL)
         OR ((f."ranked_matchup_t")='neither' AND b.team_rank IS NULL AND b.opp_rank IS NULL)
         OR ((f."ranked_matchup_t")='either' AND (b.team_rank IS NOT NULL OR b.opp_rank IS NOT NULL))
         OR ((f."ranked_matchup_t")='home_ranked' AND (CASE WHEN b.is_home THEN (b.team_rank IS NOT NULL AND b.opp_rank IS NULL) ELSE (b.opp_rank IS NOT NULL AND b.team_rank IS NULL) END))
         OR ((f."ranked_matchup_t")='away_ranked' AND (CASE WHEN b.is_home THEN (b.opp_rank IS NOT NULL AND b.team_rank IS NULL) ELSE (b.team_rank IS NOT NULL AND b.opp_rank IS NULL) END)))
    AND (f."side_t" IS NULL OR b.is_home = ((f."side_t")='home'))
    AND (f."fav_dog_t" IS NULL OR b.is_favorite = ((f."fav_dog_t")='favorite'))
    AND (f."spread_min_t" IS NULL OR b.fg_spread >= (f."spread_min_t")::numeric)
    AND (f."spread_max_t" IS NULL OR b.fg_spread <= (f."spread_max_t")::numeric)
    AND (f."abs_spread_min_t" IS NULL OR abs(b.fg_spread) >= (f."abs_spread_min_t")::numeric)
    AND (f."abs_spread_max_t" IS NULL OR abs(b.fg_spread) <= (f."abs_spread_max_t")::numeric)
    AND (f."total_min_t" IS NULL OR b.fg_total >= (f."total_min_t")::numeric)
    AND (f."total_max_t" IS NULL OR b.fg_total <= (f."total_max_t")::numeric)
    AND (f."tt_min_t" IS NULL OR b.tt_line >= (f."tt_min_t")::numeric)
    AND (f."tt_max_t" IS NULL OR b.tt_line <= (f."tt_max_t")::numeric)
    AND (f."h1_spread_min_t" IS NULL OR b.h1_spread >= (f."h1_spread_min_t")::numeric)
    AND (f."h1_spread_max_t" IS NULL OR b.h1_spread <= (f."h1_spread_max_t")::numeric)
    AND (f."h1_abs_spread_min_t" IS NULL OR abs(b.h1_spread) >= (f."h1_abs_spread_min_t")::numeric)
    AND (f."h1_abs_spread_max_t" IS NULL OR abs(b.h1_spread) <= (f."h1_abs_spread_max_t")::numeric)
    AND (f."h1_total_min_t" IS NULL OR b.h1_total >= (f."h1_total_min_t")::numeric)
    AND (f."h1_total_max_t" IS NULL OR b.h1_total <= (f."h1_total_max_t")::numeric)
    AND (f."conference_game_t" IS NULL OR b.is_conference_game = (f."conference_game_t")::boolean)
    AND (f."neutral_site_t" IS NULL OR b.neutral_site = (f."neutral_site_t")::boolean)
    AND (f."primetime_t" IS NULL OR b.is_primetime = (f."primetime_t")::boolean)
    AND (f."conference_t" IS NULL OR b.team_conference = (f."conference_t"))
    AND (f."game_type_t" IS NULL
         OR ((f."game_type_t")='postseason' AND b.game_type IN ('bowl','playoff'))
         OR b.game_type = (f."game_type_t"))
    AND (f."temp_min_t" IS NULL OR b.temperature >= (f."temp_min_t")::numeric)
    AND (f."temp_max_t" IS NULL OR b.temperature <= (f."temp_max_t")::numeric)
    AND (f."wind_max_t" IS NULL OR b.wind_speed <= (f."wind_max_t")::numeric)
    AND (f."weather_t" IS NULL OR b.weather_condition = (f."weather_t"))
    AND (f."dome_t" IS NULL OR b.dome = (f."dome_t")::boolean)
    AND (f."team_j" IS NULL OR b.team IN (SELECT jsonb_array_elements_text(f."team_j")))
    AND (f."opponent_j" IS NULL OR b.opponent IN (SELECT jsonb_array_elements_text(f."opponent_j")))
    AND (f."last_won_t" IS NULL OR b.last_fg_won = (f."last_won_t")::int)
    AND (f."last_covered_t" IS NULL OR b.last_fg_covered = (f."last_covered_t")::int)
    AND (f."last_over_t" IS NULL OR b.last_ou_result = (f."last_over_t")::int)
    AND (f."last_favorite_t" IS NULL OR b.last_is_favorite = (f."last_favorite_t")::boolean)
    AND (f."last_overtime_t" IS NULL OR b.last_overtime = (f."last_overtime_t")::boolean);
$function$