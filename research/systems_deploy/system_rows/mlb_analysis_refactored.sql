CREATE OR REPLACE FUNCTION public.mlb_analysis(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  is_ml_real boolean := p_bet_type = 'ml';
  is_ml_nodds boolean := p_bet_type = 'f5_ml';
  is_game_level boolean := p_bet_type IN ('total','f5_total');
  v jsonb; bars jsonb; cov jsonb; baseline numeric; overall jsonb;
BEGIN
  CREATE TEMP TABLE _f ON COMMIT DROP AS
  SELECT * FROM public.mlb_system_rows(p_bet_type, p_filters);
  DELETE FROM _f WHERE hit IS NULL;
  -- Game-level bet types: keep_game marks ONE row per game (home preferred,
  -- away row kept when it's the only survivor of the filters). overall / bars
  -- / coverage / by_venue read keep_game rows so each game counts once;
  -- by_team reads ALL rows so a team's line covers its full schedule.
  IF is_game_level THEN
    UPDATE _f a SET keep_game = false
    WHERE NOT a.is_home
      AND EXISTS (SELECT 1 FROM _f b WHERE b.game_pk = a.game_pk AND b.is_home);
  END IF;

  SELECT jsonb_build_object('season_min',min(season),'season_max',max(season),
    'n_bets', count(*), 'n_games', count(DISTINCT game_pk)) INTO cov FROM _f WHERE keep_game;

  SELECT jsonb_build_object('n', count(*), 'wins', count(*) FILTER (WHERE hit=1),
    'hit_pct', round(avg(hit)::numeric*100,1),
    'roi', round(avg(bet_profit)::numeric*100,1))
  INTO overall FROM _f WHERE keep_game;

  SELECT round(avg(CASE p_bet_type
      WHEN 'ml' THEN ml_won WHEN 'rl' THEN rl_covered WHEN 'total' THEN ou_over
      WHEN 'f5_ml' THEN f5_ml_won WHEN 'f5_rl' THEN f5_rl_covered ELSE f5_over
    END)::numeric*100,1)
  INTO baseline FROM mlb_analysis_base WHERE (NOT is_game_level OR is_home);

  IF is_game_level THEN
    SELECT jsonb_build_array(jsonb_build_object('dimension','over_under','options', jsonb_build_array(
      (SELECT jsonb_build_object('side','over','n',count(*),'wins',count(*) FILTER (WHERE hit=1),
         'hit_pct',round(avg(hit)::numeric*100,1),'roi',round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE keep_game),
      (SELECT jsonb_build_object('side','under','n',count(*),'wins',count(*) FILTER (WHERE hit=0),
         'hit_pct',round((1-avg(hit))::numeric*100,1),'roi',round(avg(under_profit)::numeric*100,1)) FROM _f WHERE keep_game))))
    INTO bars;
  ELSE
    SELECT jsonb_build_array(
      jsonb_build_object('dimension','home_away','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','home','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE is_home),
        (SELECT jsonb_build_object('side','away','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE NOT is_home))),
      jsonb_build_object('dimension','fav_dog','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','favorite','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE is_favorite),
        (SELECT jsonb_build_object('side','underdog','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE NOT is_favorite))))
    INTO bars;
  END IF;

  v := jsonb_build_object('bet_type', p_bet_type, 'coverage', cov, 'baseline_pct', baseline,
    'overall', overall, 'bars', bars,
    'by_team', COALESCE((SELECT jsonb_agg(jsonb_build_object('team',team_abbr,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team_abbr, count(*) n, round(avg(hit)::numeric*100,1) hp,
               round(avg(bet_profit)::numeric*100,1) r
             FROM _f GROUP BY team_abbr HAVING count(*)>=1) t), '[]'::jsonb),
    'by_venue', COALESCE((SELECT jsonb_agg(jsonb_build_object('venue',venue_name,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT venue_name, count(*) n, round(avg(hit)::numeric*100,1) hp,
               round(avg(bet_profit)::numeric*100,1) r
             FROM _f WHERE keep_game AND venue_name IS NOT NULL GROUP BY venue_name HAVING count(*)>=1) t), '[]'::jsonb));
  DROP TABLE _f;
  RETURN v;
END;
$function$
