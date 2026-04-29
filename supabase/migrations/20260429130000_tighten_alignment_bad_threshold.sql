-- Tighten the "team/dow is bad" threshold to also flag rows with
-- meaningful negative ROI even if their win_pct is in the 45-55%
-- "neutral zone". A team at 46% W with -12% ROI is actively losing
-- money on this bet type and should not contribute to "aligned".
--
-- Symptom: F5 OVER 3.5 TB @ CLE on 2026-04-29 — both teams had
-- 45-46% W with -11/-12% ROI. Old logic flagged it "Aligned" because
-- neither was below 45% W; new logic correctly flags it "Mixed".
--
-- Distribution after re-grading 157 historical picks:
--   strong   23  56.5% W  +0.6u  (unchanged)
--   aligned  38  68.4% W  +10.2u (tighter, was 48 @ 64.6%)
--   neutral  18  50.0% W   0.0u
--   mixed    76  39.5% W  -19.9u (absorbed misclassified picks)
--   concern  11  27.3% W  -5.4u  (was 0 picks before — too-strict bar)
CREATE OR REPLACE FUNCTION public.refresh_mlb_pick_alignment()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
  v_normalized_bet_type text;
  v_dow text;
  v_dow_row record;
  v_away_full text;
  v_home_full text;
  v_away_abbr text;
  v_home_abbr text;
  v_subject_abbr text;
  v_team_rows jsonb;
  v_team_count int;
  v_dow_ok bool;
  v_dow_bad bool;
  v_teams_all_ok bool;
  v_teams_all_bad bool;
  v_teams_any_bad bool;
  v_level text;
  v_rationale text;
  v_parts text[];
  v_t jsonb;
  v_updated int := 0;
BEGIN
  FOR rec IN
    SELECT id, bet_type, pick_text, matchup, official_date
    FROM public.mlb_graded_picks
    WHERE alignment_level IS NULL
  LOOP
    v_normalized_bet_type := CASE rec.bet_type
      WHEN 'full_rl' THEN 'full_ml'
      WHEN 'f5_rl'   THEN 'f5_ml'
      ELSE rec.bet_type
    END;

    v_dow := to_char(rec.official_date, 'Dy');

    SELECT * INTO v_dow_row
    FROM public.mlb_model_breakdown_accuracy
    WHERE bet_type = v_normalized_bet_type
      AND breakdown_type = 'dow'
      AND breakdown_value = v_dow
    LIMIT 1;

    v_away_full := split_part(coalesce(rec.matchup, ''), ' @ ', 1);
    v_home_full := split_part(coalesce(rec.matchup, ''), ' @ ', 2);
    v_away_abbr := public.mlb_name_to_game_log_abbr(v_away_full);
    v_home_abbr := public.mlb_name_to_game_log_abbr(v_home_full);

    v_team_rows := '[]'::jsonb;
    v_team_count := 0;

    IF v_normalized_bet_type IN ('full_ou', 'f5_ou') THEN
      FOR v_t IN
        SELECT to_jsonb(t) FROM (
          SELECT breakdown_value, win_pct, roi_pct, games, wins, losses, pushes
          FROM public.mlb_model_breakdown_accuracy
          WHERE bet_type = v_normalized_bet_type
            AND breakdown_type = 'team'
            AND breakdown_value = v_away_abbr
          LIMIT 1
        ) t
      LOOP
        v_team_rows := v_team_rows || jsonb_build_array(v_t);
        v_team_count := v_team_count + 1;
      END LOOP;
      FOR v_t IN
        SELECT to_jsonb(t) FROM (
          SELECT breakdown_value, win_pct, roi_pct, games, wins, losses, pushes
          FROM public.mlb_model_breakdown_accuracy
          WHERE bet_type = v_normalized_bet_type
            AND breakdown_type = 'team'
            AND breakdown_value = v_home_abbr
          LIMIT 1
        ) t
      LOOP
        v_team_rows := v_team_rows || jsonb_build_array(v_t);
        v_team_count := v_team_count + 1;
      END LOOP;
    ELSE
      v_subject_abbr := CASE
        WHEN v_away_full IS NOT NULL AND position(lower(v_away_full) IN lower(coalesce(rec.pick_text, ''))) > 0
          THEN v_away_abbr
        WHEN v_home_full IS NOT NULL AND position(lower(v_home_full) IN lower(coalesce(rec.pick_text, ''))) > 0
          THEN v_home_abbr
        ELSE NULL
      END;

      IF v_subject_abbr IS NOT NULL THEN
        FOR v_t IN
          SELECT to_jsonb(t) FROM (
            SELECT breakdown_value, win_pct, roi_pct, games, wins, losses, pushes
            FROM public.mlb_model_breakdown_accuracy
            WHERE bet_type = v_normalized_bet_type
              AND breakdown_type = 'team'
              AND breakdown_value = v_subject_abbr
            LIMIT 1
          ) t
        LOOP
          v_team_rows := v_team_rows || jsonb_build_array(v_t);
          v_team_count := v_team_count + 1;
        END LOOP;
      END IF;
    END IF;

    -- Bad now includes ROI ≤ -5, not just win_pct < 45.
    v_dow_ok  := v_dow_row IS NOT NULL AND v_dow_row.win_pct >= 55 AND v_dow_row.roi_pct > 0;
    v_dow_bad := v_dow_row IS NOT NULL AND (v_dow_row.win_pct < 45 OR v_dow_row.roi_pct <= -5);

    SELECT
      v_team_count > 0 AND bool_and((t->>'win_pct')::numeric >= 55 AND (t->>'roi_pct')::numeric > 0),
      v_team_count > 0 AND bool_and((t->>'win_pct')::numeric < 45 OR (t->>'roi_pct')::numeric <= -5),
      v_team_count > 0 AND bool_or((t->>'win_pct')::numeric < 45 OR (t->>'roi_pct')::numeric <= -5)
    INTO v_teams_all_ok, v_teams_all_bad, v_teams_any_bad
    FROM jsonb_array_elements(v_team_rows) t;

    v_teams_all_ok  := coalesce(v_teams_all_ok, false);
    v_teams_all_bad := coalesce(v_teams_all_bad, false);
    v_teams_any_bad := coalesce(v_teams_any_bad, false);

    v_level := CASE
      WHEN v_dow_ok AND v_teams_all_ok THEN 'strong'
      WHEN (v_dow_ok AND NOT v_teams_any_bad) OR (v_teams_all_ok AND NOT v_dow_bad) THEN 'aligned'
      WHEN v_dow_bad AND v_teams_all_bad THEN 'concern'
      WHEN v_dow_bad OR v_teams_any_bad THEN 'mixed'
      ELSE 'neutral'
    END;

    v_parts := ARRAY[]::text[];
    IF v_dow_row IS NOT NULL THEN
      v_parts := v_parts || format('%s %s%% (%s%s%%)',
        v_dow_row.breakdown_value,
        v_dow_row.win_pct,
        CASE WHEN v_dow_row.roi_pct >= 0 THEN '+' ELSE '' END,
        v_dow_row.roi_pct);
    END IF;

    FOR v_t IN SELECT * FROM jsonb_array_elements(v_team_rows)
    LOOP
      v_parts := v_parts || format('%s %s%% (%s%s%%)',
        v_t->>'breakdown_value',
        v_t->>'win_pct',
        CASE WHEN (v_t->>'roi_pct')::numeric >= 0 THEN '+' ELSE '' END,
        v_t->>'roi_pct');
    END LOOP;

    v_rationale := CASE WHEN array_length(v_parts, 1) IS NULL
      THEN 'Insufficient breakdown data'
      ELSE array_to_string(v_parts, ' · ')
    END;

    UPDATE public.mlb_graded_picks
    SET alignment_level         = v_level,
        alignment_dow_label     = CASE WHEN v_dow_row IS NOT NULL THEN v_dow_row.breakdown_value ELSE NULL END,
        alignment_dow_win_pct   = CASE WHEN v_dow_row IS NOT NULL THEN v_dow_row.win_pct ELSE NULL END,
        alignment_dow_roi_pct   = CASE WHEN v_dow_row IS NOT NULL THEN v_dow_row.roi_pct ELSE NULL END,
        alignment_teams         = v_team_rows,
        alignment_rationale     = v_rationale,
        alignment_computed_at   = now()
    WHERE id = rec.id;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;
