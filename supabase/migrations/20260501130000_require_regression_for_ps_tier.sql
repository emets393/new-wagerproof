-- Tighten the `ps` (Perfect Storm) tier so it actually requires a
-- regression backing — otherwise the label is just "data alignment"
-- and gets noisy (today's report had 6 of 8 picks tagged `ps` with
-- zero pitcher / batting / bullpen regression match).
--
-- New tier ladder:
--   acc=3  reg>=2  -> hammer    (unchanged)
--   acc=3  reg>=1  -> ps        (was: acc=3 alone — now requires reg>=1)
--   acc=2  reg>=2  -> lean      (unchanged)
--   anything else -> watch      (acc=3/reg=0 falls here, was `ps`)
--
-- The Python regression-report builder in
-- scripts/mlb/mlb_daily_regression_report.py was updated to match.
-- They MUST stay in sync — the Python tags fresh suggested picks
-- before they're written, and this RPC re-tags every graded pick
-- nightly. If they diverge, today's report and the historical
-- mlb_graded_picks tier column will tell different stories.

CREATE OR REPLACE FUNCTION public.refresh_mlb_perfect_storm_tier()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  rec record;
  v_norm_bt text;
  v_is_f5 bool;
  v_pick_lower text;
  v_pick_dir text;          -- 'OVER'|'UNDER'|NULL
  v_subj_full text;
  v_away_full text;
  v_home_full text;
  v_away_abbr text;
  v_home_abbr text;
  v_subject_abbr text;
  v_dow_label text;
  v_dow_roi numeric;
  v_team_count int;
  v_team_pos_count int;
  v_subj_roi numeric;
  v_bucket_roi numeric;
  v_acc_score int;          -- 0-3 hard signals positive
  v_reg_score int;          -- weighted: pitcher×2 + batting×1 + bullpen×1 (full only)
  v_pitcher_match bool;
  v_batting_match bool;
  v_bullpen_match bool;
  v_passes_odds bool;
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

    v_norm_bt := CASE rec.bet_type
      WHEN 'full_rl' THEN 'full_ml'
      WHEN 'f5_rl'   THEN 'f5_ml'
      ELSE rec.bet_type
    END;
    v_is_f5 := v_norm_bt IN ('f5_ml', 'f5_ou');

    v_away_full := split_part(coalesce(rec.matchup, ''), ' @ ', 1);
    v_home_full := split_part(coalesce(rec.matchup, ''), ' @ ', 2);
    v_away_abbr := public.mlb_name_to_game_log_abbr(v_away_full);
    v_home_abbr := public.mlb_name_to_game_log_abbr(v_home_full);

    -- Pick direction / subject team
    IF v_norm_bt IN ('full_ou','f5_ou') THEN
      v_pick_dir := CASE
        WHEN v_pick_lower LIKE '%over%'  THEN 'OVER'
        WHEN v_pick_lower LIKE '%under%' THEN 'UNDER'
        ELSE NULL
      END;
      v_subject_abbr := NULL;
      v_subj_full := NULL;
    ELSE
      v_pick_dir := NULL;
      IF v_away_full <> '' AND position(lower(v_away_full) IN v_pick_lower) > 0 THEN
        v_subject_abbr := v_away_abbr;
        v_subj_full := v_away_full;
      ELSIF v_home_full <> '' AND position(lower(v_home_full) IN v_pick_lower) > 0 THEN
        v_subject_abbr := v_home_abbr;
        v_subj_full := v_home_full;
      ELSE
        v_subject_abbr := NULL;
        v_subj_full := NULL;
      END IF;
    END IF;

    -- ── Pre-condition: odds gate (ML/RL only). Ineligible picks → none. ──
    IF v_norm_bt IN ('full_ml','f5_ml') THEN
      v_passes_odds := rec.line_at_suggestion IS NOT NULL
                       AND rec.line_at_suggestion > -150;
    ELSE
      v_passes_odds := TRUE;
    END IF;

    IF NOT v_passes_odds THEN
      UPDATE public.mlb_graded_picks
      SET perfect_storm_tier = 'none',
          perfect_storm_tier_computed_at = now()
      WHERE id = rec.id;
      v_updated := v_updated + 1;
      CONTINUE;
    END IF;

    -- ── Count accuracy sources with positive ROI ──
    v_acc_score := 0;

    -- (1) DOW
    SELECT roi_pct INTO v_dow_roi
    FROM public.mlb_model_breakdown_accuracy
    WHERE bet_type = v_norm_bt
      AND breakdown_type = 'dow'
      AND breakdown_value = to_char(rec.official_date, 'Dy')
    LIMIT 1;
    IF v_dow_roi IS NOT NULL AND v_dow_roi > 0 THEN
      v_acc_score := v_acc_score + 1;
    END IF;

    -- (2) Team(s)
    IF v_norm_bt IN ('full_ou','f5_ou') THEN
      v_team_count := 0;
      v_team_pos_count := 0;
      FOR v_subj_roi IN
        SELECT roi_pct FROM public.mlb_model_breakdown_accuracy
        WHERE bet_type = v_norm_bt
          AND breakdown_type = 'team'
          AND breakdown_value IN (v_away_abbr, v_home_abbr)
      LOOP
        v_team_count := v_team_count + 1;
        IF v_subj_roi > 0 THEN v_team_pos_count := v_team_pos_count + 1; END IF;
      END LOOP;
      IF v_team_count = 2 AND v_team_pos_count = 2 THEN
        v_acc_score := v_acc_score + 1;
      END IF;
    ELSIF v_subject_abbr IS NOT NULL THEN
      SELECT roi_pct INTO v_subj_roi
      FROM public.mlb_model_breakdown_accuracy
      WHERE bet_type = v_norm_bt
        AND breakdown_type = 'team'
        AND breakdown_value = v_subject_abbr
      LIMIT 1;
      IF v_subj_roi IS NOT NULL AND v_subj_roi > 0 THEN
        v_acc_score := v_acc_score + 1;
      END IF;
    END IF;

    -- (3) Edge bucket
    SELECT 100.0 * SUM(units_won) / NULLIF(SUM(wins+losses), 0)::numeric
      INTO v_bucket_roi
    FROM public.mlb_model_bucket_accuracy
    WHERE bet_type = v_norm_bt
      AND bucket   = coalesce(rec.edge_bucket, '');
    IF v_bucket_roi IS NOT NULL AND v_bucket_roi > 0 THEN
      v_acc_score := v_acc_score + 1;
    END IF;

    -- ── If accuracy floor not met, drop the pick. ──
    IF v_acc_score < 2 THEN
      UPDATE public.mlb_graded_picks
      SET perfect_storm_tier = 'none',
          perfect_storm_tier_computed_at = now()
      WHERE id = rec.id;
      v_updated := v_updated + 1;
      CONTINUE;
    END IF;

    -- ── Compute regression score. ──
    -- pitcher × 2, batting × 1, bullpen × 1 (full game only).
    v_pitcher_match := FALSE;
    v_batting_match := FALSE;
    v_bullpen_match := FALSE;

    SELECT pitcher_negative_regression, pitcher_positive_regression,
           batting_heat_up, batting_cool_down, bullpen_fatigue
      INTO v_report
    FROM public.mlb_regression_report
    WHERE report_date = rec.official_date;

    IF FOUND THEN
      IF v_pick_dir = 'OVER' THEN
        v_pitcher_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.pitcher_negative_regression) e WHERE e->>'team_name' IN (v_away_full, v_home_full));
        v_batting_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.batting_heat_up)             e WHERE e->>'team_name' IN (v_away_full, v_home_full));
        v_bullpen_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.bullpen_fatigue)             e WHERE e->>'team_name' IN (v_away_full, v_home_full));
      ELSIF v_pick_dir = 'UNDER' THEN
        v_pitcher_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.pitcher_positive_regression) e WHERE e->>'team_name' IN (v_away_full, v_home_full));
        v_batting_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.batting_cool_down)            e WHERE e->>'team_name' IN (v_away_full, v_home_full));
        v_bullpen_match := FALSE;  -- bullpen fatigue points OVER, never UNDER
      ELSIF v_subj_full IS NOT NULL THEN
        v_pitcher_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.pitcher_positive_regression) e WHERE e->>'team_name' = v_subj_full)
                       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.pitcher_negative_regression) e WHERE e->>'team_name' IN (v_away_full, v_home_full) AND e->>'team_name' <> v_subj_full);
        v_batting_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.batting_heat_up)             e WHERE e->>'team_name' = v_subj_full)
                       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.batting_cool_down)             e WHERE e->>'team_name' IN (v_away_full, v_home_full) AND e->>'team_name' <> v_subj_full);
        v_bullpen_match := EXISTS (SELECT 1 FROM jsonb_array_elements(v_report.bullpen_fatigue)             e WHERE e->>'team_name' IN (v_away_full, v_home_full) AND e->>'team_name' <> v_subj_full);
      END IF;
    END IF;

    v_reg_score := (v_pitcher_match::int * 2) + (v_batting_match::int);
    IF NOT v_is_f5 THEN
      v_reg_score := v_reg_score + (v_bullpen_match::int);
    END IF;

    -- ── Tier assignment ──
    -- Both `hammer` and `ps` now require at least one regression match.
    -- Without that backing, the pick is just data alignment and falls
    -- to `watch` — keeps the "Perfect Storm" label honest.
    IF v_acc_score = 3 AND v_reg_score >= 2 THEN
      v_tier := 'hammer';
    ELSIF v_acc_score = 3 AND v_reg_score >= 1 THEN
      v_tier := 'ps';
    ELSIF v_acc_score = 2 AND v_reg_score >= 2 THEN
      v_tier := 'lean';
    ELSE  -- acc=3/reg=0 (data only) or acc=2/reg<2
      v_tier := 'watch';
    END IF;

    UPDATE public.mlb_graded_picks
    SET perfect_storm_tier = v_tier,
        perfect_storm_tier_computed_at = now()
    WHERE id = rec.id;
    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$function$;

-- Re-tag every existing graded pick with the new tier rules so the
-- season-to-date W-L-P + ROI numbers in the report's "Model Performance
-- Update" section reflect the tightened definition.
SELECT public.refresh_mlb_perfect_storm_tier();
