-- Count agent creations durably, including agents deleted after recognition.
-- Deleted agents from before tracking are not reconstructable.
CREATE TABLE public.user_achievement_agents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,agent_id)
);
ALTER TABLE public.user_achievement_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievement_agents_owner_read ON public.user_achievement_agents FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.user_achievement_agents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_achievement_agents TO authenticated;
GRANT ALL ON public.user_achievement_agents TO service_role;
INSERT INTO public.user_achievement_agents(user_id,agent_id) SELECT user_id,id FROM public.avatar_profiles ON CONFLICT DO NOTHING;
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
SELECT v.id,(SELECT count(*) FROM public.user_achievement_agents WHERE user_id=p_user_id)::numeric,v.target,LEAST(1,(SELECT count(*) FROM public.user_achievement_agents WHERE user_id=p_user_id)::numeric/v.target),NULL::uuid FROM (VALUES ('agent-squad',3::numeric),('full-lineup',5::numeric)) v(id,target)
UNION ALL SELECT * FROM numeric_best UNION ALL SELECT * FROM rank_best UNION ALL SELECT * FROM activity_best;
$$;
REVOKE ALL ON FUNCTION public._user_achievement_candidates(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._refresh_user_achievements(p_user_id uuid,p_backfill boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('achievements:'||p_user_id::text,0));
  INSERT INTO public.user_achievement_agents(user_id,agent_id)
  SELECT user_id,id FROM public.avatar_profiles WHERE user_id=p_user_id ON CONFLICT DO NOTHING;
  -- Reconcile only evidence which actually persists today. Recognition time, not invented history.
  INSERT INTO public.user_achievement_activity(user_id,activity)
  SELECT p_user_id, evidence.activity FROM (VALUES
    ('agent_created',EXISTS(SELECT 1 FROM public.avatar_profiles a WHERE a.user_id=p_user_id)),
    ('agent_followed',EXISTS(SELECT 1 FROM public.user_avatar_follows f JOIN public.avatar_profiles a ON a.id=f.avatar_id WHERE f.user_id=p_user_id AND a.user_id<>p_user_id AND a.is_public)),
    ('picks_generated',EXISTS(SELECT 1 FROM public.avatar_profiles a WHERE a.user_id=p_user_id AND (EXISTS(SELECT 1 FROM public.avatar_picks p WHERE p.avatar_id=a.id) OR EXISTS(SELECT 1 FROM public.avatar_parlays p WHERE p.avatar_id=a.id)))),
    ('system_saved',EXISTS(SELECT 1 FROM public.nfl_analysis_saved_filters s WHERE s.user_id=p_user_id AND s.verdict IS NOT NULL AND s.rpc_filters IS NOT NULL)
      OR EXISTS(SELECT 1 FROM public.cfb_analysis_saved_filters s WHERE s.user_id=p_user_id AND s.verdict IS NOT NULL AND s.rpc_filters IS NOT NULL)
      OR EXISTS(SELECT 1 FROM public.mlb_analysis_saved_filters s WHERE s.user_id=p_user_id AND s.verdict IS NOT NULL AND s.rpc_filters IS NOT NULL)),
    ('wagerbot_response',EXISTS(SELECT 1 FROM public.chat_messages m JOIN public.chat_threads t ON t.id=m.thread_id WHERE t.user_id=p_user_id::text AND m.role='assistant' AND length(btrim(m.content))>0))
  ) evidence(activity,qualifies) WHERE evidence.qualifies
  ON CONFLICT(user_id,activity) DO NOTHING;
  INSERT INTO public.user_achievement_awards(user_id,achievement_id,is_backfilled,credited_agent_id,qualifying_value,celebrated_at)
  SELECT p_user_id,c.id,p_backfill,c.credited_agent_id,c.current_value,CASE WHEN p_backfill THEN now() ELSE NULL END
  FROM public._user_achievement_candidates(p_user_id) c WHERE c.progress>=1
  ON CONFLICT(user_id,achievement_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public._refresh_user_achievements(uuid,boolean) FROM PUBLIC,anon,authenticated;

