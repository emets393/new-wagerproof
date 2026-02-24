-- ============================================================================
-- Migration: Add RPC for updating owner_last_active_at
-- Description: Bypasses RLS for activity tracking (owner_last_active_at only)
--   while still verifying auth.uid() = user_id. Fixes RLS violation when
--   trackAppOpen/forceTrackActivity update avatar_profiles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_owner_last_active_at(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN; -- Silently skip if not authenticated or user mismatch
  END IF;

  UPDATE public.avatar_profiles
  SET owner_last_active_at = now()
  WHERE user_id = p_user_id
    AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_owner_last_active_at(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_owner_last_active_at(uuid) TO anon;
