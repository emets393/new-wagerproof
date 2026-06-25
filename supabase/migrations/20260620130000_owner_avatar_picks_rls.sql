-- Let agent owners read their own picks without a Pro subscription.
-- The Pro-gated policies from 20260219150000 remain for public-agent picks;
-- RLS SELECT policies are OR'd, so this supplements them for owners.
-- Required for iOS/web owner detail screens that load history via direct
-- Supabase reads (avatar_picks) instead of the entitlement-gated RPC.

CREATE POLICY "Owners can read own avatar picks"
  ON public.avatar_picks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
        AND avatar_profiles.user_id = auth.uid()
    )
  );
