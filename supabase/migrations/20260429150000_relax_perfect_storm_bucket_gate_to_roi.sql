-- Replace the bucket gate from "win_pct > 52.4" with "roi_pct > 0".
-- ROI accounts for actual odds (a 60% win rate on +110 dogs ≠ 60% on
-- -150 favs) and is what we ultimately care about. Also drops the
-- legacy "perfect_storm" bucket label from any consideration — the
-- bucket lookup uses the actual edge bucket the pick falls into.
CREATE OR REPLACE FUNCTION public.refresh_mlb_perfect_storm_tier()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
  v_normalized_bet_type text;
  v_passes_odds bool;
  v_dow_ok bool;
  v_teams_all_ok bool;
  v_bucket_ok bool;
  v_dow_label text;
  v_dow_roi numeric;
  v_team_count int;
  v_team_pos_count int;
  v_bucket_roi numeric;
  v_away_full text;
  v_home_full text;
  v_away_abbr text;
  v_home_abbr text;
  v_subject_abbr text;
  v_subject_full text;
  v_pick_lower text;
  v_pick_direction text;
  v_pitcher_match bool;
  v_batting_match bool;
  v_bullpen_match bool;
  v_match_count int;
  v_report record;
  v_tier text;
  v_updated int := 0;
BEGIN
  FOR rec IN
    SELECT id, bet_type, pick_text, matchup, official_date,
           edge_bucket, line_at_suggestion
    FROM public.mlb_graded_picks
  LOOP
    v_tier := 'none';
    v_pick_lower := lower(coalesce(rec.pick_text, ''));

    v_normalized_bet_type := CASE rec.bet_type
      WHEN 'full_rl' THEN 'full_ml'
      WHEN 'f5_rl'   THEN 'f5_ml'
      ELSE rec.bet_type
    END;

    v_away_full := split_part(coalesce(rec.matchup, ''), ' @ ', 1);
    v_home_full := split_part(coalesce(rec.matchup, ''), ' @ ', 2);
    v_away_abbr := public.mlb_name_to_game_log_abbr(v_away_full);
    v_home_abbr := public.mlb_name_to_game_log_abbr(v_home_full);

    IF v_normalized_bet_type IN ('full_ou','f5_ou') THEN
      IF v_pick_lower LIKE '%over%' THEN
        v_pick_direction := 'OVER';
      ELSIF v_pick_lower LIKE '%under%' THEN
        v_pick_direction := 'UNDER';
      ELSE
        v_pick_direction := NULL;
      END IF;
      v_subject_abbr := NULL;
      v_subject_full := NULL;
    ELSE
      v_pick_direction := NULL;
      IF v_away_full <> '' AND position(lower(v_away_full) IN v_pick_lower) > 0 THEN
        v_subject_abbr := v_away_abbr;
        v_subject_full := v_away_full;
      ELSIF v_home_full <> '' AND position(lower(v_home_full) IN v_pick_lower) > 0 THEN
        v_subject_abbr := v_home_abbr;
        v_subject_full := v_home_full;
      ELSE
        v_subject_abbr := NULL;
        v_subject_full := NULL;
      END IF;
    END IF;

    IF v_normalized_bet_type IN ('full_ml','f5_ml','full_rl','f5_rl') THEN
      v_passes_odds := rec.line_at_suggestion IS NOT NULL
                       AND rec.line_at_suggestion > -150;
    ELSE
      v_passes_odds := TRUE;
    END IF;

    SELECT breakdown_value, roi_pct
      INTO v_dow_label, v_dow_roi
    FROM public.mlb_model_breakdown_accuracy
    WHERE bet_type = v_normalized_bet_type
      AND breakdown_type = 'dow'
      AND breakdown_value = to_char(rec.official_date, 'Dy')
    LIMIT 1;
    v_dow_ok := v_dow_roi IS NOT NULL AND v_dow_roi > 0;

    v_team_count := 0;
    v_team_pos_count := 0;
    IF v_normalized_bet_type IN ('full_ou','f5_ou') THEN
      FOR v_dow_roi IN
        SELECT roi_pct FROM public.mlb_model_breakdown_accuracy
        WHERE bet_type = v_normalized_bet_type
          AND breakdown_type = 'team'
          AND breakdown_value IN (v_away_abbr, v_home_abbr)
      LOOP
        v_team_count := v_team_count + 1;
        IF v_dow_roi > 0 THEN v_team_pos_count := v_team_pos_count + 1; END IF;
      END LOOP;
      v_teams_all_ok := v_team_count = 2 AND v_team_pos_count = 2;
    ELSE
      IF v_subject_abbr IS NOT NULL THEN
        SELECT roi_pct INTO v_dow_roi
        FROM public.mlb_model_breakdown_accuracy
        WHERE bet_type = v_normalized_bet_type
          AND breakdown_type = 'team'
          AND breakdown_value = v_subject_abbr
        LIMIT 1;
        v_teams_all_ok := v_dow_roi IS NOT NULL AND v_dow_roi > 0;
      ELSE
        v_teams_all_ok := FALSE;
      END IF;
    END IF;

    -- Bucket gate: ROI > 0 (replaces the older win_pct > 52.4 bar).
    SELECT 100.0 * SUM(units_won) / NULLIF(SUM(wins+losses), 0)::numeric
      INTO v_bucket_roi
    FROM public.mlb_model_bucket_accuracy
    WHERE bet_type = v_normalized_bet_type
      AND bucket   = coalesce(rec.edge_bucket, '');
    v_bucket_ok := v_bucket_roi IS NOT NULL AND v_bucket_roi > 0;

    IF v_passes_odds AND v_dow_ok AND v_teams_all_ok AND v_bucket_ok THEN
      v_tier := 'ps';

      SELECT pitcher_negative_regression, pitcher_positive_regression,
             batting_heat_up, batting_cool_down, bullpen_fatigue
        INTO v_report
      FROM public.mlb_regression_report
      WHERE report_date = rec.official_date;

      IF FOUND THEN
        v_pitcher_match := FALSE;
        v_batting_match := FALSE;
        v_bullpen_match := FALSE;

        IF v_pick_direction = 'OVER' THEN
          v_pitcher_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.pitcher_negative_regression) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
          );
          v_batting_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.batting_heat_up) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
          );
          v_bullpen_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.bullpen_fatigue) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
          );
        ELSIF v_pick_direction = 'UNDER' THEN
          v_pitcher_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.pitcher_positive_regression) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
          );
          v_batting_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.batting_cool_down) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
          );
          v_bullpen_match := FALSE;
        ELSIF v_subject_full IS NOT NULL THEN
          v_pitcher_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.pitcher_positive_regression) e
            WHERE e->>'team_name' = v_subject_full
          ) OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.pitcher_negative_regression) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
              AND e->>'team_name' <> v_subject_full
          );
          v_batting_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.batting_heat_up) e
            WHERE e->>'team_name' = v_subject_full
          ) OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.batting_cool_down) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
              AND e->>'team_name' <> v_subject_full
          );
          v_bullpen_match := EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_report.bullpen_fatigue) e
            WHERE e->>'team_name' IN (v_away_full, v_home_full)
              AND e->>'team_name' <> v_subject_full
          );
        END IF;

        v_match_count := (v_pitcher_match::int + v_batting_match::int + v_bullpen_match::int);
        IF v_match_count >= 2 THEN
          v_tier := 'psh';
        END IF;
      END IF;
    END IF;

    UPDATE public.mlb_graded_picks
    SET perfect_storm_tier = v_tier,
        perfect_storm_tier_computed_at = now()
    WHERE id = rec.id;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;
