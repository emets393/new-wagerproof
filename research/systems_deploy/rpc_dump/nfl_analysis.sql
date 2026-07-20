CREATE OR REPLACE FUNCTION public.nfl_analysis(p_bet_type text, p_filters jsonb DEFAULT '{}'::jsonb)
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
  SELECT b.*,
    CASE p_bet_type
      WHEN 'fg_spread' THEN b.fg_covered WHEN 'fg_ml' THEN b.fg_won
      WHEN 'fg_total' THEN b.ou_result  WHEN 'team_total' THEN b.tt_over
      WHEN 'h1_spread' THEN b.h1_covered WHEN 'h1_ml' THEN b.h1_won
      WHEN 'h1_total' THEN b.h1_total_over END AS hit
  FROM nfl_analysis_base b
  WHERE
    (p_filters->>'season_min' IS NULL OR b.season >= (p_filters->>'season_min')::int)
    AND (p_filters->>'season_max' IS NULL OR b.season <= (p_filters->>'season_max')::int)
    AND (p_filters->>'week_min' IS NULL OR b.week >= (p_filters->>'week_min')::int)
    AND (p_filters->>'week_max' IS NULL OR b.week <= (p_filters->>'week_max')::int)
    AND (p_filters->>'season_type' IS NULL OR b.season_type = (p_filters->>'season_type'))
    AND (p_filters->>'playoff_round' IS NULL OR b.playoff_round = (p_filters->>'playoff_round'))
    AND (p_filters->>'ml_min' IS NULL OR b.team_ml >= (p_filters->>'ml_min')::numeric)
    AND (p_filters->>'ml_max' IS NULL OR b.team_ml <= (p_filters->>'ml_max')::numeric)
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
    AND (p_filters->>'division' IS NULL OR b.is_division = (p_filters->>'division')::boolean)
    AND (p_filters->>'primetime' IS NULL OR b.is_primetime = (p_filters->>'primetime')::boolean)
    AND (p_filters->>'day_of_week' IS NULL OR b.day_of_week = (p_filters->>'day_of_week'))
    AND (p_filters->>'dome' IS NULL OR b.dome = (p_filters->>'dome')::boolean)
    AND (p_filters->>'surface' IS NULL OR b.surface ILIKE '%'||(p_filters->>'surface')||'%')
    AND (p_filters->>'temp_min' IS NULL OR b.temperature >= (p_filters->>'temp_min')::numeric)
    AND (p_filters->>'temp_max' IS NULL OR b.temperature <= (p_filters->>'temp_max')::numeric)
    AND (p_filters->>'wind_min' IS NULL OR b.wind_speed >= (p_filters->>'wind_min')::numeric)
    AND (p_filters->>'wind_max' IS NULL OR b.wind_speed <= (p_filters->>'wind_max')::numeric)
    AND (p_filters->>'rest_min' IS NULL OR b.rest_days >= (p_filters->>'rest_min')::numeric)
    AND (p_filters->>'rest_max' IS NULL OR b.rest_days <= (p_filters->>'rest_max')::numeric)
    AND (p_filters->>'pre_bye' IS NULL OR b.pre_bye = (p_filters->>'pre_bye')::boolean)
    AND (p_filters->>'coach' IS NULL OR b.coach = (p_filters->>'coach'))
    AND (p_filters->>'referee' IS NULL OR b.referee = (p_filters->>'referee'))
    AND (p_filters->'team' IS NULL OR b.team_abbr IN (SELECT jsonb_array_elements_text(p_filters->'team')))
    AND (p_filters->'opponent' IS NULL OR b.opponent_abbr IN (SELECT jsonb_array_elements_text(p_filters->'opponent')))
    AND (p_filters->>'last_spread' IS NULL OR b.last_spread = (p_filters->>'last_spread')::int)
    AND (p_filters->>'last_ou' IS NULL OR b.last_ou = (p_filters->>'last_ou')::int)
    AND (p_filters->>'last_ml' IS NULL OR b.last_ml = (p_filters->>'last_ml')::int)
    AND (p_filters->>'precip' IS NULL
         OR ((p_filters->>'precip')='rain' AND b.precipitation_type ILIKE '%rain%')
         OR ((p_filters->>'precip')='snow' AND b.precipitation_type ILIKE '%snow%')
         OR ((p_filters->>'precip')='none' AND (b.precipitation_type IS NULL
              OR (b.precipitation_type NOT ILIKE '%rain%' AND b.precipitation_type NOT ILIKE '%snow%'))))
    AND (p_filters->>'last_won' IS NULL OR b.last_fg_won = (p_filters->>'last_won')::int)
    AND (p_filters->>'last_covered' IS NULL OR b.last_fg_covered = (p_filters->>'last_covered')::int)
    AND (p_filters->>'last_over' IS NULL OR b.last_ou_result = (p_filters->>'last_over')::int)
    AND (p_filters->>'last_favorite' IS NULL OR b.last_is_favorite = (p_filters->>'last_favorite')::boolean)
    AND (p_filters->>'last_overtime' IS NULL OR b.last_overtime = (p_filters->>'last_overtime')::boolean)
    AND (p_filters->>'last_blowout' IS NULL
         OR ((p_filters->>'last_blowout')='win' AND b.last_margin >= 21)
         OR ((p_filters->>'last_blowout')='loss' AND b.last_margin <= -21));
  DELETE FROM _f WHERE hit IS NULL;

  SELECT jsonb_build_object('season_min',min(season),'season_max',max(season),
    'n_bets', count(*), 'n_games', count(DISTINCT unique_id)) INTO cov FROM _f;
  SELECT jsonb_build_object('n', count(*), 'wins', count(*) FILTER (WHERE hit=1),
    'hit_pct', round(avg(hit)::numeric*100,1),
    'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END)
    INTO overall FROM _f WHERE (NOT is_game_level OR is_home);
  IF is_game_level THEN
    SELECT round(avg(CASE p_bet_type WHEN 'fg_total' THEN ou_result ELSE h1_total_over END)::numeric*100,1)
      INTO baseline FROM nfl_analysis_base WHERE is_home;
  ELSE
    SELECT round(avg(CASE p_bet_type WHEN 'fg_spread' THEN fg_covered WHEN 'fg_ml' THEN fg_won
      WHEN 'team_total' THEN tt_over WHEN 'h1_spread' THEN h1_covered ELSE h1_won END)::numeric*100,1)
      INTO baseline FROM nfl_analysis_base;
  END IF;

  IF is_game_level OR p_bet_type='team_total' THEN
    SELECT jsonb_build_array(jsonb_build_object('dimension','over_under','options', jsonb_build_array(
      (SELECT jsonb_build_object('side','over','n',count(*),'wins',count(*) FILTER (WHERE hit=1),
         'hit_pct',round(avg(hit)::numeric*100,1),'roi',round((avg(hit)::numeric*1.909-1)*100,1)) FROM _f WHERE (NOT is_game_level OR is_home)),
      (SELECT jsonb_build_object('side','under','n',count(*),'wins',count(*) FILTER (WHERE hit=0),
         'hit_pct',round((1-avg(hit))::numeric*100,1),'roi',round(((1-avg(hit))::numeric*1.909-1)*100,1)) FROM _f WHERE (NOT is_game_level OR is_home)) )))
    INTO bars;
  ELSE
    SELECT jsonb_build_array(
      jsonb_build_object('dimension','home_away','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','home','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE is_home),
        (SELECT jsonb_build_object('side','away','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE NOT is_home) )),
      jsonb_build_object('dimension','fav_dog','options', jsonb_build_array(
        (SELECT jsonb_build_object('side','favorite','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE is_favorite),
        (SELECT jsonb_build_object('side','underdog','n',count(*),'wins',count(*) FILTER (WHERE hit=1),'hit_pct',round(avg(hit)::numeric*100,1),
           'roi', CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END) FROM _f WHERE NOT is_favorite) )))
    INTO bars;
  END IF;

  v := jsonb_build_object('bet_type', p_bet_type, 'coverage', cov, 'baseline_pct', baseline,
    'overall', overall, 'bars', bars,
    'by_team', COALESCE((SELECT jsonb_agg(jsonb_build_object('team',team_abbr,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT team_abbr, count(*) n, round(avg(hit)::numeric*100,1) hp,
               CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END r
             FROM _f GROUP BY team_abbr HAVING count(*)>=1) t), '[]'::jsonb),
    'by_coach', COALESCE((SELECT jsonb_agg(jsonb_build_object('coach',coach,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT coach, count(*) n, round(avg(hit)::numeric*100,1) hp,
               CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END r
             FROM _f WHERE coach IS NOT NULL GROUP BY coach HAVING count(*)>=1) t), '[]'::jsonb),
    'by_referee', COALESCE((SELECT jsonb_agg(jsonb_build_object('referee',referee,'n',n,'hit_pct',hp,'roi',r) ORDER BY n DESC)
       FROM (SELECT referee, count(*) n, round(avg(hit)::numeric*100,1) hp,
               CASE WHEN is_ml THEN NULL ELSE round((avg(hit)::numeric*1.909-1)*100,1) END r
             FROM _f WHERE (p_bet_type='team_total' OR is_home) AND referee IS NOT NULL GROUP BY referee HAVING count(*)>=1) t), '[]'::jsonb));
  DROP TABLE _f;
  RETURN v;
END;
$function$
