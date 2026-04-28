-- Snapshot of the alignment signal at the time the pick was suggested. We
-- store this on mlb_graded_picks (rather than recomputing on read) because
-- mlb_model_breakdown_accuracy drifts every night as new games grade — if
-- you look at "what was the alignment for an April 27 pick?" in July, you
-- want April's stats, not July's.
ALTER TABLE public.mlb_graded_picks
  ADD COLUMN IF NOT EXISTS alignment_level text,
  ADD COLUMN IF NOT EXISTS alignment_dow_label text,
  ADD COLUMN IF NOT EXISTS alignment_dow_win_pct numeric,
  ADD COLUMN IF NOT EXISTS alignment_dow_roi_pct numeric,
  ADD COLUMN IF NOT EXISTS alignment_teams jsonb,
  ADD COLUMN IF NOT EXISTS alignment_rationale text,
  ADD COLUMN IF NOT EXISTS alignment_computed_at timestamptz;

-- Maps full team name → game-log abbr. Mirrors the JS table in
-- src/utils/mlbPickAlignment.ts. Athletics + Diamondbacks use AZ/ATH in
-- mlb_game_log, not ARI/OAK. Periods stripped so "St. Louis" matches.
CREATE OR REPLACE FUNCTION public.mlb_name_to_game_log_abbr(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE btrim(lower(regexp_replace(coalesce(p_name, ''), '\.', '', 'g')))
    WHEN 'arizona diamondbacks'  THEN 'AZ'
    WHEN 'atlanta braves'        THEN 'ATL'
    WHEN 'baltimore orioles'     THEN 'BAL'
    WHEN 'boston red sox'        THEN 'BOS'
    WHEN 'chicago cubs'          THEN 'CHC'
    WHEN 'chicago white sox'     THEN 'CWS'
    WHEN 'cincinnati reds'       THEN 'CIN'
    WHEN 'cleveland guardians'   THEN 'CLE'
    WHEN 'colorado rockies'      THEN 'COL'
    WHEN 'detroit tigers'        THEN 'DET'
    WHEN 'houston astros'        THEN 'HOU'
    WHEN 'kansas city royals'    THEN 'KC'
    WHEN 'los angeles angels'    THEN 'LAA'
    WHEN 'los angeles dodgers'   THEN 'LAD'
    WHEN 'miami marlins'         THEN 'MIA'
    WHEN 'milwaukee brewers'     THEN 'MIL'
    WHEN 'minnesota twins'       THEN 'MIN'
    WHEN 'new york mets'         THEN 'NYM'
    WHEN 'new york yankees'      THEN 'NYY'
    WHEN 'oakland athletics'     THEN 'ATH'
    WHEN 'las vegas athletics'   THEN 'ATH'
    WHEN 'athletics'             THEN 'ATH'
    WHEN 'philadelphia phillies' THEN 'PHI'
    WHEN 'pittsburgh pirates'    THEN 'PIT'
    WHEN 'san diego padres'      THEN 'SD'
    WHEN 'san francisco giants'  THEN 'SF'
    WHEN 'seattle mariners'      THEN 'SEA'
    WHEN 'st louis cardinals'    THEN 'STL'
    WHEN 'tampa bay rays'        THEN 'TB'
    WHEN 'texas rangers'         THEN 'TEX'
    WHEN 'toronto blue jays'     THEN 'TOR'
    WHEN 'washington nationals'  THEN 'WSH'
    ELSE NULL
  END;
$$;

-- Compute alignment level for a single pick using the CURRENT
-- mlb_model_breakdown_accuracy snapshot. We snapshot the result onto
-- mlb_graded_picks so historical rows preserve the stats they were
-- evaluated against, not whatever drifts in months later.
--
-- Mirrors the scoring thresholds in src/utils/mlbPickAlignment.ts:
--   strong  — DOW pass (≥55% & +ROI) AND every team passes
--   aligned — DOW or all teams pass, no team is bad (<45%)
--   concern — DOW bad AND all teams bad
--   mixed   — DOW or any team is bad
--   neutral — anything else / not enough data
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
    -- RL alignment piggybacks on ML breakdowns (same subject team logic)
    -- since the breakdown table only tracks 4 bet types.
    v_normalized_bet_type := CASE rec.bet_type
      WHEN 'full_rl' THEN 'full_ml'
      WHEN 'f5_rl'   THEN 'f5_ml'
      ELSE rec.bet_type
    END;

    v_dow := to_char(rec.official_date, 'Dy'); -- Mon..Sun

    SELECT * INTO v_dow_row
    FROM public.mlb_model_breakdown_accuracy
    WHERE bet_type = v_normalized_bet_type
      AND breakdown_type = 'dow'
      AND breakdown_value = v_dow
    LIMIT 1;

    -- Parse "Away Full @ Home Full"
    v_away_full := split_part(coalesce(rec.matchup, ''), ' @ ', 1);
    v_home_full := split_part(coalesce(rec.matchup, ''), ' @ ', 2);
    v_away_abbr := public.mlb_name_to_game_log_abbr(v_away_full);
    v_home_abbr := public.mlb_name_to_game_log_abbr(v_home_full);

    -- Subject teams: O/U credits both, ML/RL just the team named in pick_text.
    v_team_rows := '[]'::jsonb;
    v_team_count := 0;

    IF v_normalized_bet_type IN ('full_ou', 'f5_ou') THEN
      -- Away first to match "Away @ Home" reading order.
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
      -- ML/RL: team is whichever full name appears in pick_text.
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

    v_dow_ok  := v_dow_row IS NOT NULL AND v_dow_row.win_pct >= 55 AND v_dow_row.roi_pct > 0;
    v_dow_bad := v_dow_row IS NOT NULL AND v_dow_row.win_pct < 45;

    SELECT
      v_team_count > 0 AND bool_and((t->>'win_pct')::numeric >= 55 AND (t->>'roi_pct')::numeric > 0),
      v_team_count > 0 AND bool_and((t->>'win_pct')::numeric < 45),
      v_team_count > 0 AND bool_or((t->>'win_pct')::numeric < 45)
    INTO v_teams_all_ok, v_teams_all_bad, v_teams_any_bad
    FROM jsonb_array_elements(v_team_rows) t;

    -- bool_and over an empty set returns null; coalesce so we don't trip the
    -- mixed/concern branches when the team data is simply missing.
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

-- Schedule it 10 minutes after the breakdown refresh (10:05 ET) so we use
-- the freshest stats. The function only touches rows where
-- alignment_level IS NULL, so it's idempotent and cheap to run daily.
SELECT cron.schedule(
  'refresh_mlb_pick_alignment_daily',
  '15 10 * * *',
  $cron$ SELECT public.refresh_mlb_pick_alignment(); $cron$
);
