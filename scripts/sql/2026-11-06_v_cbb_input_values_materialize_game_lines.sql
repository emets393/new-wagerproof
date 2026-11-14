-- 2026-11-06: v_cbb_input_values -- game_lines CTE made MATERIALIZED.
-- The planner estimated base_games at 29 rows (actual 5,708) and recomputed the betting-lines sub-query once per game:
-- 4.5s for the opening 10-day board window, over the anon role's 3s statement_timeout, so the iOS/Android college feed
-- got a 500 ('Failed to load games') while the website's lighter column list squeaked under at 3.1s. Now ~130ms.
-- Applied live via the management API; this file is the record. Rollback = same statement without MATERIALIZED.
CREATE OR REPLACE VIEW public.v_cbb_input_values AS
WITH svc AS (
         SELECT
                CASE
                    WHEN (now() AT TIME ZONE 'America/New_York'::text)::time without time zone >= '04:00:00'::time without time zone THEN (now() AT TIME ZONE 'America/New_York'::text)::date
                    ELSE ((now() AT TIME ZONE 'America/New_York'::text)::date - '1 day'::interval)::date
                END AS svc_day,
            (now() AT TIME ZONE 'America/New_York'::text) AS now_et
        ), current_season AS (
         SELECT max(COALESCE(sch.season, EXTRACT(year FROM sch.game_date_et)::integer)) AS season
           FROM cbb_game_schedule sch
        ), ratings_mapped AS (
         SELECT m.api_team_id AS team_id,
            r.predictive,
            r.luck,
            r.home,
            r.away
           FROM ncaab_ratings r
             JOIN ncaab_team_mapping m ON lower(btrim(m.teamranking_team_name)) = lower(btrim(r.team_name))
        ), base_games AS (
         SELECT sch.game_id,
            COALESCE(sch.season, EXTRACT(year FROM sch.game_date_et)::integer) AS season,
            COALESCE(sch.season_type, 'regular'::text) AS season_type,
            ((sch.game_date_et::timestamp without time zone + sch.tipoff_time_et::time without time zone::interval) AT TIME ZONE 'America/New_York'::text) AS start_utc,
            sch.game_date_et::timestamp without time zone + sch.tipoff_time_et::time without time zone::interval AS start_et_local,
            sch.home_team_id,
            sch.home_team,
            sch.away_team_id,
            sch.away_team,
            sch.game_date_et,
            sch.tipoff_time_et,
            sch.conference_game,
            sch.neutral_site,
            sch.home_seed,
            sch.away_seed,
            sch.tournament,
            sch.game_type,
            sch.broadcasts,
            sch.time_tbd,
            sch.home_conference,
            sch.away_conference
           FROM cbb_game_schedule sch
             CROSS JOIN svc s
             CROSS JOIN current_season cs
          WHERE COALESCE(sch.season, EXTRACT(year FROM sch.game_date_et)::integer) = cs.season AND sch.game_date_et >= s.svc_day
        ), team_odds_ids AS (
         SELECT m.api_team_id,
            m.odds_api_participant_id
           FROM ncaab_team_mapping m
        ), lines_pref AS (
         SELECT l.game_id,
            l.team_side,
            l.odds_api_participant_id,
            l.run_ts_utc,
            l.bookmaker_key,
            l.bookmaker_last_update,
            l.inserted_at_utc,
            l.moneyline,
            l.h1_moneyline,
            l.h1_spread,
            l.h1_total,
            l.team_total,
            NULLIF(btrim(l.spread::text), ''::text)::numeric AS spread_num,
            NULLIF(btrim(l.total::text), ''::text)::numeric AS total_num
           FROM cbb_team_lines_history l
          WHERE (l.bookmaker_key = ANY (ARRAY['draftkings'::text, 'fanduel'::text, 'fanatics'::text])) AND (l.game_id IN ( SELECT base_games.game_id
                   FROM base_games))
        ), book_rank AS (
         SELECT l.game_id,
            l.team_side,
            l.odds_api_participant_id,
            l.run_ts_utc,
            l.bookmaker_key,
            l.bookmaker_last_update,
            l.inserted_at_utc,
            l.moneyline,
            l.h1_moneyline,
            l.h1_spread,
            l.h1_total,
            l.team_total,
            l.spread_num,
            l.total_num,
                CASE l.bookmaker_key
                    WHEN 'draftkings'::text THEN 1
                    WHEN 'fanduel'::text THEN 2
                    WHEN 'fanatics'::text THEN 3
                    ELSE 99
                END AS pref
           FROM lines_pref l
        ), best_lines_st AS (
         SELECT x.game_id,
            x.team_side,
            x.odds_api_participant_id,
            x.run_ts_utc,
            x.bookmaker_key,
            x.bookmaker_last_update,
            x.inserted_at_utc,
            x.moneyline,
            x.h1_moneyline,
            x.h1_spread,
            x.h1_total,
            x.team_total,
            x.spread_num,
            x.total_num,
            x.pref,
            x.rn
           FROM ( SELECT b.game_id,
                    b.team_side,
                    b.odds_api_participant_id,
                    b.run_ts_utc,
                    b.bookmaker_key,
                    b.bookmaker_last_update,
                    b.inserted_at_utc,
                    b.moneyline,
                    b.h1_moneyline,
                    b.h1_spread,
                    b.h1_total,
                    b.team_total,
                    b.spread_num,
                    b.total_num,
                    b.pref,
                    row_number() OVER (PARTITION BY b.game_id, b.odds_api_participant_id ORDER BY b.run_ts_utc DESC, (
                        CASE
                            WHEN b.spread_num IS NULL THEN 1
                            ELSE 0
                        END), (
                        CASE
                            WHEN b.total_num IS NULL THEN 1
                            ELSE 0
                        END), b.pref, b.bookmaker_last_update DESC NULLS LAST, b.inserted_at_utc DESC) AS rn
                   FROM book_rank b) x
          WHERE x.rn = 1
        ), best_lines_ml AS (
         SELECT x.game_id,
            x.team_side,
            x.odds_api_participant_id,
            x.run_ts_utc,
            x.bookmaker_key,
            x.bookmaker_last_update,
            x.inserted_at_utc,
            x.moneyline,
            x.h1_moneyline,
            x.h1_spread,
            x.h1_total,
            x.team_total,
            x.spread_num,
            x.total_num,
            x.pref,
            x.rn
           FROM ( SELECT b.game_id,
                    b.team_side,
                    b.odds_api_participant_id,
                    b.run_ts_utc,
                    b.bookmaker_key,
                    b.bookmaker_last_update,
                    b.inserted_at_utc,
                    b.moneyline,
                    b.h1_moneyline,
                    b.h1_spread,
                    b.h1_total,
                    b.team_total,
                    b.spread_num,
                    b.total_num,
                    b.pref,
                    row_number() OVER (PARTITION BY b.game_id, b.odds_api_participant_id ORDER BY b.run_ts_utc DESC, (
                        CASE
                            WHEN b.moneyline IS NULL THEN 1
                            ELSE 0
                        END), b.pref, b.bookmaker_last_update DESC NULLS LAST, b.inserted_at_utc DESC) AS rn
                   FROM book_rank b) x
          WHERE x.rn = 1
        ), best_lines_h1 AS (
         SELECT x.game_id,
            x.team_side,
            x.odds_api_participant_id,
            x.run_ts_utc,
            x.bookmaker_key,
            x.bookmaker_last_update,
            x.inserted_at_utc,
            x.moneyline,
            x.h1_moneyline,
            x.h1_spread,
            x.h1_total,
            x.team_total,
            x.spread_num,
            x.total_num,
            x.pref,
            x.rn
           FROM ( SELECT b.game_id,
                    b.team_side,
                    b.odds_api_participant_id,
                    b.run_ts_utc,
                    b.bookmaker_key,
                    b.bookmaker_last_update,
                    b.inserted_at_utc,
                    b.moneyline,
                    b.h1_moneyline,
                    b.h1_spread,
                    b.h1_total,
                    b.team_total,
                    b.spread_num,
                    b.total_num,
                    b.pref,
                    row_number() OVER (PARTITION BY b.game_id, b.odds_api_participant_id ORDER BY b.run_ts_utc DESC, b.pref, b.bookmaker_last_update DESC NULLS LAST, b.inserted_at_utc DESC) AS rn
                   FROM book_rank b
                  WHERE b.h1_spread IS NOT NULL OR b.h1_total IS NOT NULL OR b.team_total IS NOT NULL OR b.h1_moneyline IS NOT NULL) x
          WHERE x.rn = 1
        ), game_lines AS MATERIALIZED (
         SELECT g_1.game_id,
            blh_st.spread_num AS spread,
            COALESCE(blh_st.total_num, bla_st.total_num) AS over_under,
            blh_ml.moneyline AS "homeMoneyline",
            bla_ml.moneyline AS "awayMoneyline",
            blh_h1.h1_spread,
            COALESCE(blh_h1.h1_total, bla_h1.h1_total) AS h1_total,
            blh_h1.h1_moneyline AS h1_home_moneyline,
            bla_h1.h1_moneyline AS h1_away_moneyline,
            blh_h1.team_total AS home_team_total,
            bla_h1.team_total AS away_team_total,
            COALESCE(blh_h1.run_ts_utc, bla_h1.run_ts_utc) AS h1_lines_as_of
           FROM base_games g_1
             LEFT JOIN team_odds_ids mh ON mh.api_team_id = g_1.home_team_id
             LEFT JOIN team_odds_ids ma ON ma.api_team_id = g_1.away_team_id
             LEFT JOIN best_lines_st blh_st ON blh_st.game_id = g_1.game_id AND blh_st.odds_api_participant_id = mh.odds_api_participant_id
             LEFT JOIN best_lines_st bla_st ON bla_st.game_id = g_1.game_id AND bla_st.odds_api_participant_id = ma.odds_api_participant_id
             LEFT JOIN best_lines_ml blh_ml ON blh_ml.game_id = g_1.game_id AND blh_ml.odds_api_participant_id = mh.odds_api_participant_id
             LEFT JOIN best_lines_ml bla_ml ON bla_ml.game_id = g_1.game_id AND bla_ml.odds_api_participant_id = ma.odds_api_participant_id
             LEFT JOIN best_lines_h1 blh_h1 ON blh_h1.game_id = g_1.game_id AND blh_h1.odds_api_participant_id = mh.odds_api_participant_id
             LEFT JOIN best_lines_h1 bla_h1 ON bla_h1.game_id = g_1.game_id AND bla_h1.odds_api_participant_id = ma.odds_api_participant_id
        )
 SELECT g.game_id,
    g.season,
    g.season_type,
    g.start_utc,
    g.start_et_local,
    g.game_date_et,
    g.tipoff_time_et,
    g.conference_game,
    g.neutral_site,
    g.home_seed,
    g.away_seed,
    g.home_team_id,
    g.home_team,
    g.away_team_id,
    g.away_team,
    gl.spread,
    gl.over_under,
    gl."homeMoneyline",
    gl."awayMoneyline",
    pmh.adj_offense AS home_adj_offense,
    pmh.adj_defense AS home_adj_defense,
    pmh.adj_pace AS home_adj_pace,
    pmh.adj_margin AS home_adj_margin,
    pmh.adj_offense_trend_l3 AS home_adj_offense_trend_l3,
    pmh.adj_defense_trend_l3 AS home_adj_defense_trend_l3,
    pmh.adj_pace_trend_l3 AS home_adj_pace_trend_l3,
    pma.adj_offense AS away_adj_offense,
    pma.adj_defense AS away_adj_defense,
    pma.adj_pace AS away_adj_pace,
    pma.adj_margin AS away_adj_margin,
    pma.adj_offense_trend_l3 AS away_adj_offense_trend_l3,
    pma.adj_defense_trend_l3 AS away_adj_defense_trend_l3,
    pma.adj_pace_trend_l3 AS away_adj_pace_trend_l3,
    prh.ws_prev_all_z AS home_ws_prev_all_z,
    prh.ws_prev_ret_z AS home_ws_prev_ret_z,
    prh.roster_count_z AS home_roster_count_z,
    prh.experience_index AS home_experience_index,
    prh.continuity_index AS home_continuity_index,
    pra.ws_prev_all_z AS away_ws_prev_all_z,
    pra.ws_prev_ret_z AS away_ws_prev_ret_z,
    pra.roster_count_z AS away_roster_count_z,
    pra.experience_index AS away_experience_index,
    pra.continuity_index AS away_continuity_index,
    r_h.ranking AS home_ranking,
    r_a.ranking AS away_ranking,
    rmh.predictive AS home_power_rtg,
    rmh.luck AS home_luck,
    rmh.home AS at_home_rtg,
    rma.predictive AS away_power_rtg,
    rma.luck AS away_luck,
    rma.away AS at_away_rtg,
    g.tournament,
    g.game_type,
    g.broadcasts,
    g.time_tbd,
    g.home_conference,
    g.away_conference,
    gl.h1_spread,
    gl.h1_total,
    gl.h1_home_moneyline,
    gl.h1_away_moneyline,
    gl.home_team_total,
    gl.away_team_total,
    gl.h1_lines_as_of
   FROM base_games g
     LEFT JOIN game_lines gl ON gl.game_id = g.game_id
     LEFT JOIN cbb_team_pregame_metrics pmh ON pmh.team_id = g.home_team_id AND pmh.season = g.season
     LEFT JOIN cbb_team_pregame_metrics pma ON pma.team_id = g.away_team_id AND pma.season = g.season
     LEFT JOIN cbb_preseason_roster_talent prh ON prh.team_id = g.home_team_id AND prh.season = g.season
     LEFT JOIN cbb_preseason_roster_talent pra ON pra.team_id = g.away_team_id AND pra.season = g.season
     LEFT JOIN cbb_rankings_daily r_h ON r_h.team_id = g.home_team_id
     LEFT JOIN cbb_rankings_daily r_a ON r_a.team_id = g.away_team_id
     LEFT JOIN ratings_mapped rmh ON rmh.team_id = g.home_team_id
     LEFT JOIN ratings_mapped rma ON rma.team_id = g.away_team_id
  ORDER BY g.start_et_local, g.game_id;
