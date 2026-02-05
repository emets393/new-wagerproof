-- ============================================================================
-- Migration: Create Avatar/Agent Tables
-- Description: Core tables for AI betting agents feature
-- ============================================================================

-- ============================================================================
-- TABLE: avatar_profiles
-- The main agent configuration table with identity + JSONB personality params
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.avatar_profiles (
  -- Identity (columns - queryable, rarely change)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '🎯',
  avatar_color text NOT NULL DEFAULT '#6366f1',
  preferred_sports text[] NOT NULL DEFAULT ARRAY['nfl'],
  archetype text,  -- 'contrarian', 'chalk_grinder', etc.

  -- Personality params (JSONB - flexible, evolves without migrations)
  personality_params jsonb NOT NULL DEFAULT '{
    "risk_tolerance": 3,
    "underdog_lean": 3,
    "over_under_lean": 3,
    "confidence_threshold": 3,
    "chase_value": false,
    "preferred_bet_type": "any",
    "max_favorite_odds": -200,
    "min_underdog_odds": null,
    "max_picks_per_day": 3,
    "skip_weak_slates": true,
    "trust_model": 4,
    "trust_polymarket": 3,
    "polymarket_divergence_flag": true,
    "home_court_boost": 3
  }'::jsonb,

  -- Custom insights (JSONB - user's free-text inputs)
  custom_insights jsonb DEFAULT '{
    "betting_philosophy": null,
    "perceived_edges": null,
    "avoid_situations": null,
    "target_situations": null
  }'::jsonb,

  -- Meta
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Auto-generation (for daily automatic pick delivery)
  auto_generate boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz,
  last_auto_generated_at timestamptz,
  owner_last_active_at timestamptz DEFAULT now(),

  CONSTRAINT unique_avatar_name_per_user UNIQUE (user_id, name)
);

-- Indexes for avatar_profiles
CREATE INDEX IF NOT EXISTS idx_avatar_profiles_user ON public.avatar_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_profiles_public ON public.avatar_profiles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_avatar_profiles_archetype ON public.avatar_profiles(archetype);
CREATE INDEX IF NOT EXISTS idx_avatar_profiles_auto_gen ON public.avatar_profiles(auto_generate, is_active, last_auto_generated_at)
  WHERE auto_generate = true AND is_active = true;

-- ============================================================================
-- TABLE: preset_archetypes
-- Pre-configured agent templates users can quick-select
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.preset_archetypes (
  id text PRIMARY KEY,  -- 'contrarian', 'chalk_grinder', etc.
  name text NOT NULL,
  description text NOT NULL,
  philosophy text NOT NULL,
  emoji text NOT NULL,
  color text NOT NULL,
  recommended_sports text[] NOT NULL,
  personality_params jsonb NOT NULL,
  custom_insights jsonb NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

-- ============================================================================
-- TABLE: avatar_picks
-- Picks made by agents with archived data for historical accuracy
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.avatar_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id uuid NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,

  -- Game reference
  game_id text NOT NULL,
  sport text NOT NULL CHECK (sport IN ('nfl', 'cfb', 'nba', 'ncaab')),
  matchup text NOT NULL,  -- "Kansas City Chiefs @ Buffalo Bills"
  game_date date NOT NULL,

  -- The pick
  bet_type text NOT NULL CHECK (bet_type IN ('spread', 'moneyline', 'total')),
  pick_selection text NOT NULL,  -- "Bills -1.5", "Chiefs +150", "Over 48.5"
  odds text,  -- "-110", "+150"
  units numeric(3,1) NOT NULL DEFAULT 1.0,

  -- Agent reasoning
  confidence integer NOT NULL CHECK (confidence >= 1 AND confidence <= 5),
  reasoning_text text NOT NULL,
  key_factors jsonb,  -- ["model shows 58% edge", "public on other side"]

  -- Snapshot of data at pick time (for historical accuracy)
  archived_game_data jsonb NOT NULL,
  archived_personality jsonb NOT NULL,

  -- Result (filled in by grading)
  result text CHECK (result IN ('won', 'lost', 'push', 'pending')) DEFAULT 'pending',
  actual_result text,  -- "Bills 27, Chiefs 24"
  graded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate picks for same game/bet type
  CONSTRAINT unique_avatar_pick UNIQUE (avatar_id, game_id, bet_type)
);

-- Indexes for avatar_picks
CREATE INDEX IF NOT EXISTS idx_avatar_picks_avatar ON public.avatar_picks(avatar_id);
CREATE INDEX IF NOT EXISTS idx_avatar_picks_date ON public.avatar_picks(game_date);
CREATE INDEX IF NOT EXISTS idx_avatar_picks_pending ON public.avatar_picks(result) WHERE result = 'pending';
CREATE INDEX IF NOT EXISTS idx_avatar_picks_sport ON public.avatar_picks(sport);

-- ============================================================================
-- TABLE: avatar_performance_cache
-- Cached W-L-P stats for fast leaderboard queries
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.avatar_performance_cache (
  avatar_id uuid PRIMARY KEY REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,

  -- Overall stats
  total_picks integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  pushes integer NOT NULL DEFAULT 0,
  pending integer NOT NULL DEFAULT 0,
  win_rate numeric(5,4),  -- 0.5833
  net_units numeric(8,2) NOT NULL DEFAULT 0.00,

  -- Streaks
  current_streak integer NOT NULL DEFAULT 0,  -- positive = wins, negative = losses
  best_streak integer NOT NULL DEFAULT 0,
  worst_streak integer NOT NULL DEFAULT 0,

  -- By sport (JSONB for flexibility)
  stats_by_sport jsonb DEFAULT '{}'::jsonb,
  -- Example: {"nfl": {"wins": 5, "losses": 3, "net_units": 2.5}, ...}

  -- By bet type
  stats_by_bet_type jsonb DEFAULT '{}'::jsonb,
  -- Example: {"spread": {"wins": 8, "losses": 6}, "moneyline": {...}}

  last_calculated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLE: user_avatar_follows
-- Follow system for public agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_avatar_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  notify_on_pick boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, avatar_id)
);

-- Indexes for user_avatar_follows
CREATE INDEX IF NOT EXISTS idx_avatar_follows_user ON public.user_avatar_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_follows_avatar ON public.user_avatar_follows(avatar_id);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.avatar_profiles IS 'AI betting agent configurations with personality parameters';
COMMENT ON TABLE public.preset_archetypes IS 'Pre-configured agent templates for quick setup';
COMMENT ON TABLE public.avatar_picks IS 'Picks made by agents with archived data for historical accuracy';
COMMENT ON TABLE public.avatar_performance_cache IS 'Cached performance stats for fast leaderboard queries';
COMMENT ON TABLE public.user_avatar_follows IS 'Follow relationships for public agents';
