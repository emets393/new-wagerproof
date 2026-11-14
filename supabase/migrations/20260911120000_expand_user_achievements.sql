-- Expand the catalog without rewriting existing immutable earned awards.
ALTER TABLE public.user_achievement_awards DROP CONSTRAINT user_achievement_awards_achievement_id_check;
ALTER TABLE public.user_achievement_awards ADD CONSTRAINT user_achievement_awards_achievement_id_check CHECK (achievement_id IN ('first-agent','first-follow','first-picks','experience-10','experience-50','experience-100','experience-500','streak-3','streak-5','streak-10','streak-15','first-win','plus-10-units','plus-25-units','consistent','top-100','top-10','number-one','game-analyst','props-scout','trend-explorer','system-builder','wagerbot-partner','connected-researcher','agent-squad','full-lineup','experience-1000','experience-2500','experience-5000','streak-20','streak-25','plus-50-units','plus-100-units','consistent-250','consistent-500'));
CREATE OR REPLACE FUNCTION public._user_achievement_candidates(p_user_id uuid)
RETURNS TABLE(id text,current_value numeric,target_value numeric,progress numeric,credited_agent_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
WITH owned AS (
  SELECT a.id,COALESCE(c.total_picks,0) AS total_picks,COALESCE(c.best_streak,0) AS best_streak,
    COALESCE(c.wins,0) AS wins,COALESCE(c.losses,0) AS losses,COALESCE(c.net_units,0) AS net_units
  FROM public.avatar_profiles a LEFT JOIN public.avatar_performance_cache c ON c.avatar_id=a.id
  WHERE a.user_id=p_user_id
), numeric_catalog(id,metric,target_value) AS (VALUES
  ('experience-10','total',10::numeric),('experience-50','total',50),('experience-100','total',100),('experience-500','total',500),('experience-1000','total',1000),('experience-2500','total',2500),('experience-5000','total',5000),
  ('streak-3','streak',3),('streak-5','streak',5),('streak-10','streak',10),('streak-15','streak',15),('streak-20','streak',20),('streak-25','streak',25),
  ('first-win','wins',1),('plus-10-units','units',10),('plus-25-units','units',25),('plus-50-units','units',50),('plus-100-units','units',100),('consistent','consistent',55),('consistent-250','consistent',55),('consistent-500','consistent',55)
), numeric_rows AS (
 SELECT c.id,c.target_value,o.id AS agent_id,
   CASE c.metric WHEN 'total' THEN o.total_picks WHEN 'streak' THEN o.best_streak WHEN 'wins' THEN o.wins WHEN 'units' THEN o.net_units
     ELSE COALESCE(100.0*o.wins/NULLIF(o.wins+o.losses,0),0) END AS value,
   CASE c.metric WHEN 'consistent' THEN LEAST((o.wins+o.losses)/(CASE c.id WHEN 'consistent-250' THEN 250.0 WHEN 'consistent-500' THEN 500.0 ELSE 100.0 END),COALESCE(o.wins::numeric/NULLIF(o.wins+o.losses,0),0)/.55)
     WHEN 'total' THEN o.total_picks/c.target_value WHEN 'streak' THEN o.best_streak/c.target_value
     WHEN 'wins' THEN o.wins/c.target_value ELSE o.net_units/c.target_value END AS fraction
 FROM numeric_catalog c CROSS JOIN owned o
), numeric_best AS (
 SELECT c.id,COALESCE(best.value,0) AS current_value,c.target_value,GREATEST(0,LEAST(1,COALESCE(best.fraction,0))) AS progress,best.agent_id
 FROM numeric_catalog c LEFT JOIN LATERAL (
   SELECT r.* FROM numeric_rows r WHERE r.id=c.id
   ORDER BY (r.fraction>=1) DESC,CASE WHEN r.fraction>=1 THEN r.agent_id END ASC,r.fraction DESC,r.agent_id ASC LIMIT 1
 ) best ON true
), ranked AS (
 SELECT a.id,a.user_id,row_number() OVER(ORDER BY c.net_units DESC,COALESCE(c.win_rate,0) DESC,c.current_streak DESC,a.id) AS rank
 FROM public.avatar_profiles a JOIN public.avatar_performance_cache c ON c.avatar_id=a.id
 WHERE a.is_public AND c.total_picks>=10 AND c.wins+c.losses>0
), rank_catalog(id,target_value) AS (VALUES ('top-100',100::numeric),('top-10',10),('number-one',1)), rank_best AS (
 SELECT c.id,COALESCE(best.rank,0)::numeric AS current_value,c.target_value,
   CASE WHEN best.rank IS NULL THEN 0::numeric ELSE LEAST(1,c.target_value/best.rank) END AS progress,best.id AS agent_id
 FROM rank_catalog c LEFT JOIN LATERAL (
   SELECT r.* FROM ranked r WHERE r.user_id=p_user_id
   ORDER BY (r.rank<=c.target_value) DESC,CASE WHEN r.rank<=c.target_value THEN r.id END ASC,r.rank,r.id LIMIT 1
 ) best ON true
), activity_catalog(id,activity) AS (VALUES
 ('first-agent','agent_created'),('first-follow','agent_followed'),('first-picks','picks_generated'),
 ('game-analyst','game_analysis'),('props-scout','props'),('trend-explorer','historical_analysis'),
 ('system-builder','system_saved'),('wagerbot-partner','wagerbot_response'),('connected-researcher','mcp_tool_success')
), activity_best AS (
 SELECT c.id,(EXISTS(SELECT 1 FROM public.user_achievement_activity e WHERE e.user_id=p_user_id AND e.activity=c.activity))::int::numeric AS current_value,
   1::numeric AS target_value,(EXISTS(SELECT 1 FROM public.user_achievement_activity e WHERE e.user_id=p_user_id AND e.activity=c.activity))::int::numeric AS progress,
   CASE WHEN c.id='first-picks' THEN (SELECT a.id FROM public.avatar_profiles a WHERE a.user_id=p_user_id AND
      (EXISTS(SELECT 1 FROM public.avatar_picks p WHERE p.avatar_id=a.id) OR EXISTS(SELECT 1 FROM public.avatar_parlays p WHERE p.avatar_id=a.id)) ORDER BY a.id LIMIT 1)
    ELSE NULL::uuid END AS agent_id
 FROM activity_catalog c
)
SELECT v.id,(SELECT count(*) FROM owned)::numeric,v.target,LEAST(1,(SELECT count(*) FROM owned)::numeric/v.target),NULL::uuid FROM (VALUES ('agent-squad',3::numeric),('full-lineup',5::numeric)) v(id,target)
UNION ALL SELECT * FROM numeric_best UNION ALL SELECT * FROM rank_best UNION ALL SELECT * FROM activity_best;
$$;
REVOKE ALL ON FUNCTION public._user_achievement_candidates(uuid) FROM PUBLIC,anon,authenticated;

ALTER TABLE public.user_achievement_state ADD COLUMN catalog_version integer NOT NULL DEFAULT 1;
CREATE OR REPLACE FUNCTION public.get_user_achievements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
DECLARE uid uuid:=auth.uid(); initialized timestamptz; first_read boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('achievements:'||uid::text,0));
  SELECT s.initialized_at INTO initialized FROM public.user_achievement_state s WHERE s.user_id=uid;
  first_read:=initialized IS NULL;
  IF first_read THEN
    INSERT INTO public.user_achievement_state(user_id) VALUES(uid) RETURNING initialized_at INTO initialized;
  END IF;
  IF (SELECT s.catalog_version FROM public.user_achievement_state s WHERE s.user_id=uid)<2 THEN
    PERFORM public._refresh_user_achievements(uid,first_read);
    UPDATE public.user_achievement_awards SET is_backfilled=true,celebrated_at=COALESCE(celebrated_at,now())
      WHERE user_id=uid AND achievement_id IN ('agent-squad','full-lineup','experience-1000','experience-2500','experience-5000','streak-20','streak-25','plus-50-units','plus-100-units','consistent-250','consistent-500');
    UPDATE public.user_achievement_state SET catalog_version=2 WHERE user_id=uid;
  END IF;
  PERFORM public._refresh_user_achievements(uid,first_read);
  RETURN jsonb_build_object('catalog_version',2,'initialized_at',initialized,'generated_at',now(),
    'achievements',(SELECT jsonb_agg(jsonb_build_object('id',c.id,'progress',CASE WHEN a.earned_at IS NOT NULL THEN 1 ELSE c.progress END,
      'current_value',c.current_value,'target_value',c.target_value,'earned_at',a.earned_at,'is_backfilled',COALESCE(a.is_backfilled,false),
      'credited_agent_id',COALESCE(a.credited_agent_id,c.credited_agent_id)) ORDER BY c.id)
      FROM public._user_achievement_candidates(uid) c LEFT JOIN public.user_achievement_awards a ON a.user_id=uid AND a.achievement_id=c.id),
    'newly_unlocked_ids',COALESCE((SELECT jsonb_agg(a.achievement_id ORDER BY a.earned_at,a.achievement_id)
      FROM public.user_achievement_awards a WHERE a.user_id=uid AND a.celebrated_at IS NULL AND NOT a.is_backfilled),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_achievements() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_user_achievements() TO authenticated;

