-- Agent "follow / copy build" backend (see .claude/docs/agents/03_DATABASE_SCHEMA.md).
-- 1) user_avatar_follows: allow owners to update ONLY their follow preferences
--    (is_favorite, notify_on_pick) — previously there was no UPDATE policy at all.
-- 2) avatar_profiles.sourced_from_avatar_id: provenance for "copy build".
-- 3) clone_public_agent(): SECURITY DEFINER RPC that copies a public agent's build
--    into a NEW agent owned by the caller. Follow never grants ownership; generation
--    stays owner-only (enqueue_*_v3_trigger / is_agent_owner are unchanged).

-- ── 1. Follow-preferences UPDATE policy ─────────────────────────────────────
-- Column-level grant so RLS + grants together allow updating ONLY the two
-- preference flags (identity columns + followed_at stay immutable to clients).
REVOKE UPDATE ON public.user_avatar_follows FROM authenticated;
GRANT UPDATE (is_favorite, notify_on_pick) ON public.user_avatar_follows TO authenticated;

DROP POLICY IF EXISTS "Users can update own follow prefs" ON public.user_avatar_follows;
CREATE POLICY "Users can update own follow prefs" ON public.user_avatar_follows
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. Copy-build provenance ────────────────────────────────────────────────
ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS sourced_from_avatar_id uuid
    REFERENCES public.avatar_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_avatar_profiles_sourced_from
  ON public.avatar_profiles (sourced_from_avatar_id)
  WHERE sourced_from_avatar_id IS NOT NULL;

-- ── 3. clone_public_agent ───────────────────────────────────────────────────
-- Copies build fields only (personality_params, custom_insights, preferred_sports,
-- archetype, emoji/color/sprite). Never copies: is_public, auto_generate, stats,
-- generation timestamps. New agent starts private + active + manual-generation.
-- Limits: same gate as agent creation — can_create_agent(uid, true) (2-arg overload
-- called explicitly: the 1-arg call form is ambiguous at parse time, see docs note).
CREATE OR REPLACE FUNCTION public.clone_public_agent(
  p_source_avatar_id uuid,
  p_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source public.avatar_profiles%ROWTYPE;
  v_base_name text;
  v_try_name text;
  v_new_id uuid;
  v_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Source must be public (or already owned by the caller — duplicating your own
  -- agent is the same operation with fewer trust concerns).
  SELECT * INTO v_source
  FROM public.avatar_profiles
  WHERE id = p_source_avatar_id
    AND (is_public = true OR user_id = v_user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_not_found_or_not_public';
  END IF;

  -- Same creation limits as the normal create path (clone lands active).
  IF NOT public.can_create_agent(v_user_id, true) THEN
    RAISE EXCEPTION 'agent_limit_reached';
  END IF;

  v_base_name := left(coalesce(nullif(btrim(p_name), ''), v_source.name), 60);

  LOOP
    v_try_name := CASE v_attempt
      WHEN 0 THEN v_base_name
      WHEN 1 THEN v_base_name || ' (Copy)'
      ELSE v_base_name || ' (Copy ' || v_attempt || ')'
    END;
    BEGIN
      INSERT INTO public.avatar_profiles (
        user_id, name, avatar_emoji, avatar_color, sprite_index,
        preferred_sports, archetype, personality_params, custom_insights,
        is_public, is_active, auto_generate, sourced_from_avatar_id
      ) VALUES (
        v_user_id, v_try_name, v_source.avatar_emoji, v_source.avatar_color, v_source.sprite_index,
        v_source.preferred_sports, v_source.archetype, v_source.personality_params, v_source.custom_insights,
        false, true, false, v_source.id
      )
      RETURNING id INTO v_new_id;
      RETURN v_new_id;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 20 THEN
        RAISE EXCEPTION 'name_conflict_unresolvable';
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_public_agent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_public_agent(uuid, text) TO authenticated, service_role;

-- ── Test SQL (run manually; wrap in BEGIN/ROLLBACK) ─────────────────────────
-- BEGIN;
-- SELECT set_config('request.jwt.claims', '{"sub":"<real-user-uuid>"}', true);
-- SELECT public.clone_public_agent('<public-avatar-uuid>');          -- returns new uuid
-- SELECT public.clone_public_agent('<public-avatar-uuid>');          -- returns "<name> (Copy)" row
-- SELECT public.clone_public_agent('<PRIVATE-avatar-uuid-not-own>'); -- ERROR source_not_found_or_not_public
-- UPDATE public.user_avatar_follows SET is_favorite = true
--   WHERE user_id = '<real-user-uuid>' AND avatar_id = '<followed-avatar-uuid>';  -- 1 row
-- ROLLBACK;
