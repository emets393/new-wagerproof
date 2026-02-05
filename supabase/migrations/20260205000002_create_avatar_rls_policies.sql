-- ============================================================================
-- Migration: Create RLS Policies for Avatar Tables
-- Description: Row Level Security policies for agent feature
-- ============================================================================

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
ALTER TABLE public.avatar_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_performance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatar_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_archetypes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- avatar_profiles policies
-- ============================================================================

-- Users can read their own avatars
CREATE POLICY "Users can read own avatars"
  ON public.avatar_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own avatars
CREATE POLICY "Users can create own avatars"
  ON public.avatar_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own avatars
CREATE POLICY "Users can update own avatars"
  ON public.avatar_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own avatars
CREATE POLICY "Users can delete own avatars"
  ON public.avatar_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Anyone can read public avatars (for leaderboard)
CREATE POLICY "Anyone can read public avatars"
  ON public.avatar_profiles
  FOR SELECT
  USING (is_public = true);

-- ============================================================================
-- avatar_picks policies
-- ============================================================================

-- Users can read their own avatar's picks
CREATE POLICY "Users can read own avatar picks"
  ON public.avatar_picks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
      AND avatar_profiles.user_id = auth.uid()
    )
  );

-- Anyone can read picks from public avatars
CREATE POLICY "Anyone can read public avatar picks"
  ON public.avatar_picks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
      AND avatar_profiles.is_public = true
    )
  );

-- Service role inserts picks (edge function uses service_role key, bypasses RLS)
-- No INSERT policy needed for regular users - picks are created by edge functions

-- ============================================================================
-- avatar_performance_cache policies
-- ============================================================================

-- Anyone can read performance cache (for leaderboard)
CREATE POLICY "Anyone can read performance cache"
  ON public.avatar_performance_cache
  FOR SELECT
  USING (true);

-- Only service role can modify (edge functions)
-- No INSERT/UPDATE policies for regular users

-- ============================================================================
-- user_avatar_follows policies
-- ============================================================================

-- Users can read their own follows
CREATE POLICY "Users can read own follows"
  ON public.user_avatar_follows
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own follows
CREATE POLICY "Users can create own follows"
  ON public.user_avatar_follows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own follows
CREATE POLICY "Users can delete own follows"
  ON public.user_avatar_follows
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- preset_archetypes policies
-- ============================================================================

-- Anyone can read active preset archetypes
CREATE POLICY "Anyone can read preset archetypes"
  ON public.preset_archetypes
  FOR SELECT
  USING (is_active = true);

-- Only admins can modify (via Supabase dashboard or service role)
