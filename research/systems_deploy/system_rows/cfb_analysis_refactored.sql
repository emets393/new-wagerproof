CREATE OR REPLACE FUNCTION public.cfb_analysis(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  is_ml boolean := p_bet_type IN ('fg_ml','h1_ml');
  is_game_level boolean := p_bet_type IN ('fg_total','h1_total');
  v jsonb; bars jsonb := '[]'::jsonb; cov jsonb; baseline numeric; overall jsonb;
BEGIN
  CREATE TEMP TABLE _f ON COMMIT DROP AS
  SELECT * FROM public.cfb_system_rows(p_bet_type, p_filters);
  DELETE FROM _f WHERE hit IS NULL;

  SELECT jsonb_build_object('season_min',min(season),'season_max',max(season),
    'n_bets', count(*), 'n_games', count(DISTINCT unique_id)) INTO cov FROM _f;
  SELECT jsonb_build_object('n', count(*), 'wins', count(*) FILTER (WHERE hit=1),
    'hit_pct', round(avg(hit)::numeric*100,1),
    'roi', round(avg(bet_profit)::numeric*100,1))
    INTO overall FROM _f WHERE (NOT is_game_level OR is_home);
  IF is_game_level THEN
    SELECT round(avg(CASE p_bet_type WHEN 'fg_total' THEN ou_result ELSE h1_total_over END)::numeric*100,1)
      INTO baseline FROM cfb_analysis_base WHERE is_home;
  ELSE
    SELECT round(avg(CASE p_bet_type WHEN 'fg_spread' THEN fg_covered WHEN 'fg_ml' THEN fg_won
      WHEN 'team_total' THEN tt_over WHEN 'h1_spread' THEN h1_covered ELSE h1_won END)::numeric*100,1)
      INTO baseline FROM cfb_analysis_base;
  END IF;

  IF is_game_level OR p_bet_type='team_total' THEN
    SELECT jsonb_build_array(jsonb_build_object('dimension','over_under','options', jsonb_build_array(
      (SELECT jsonb_build_object('side','over','n',count(*),'wins',count(*) FILTER (WHERE hit=1),
         'hit_pct',round(avg(hit)::numeric*100,1),'roi',round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE (NOT is_game_level OR is_home)),
      (SELECT jsonb_build_object('side','under','n',count(*),'wins',count(*) FILTER (WHERE hit=0),
         'hit_pct',round((1-avg(hit))::numeric*100,1),'roi',round(avg(under_profit)::numeric*100,1)) FROM _f WHERE (NOT is_game_level OR is_home)) )))
    INTO bars;
  ELSE
    SELECT jsonb_build_array(
      jsonb_build_object('dimension','home_away','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','home','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE is_home),
        (SELECT jsonb_build_object('side','away','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE NOT is_home) )),
      jsonb_build_object('dimension','fav_dog','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','favorite','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE is_favorite),
        (SELECT jsonb_build_object('side','underdog','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', round(avg(bet_profit)::numeric*100,1)) FROM _f WHERE NOT is_favorite) )))
    INTO bars;
  END IF;

  v := jsonb_build_object('bet_type', p_bet_type, 'coverage', cov, 'baseline_pct', baseline,
    'overall', overall, 'bars', bars,
    'by_team', COALESCE((SELECT jsonb_agg(jsonb_build_object('team',team,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team, count(*) n, round(avg(hit)::numeric*100,1) hp,
               round(avg(bet_profit)::numeric*100,1) r
             FROM _f GROUP BY team HAVING count(*)>=1) t), '[]'::jsonb),
    'by_conference', COALESCE((SELECT jsonb_agg(jsonb_build_object('conference',team_conference,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team_conference, count(*) n, round(avg(hit)::numeric*100,1) hp,
               round(avg(bet_profit)::numeric*100,1) r
             FROM _f WHERE (p_bet_type='team_total' OR is_home) AND team_conference IS NOT NULL
             GROUP BY team_conference HAVING count(*)>=1) t), '[]'::jsonb));
  DROP TABLE _f;
  RETURN v;
END;
$function$
