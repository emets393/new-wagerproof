-- ============================================================================
-- Migration: Enforce private agents for free users
-- Description:
--   - Free (non-pro, non-admin) users cannot create public agents
--   - Free users cannot update agents to public
--   - Pro/admin behavior remains unchanged
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_create_public_agent(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.can_access_agent_picks(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_create_public_agent(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create own avatars" ON public.avatar_profiles;
CREATE POLICY "Users can create own avatars"
  ON public.avatar_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_create_agent(auth.uid())
    AND (
      public.can_create_public_agent(auth.uid())
      OR COALESCE(is_public, false) = false
    )
  );

DROP POLICY IF EXISTS "Users can update own avatars" ON public.avatar_profiles;
CREATE POLICY "Users can update own avatars"
  ON public.avatar_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_set_agent_active(auth.uid(), id, is_active)
    AND (
      public.can_create_public_agent(auth.uid())
      OR COALESCE(is_public, false) = false
    )
  );
