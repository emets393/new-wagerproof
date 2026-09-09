-- Personal, immutable earned achievements. All numeric evidence is server-owned.
-- Per-agent milestones never combine the results of different owned agents.
CREATE TABLE public.user_achievement_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  initialized_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_achievement_activity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL CHECK (activity IN ('agent_created','agent_followed','picks_generated','game_analysis','props','historical_analysis','system_saved','wagerbot_response','mcp_tool_success')),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,activity)
);
CREATE TABLE public.user_achievement_awards (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL CHECK (achievement_id IN ('first-agent','first-follow','first-picks','experience-10','experience-50','experience-100','experience-500','streak-3','streak-5','streak-10','streak-15','first-win','plus-10-units','plus-25-units','consistent','top-100','top-10','number-one','game-analyst','props-scout','trend-explorer','system-builder','wagerbot-partner','connected-researcher')),
  earned_at timestamptz NOT NULL DEFAULT now(),
  is_backfilled boolean NOT NULL,
  -- Deliberately no agent FK: deleting an agent must not delete earned credit.
  credited_agent_id uuid,
  qualifying_value numeric NOT NULL,
  celebrated_at timestamptz,
  PRIMARY KEY(user_id,achievement_id)
);
ALTER TABLE public.user_achievement_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievement_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievement_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievement_state_owner_read ON public.user_achievement_state FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY achievement_activity_owner_read ON public.user_achievement_activity FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY achievement_awards_owner_read ON public.user_achievement_awards FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.user_achievement_state,public.user_achievement_activity,public.user_achievement_awards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_achievement_state,public.user_achievement_activity,public.user_achievement_awards TO authenticated;
GRANT ALL ON public.user_achievement_state,public.user_achievement_activity,public.user_achievement_awards TO service_role;

-- Internal read model. Not callable by API roles; uid is supplied only by trusted wrappers.
CREATE FUNCTION public._user_achievement_candidates(p_user_id uuid)
RETURNS TABLE(id text,current_value numeric,target_value numeric,progress numeric,credited_agent_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
WITH owned AS (
  SELECT a.id,COALESCE(c.total_picks,0) AS total_picks,COALESCE(c.best_streak,0) AS best_streak,
    COALESCE(c.wins,0) AS wins,COALESCE(c.losses,0) AS losses,COALESCE(c.net_units,0) AS net_units
  FROM public.avatar_profiles a LEFT JOIN public.avatar_performance_cache c ON c.avatar_id=a.id
  WHERE a.user_id=p_user_id
), numeric_catalog(id,metric,target_value) AS (VALUES
  ('experience-10','total',10::numeric),('experience-50','total',50),('experience-100','total',100),('experience-500','total',500),
  ('streak-3','streak',3),('streak-5','streak',5),('streak-10','streak',10),('streak-15','streak',15),
  ('first-win','wins',1),('plus-10-units','units',10),('plus-25-units','units',25),('consistent','consistent',55)
), numeric_rows AS (
 SELECT c.id,c.target_value,o.id AS agent_id,
   CASE c.metric WHEN 'total' THEN o.total_picks WHEN 'streak' THEN o.best_streak WHEN 'wins' THEN o.wins WHEN 'units' THEN o.net_units
     ELSE COALESCE(100.0*o.wins/NULLIF(o.wins+o.losses,0),0) END AS value,
   CASE c.metric WHEN 'consistent' THEN LEAST((o.wins+o.losses)/100.0,COALESCE(o.wins::numeric/NULLIF(o.wins+o.losses,0),0)/.55)
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
SELECT * FROM numeric_best UNION ALL SELECT * FROM rank_best UNION ALL SELECT * FROM activity_best;
$$;
REVOKE ALL ON FUNCTION public._user_achievement_candidates(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public._refresh_user_achievements(p_user_id uuid,p_backfill boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('achievements:'||p_user_id::text,0));
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

CREATE FUNCTION public.get_user_achievements()
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
  PERFORM public._refresh_user_achievements(uid,first_read);
  RETURN jsonb_build_object('catalog_version',1,'initialized_at',initialized,'generated_at',now(),
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

CREATE FUNCTION public.record_achievement_activity(activity text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF activity IS NULL OR activity NOT IN ('game_analysis','props','historical_analysis') THEN
    RAISE EXCEPTION 'Unsupported achievement activity' USING ERRCODE='22023';
  END IF;
  -- Initial existing-history backfill precedes a newly observed feature event.
  PERFORM public.get_user_achievements();
  INSERT INTO public.user_achievement_activity(user_id,activity) VALUES(uid,activity) ON CONFLICT DO NOTHING;
  RETURN public.get_user_achievements();
END;
$$;
REVOKE ALL ON FUNCTION public.record_achievement_activity(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_achievement_activity(text) TO authenticated;

CREATE FUNCTION public.record_achievement_service_activity(p_user_id uuid,activity text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
BEGIN
  IF p_user_id IS NULL OR activity IS DISTINCT FROM 'mcp_tool_success' THEN RAISE EXCEPTION 'Unsupported service activity' USING ERRCODE='22023'; END IF;
  INSERT INTO public.user_achievement_activity(user_id,activity) VALUES(p_user_id,activity) ON CONFLICT DO NOTHING;
  PERFORM public._refresh_user_achievements(p_user_id,NOT EXISTS(SELECT 1 FROM public.user_achievement_state s WHERE s.user_id=p_user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.record_achievement_service_activity(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_achievement_service_activity(uuid,text) TO service_role;

CREATE FUNCTION public.acknowledge_achievement_celebrations(achievement_ids text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  UPDATE public.user_achievement_awards SET celebrated_at=COALESCE(celebrated_at,now())
  WHERE user_id=auth.uid() AND achievement_id=ANY(achievement_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.acknowledge_achievement_celebrations(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_achievement_celebrations(text[]) TO authenticated;

-- Capture existing server-owned state transitions. Triggers never accept client totals.
CREATE FUNCTION public._capture_user_achievement_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
DECLARE uid uuid; quiet boolean;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'avatar_profiles' THEN uid:=NEW.user_id;
    WHEN 'user_avatar_follows' THEN uid:=NEW.user_id;
    WHEN 'avatar_picks','avatar_parlays' THEN SELECT a.user_id INTO uid FROM public.avatar_profiles a WHERE a.id=NEW.avatar_id;
    WHEN 'avatar_performance_cache' THEN SELECT a.user_id INTO uid FROM public.avatar_profiles a WHERE a.id=NEW.avatar_id;
    WHEN 'chat_messages' THEN
      IF NEW.role<>'assistant' OR length(btrim(NEW.content))=0 THEN RETURN NEW; END IF;
      SELECT u.id INTO uid FROM public.chat_threads t JOIN auth.users u ON u.id::text=t.user_id WHERE t.id=NEW.thread_id;
    ELSE uid:=NEW.user_id;
  END CASE;
  IF uid IS NOT NULL THEN
    quiet:=NOT EXISTS(SELECT 1 FROM public.user_achievement_state s WHERE s.user_id=uid);
    PERFORM public._refresh_user_achievements(uid,quiet);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._capture_user_achievement_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER achievement_agent_created AFTER INSERT ON public.avatar_profiles FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_agent_followed AFTER INSERT ON public.user_avatar_follows FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_picks_generated AFTER INSERT ON public.avatar_picks FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_parlay_generated AFTER INSERT ON public.avatar_parlays FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_performance_observed AFTER INSERT OR UPDATE ON public.avatar_performance_cache FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_nfl_system_saved AFTER INSERT ON public.nfl_analysis_saved_filters FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_cfb_system_saved AFTER INSERT ON public.cfb_analysis_saved_filters FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_mlb_system_saved AFTER INSERT ON public.mlb_analysis_saved_filters FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
CREATE TRIGGER achievement_wagerbot_response AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public._capture_user_achievement_change();
