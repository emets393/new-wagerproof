-- ============================================================================
-- Migration: Parlay storage for V3 agents (Part B)
--
-- New tables (avatar_picks is left untouched — reusing it would force relaxing
-- its UNIQUE(avatar_id,game_id,bet_type) key and the per-row payout RPC, both
-- load-bearing for the live straights path). A parlay is one staked ticket
-- (avatar_parlays) with N legs (avatar_parlay_legs). Single- or multi-sport
-- (sport='multi'). Push-leg handling = drop & re-price at grade time.
--
-- RLS mirrors avatar_picks: owner reads always; anyone reads picks of a public
-- agent. Writes happen via the service role / SECURITY DEFINER (RLS not needed
-- for inserts). See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md (Part B).
-- ============================================================================

-- 1. The ticket -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.avatar_parlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id uuid NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,

  sport text NOT NULL CHECK (sport IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb', 'multi')),  -- 'multi' = cross-sport
  legs_count integer NOT NULL CHECK (legs_count >= 2),
  combined_odds text,            -- American; product of leg decimal odds, recomputed if a leg pushes
  units numeric(3,1) NOT NULL DEFAULT 1.0,   -- one stake for the whole ticket

  confidence integer NOT NULL CHECK (confidence >= 1 AND confidence <= 5),
  reasoning_text text NOT NULL,
  key_factors jsonb,

  -- Audit (parity with avatar_picks)
  ai_decision_trace jsonb,
  ai_audit_payload jsonb,
  archived_personality jsonb NOT NULL,

  -- Result (filled by grading; drop & re-price on a pushed leg)
  result text CHECK (result IN ('won', 'lost', 'push', 'pending')) DEFAULT 'pending',
  actual_result text,            -- human-readable settle, e.g. "2/3 legs hit, 1 push"
  graded_at timestamptz,

  target_date date,              -- the run's slate date (manual-regen dedup + display)
  is_auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. The legs ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.avatar_parlay_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_id uuid NOT NULL REFERENCES public.avatar_parlays(id) ON DELETE CASCADE,

  game_id text NOT NULL,
  sport text NOT NULL CHECK (sport IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb')),
  matchup text NOT NULL,
  game_date date NOT NULL,

  bet_type text NOT NULL CHECK (bet_type IN ('spread', 'moneyline', 'total', 'prop')),  -- 'prop' = signal-backed player prop; player/market/line/dir live in archived_game_data
  period text NOT NULL DEFAULT 'full' CHECK (period IN ('full', 'f5', 'h1')),
  pick_selection text NOT NULL,
  odds text,                     -- individual leg American odds

  archived_game_data jsonb NOT NULL,

  leg_result text CHECK (leg_result IN ('won', 'lost', 'push', 'pending')) DEFAULT 'pending',
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_avatar_parlays_avatar ON public.avatar_parlays(avatar_id);
CREATE INDEX IF NOT EXISTS idx_avatar_parlays_avatar_date ON public.avatar_parlays(avatar_id, target_date);  -- manual-regen dedup
CREATE INDEX IF NOT EXISTS idx_avatar_parlay_legs_parlay ON public.avatar_parlay_legs(parlay_id);
CREATE INDEX IF NOT EXISTS idx_avatar_parlay_legs_game ON public.avatar_parlay_legs(game_id);  -- grading lookups

-- 4. RLS (mirrors avatar_picks: owner read + public-agent read) --------------
ALTER TABLE public.avatar_parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_parlay_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own avatar parlays"
  ON public.avatar_parlays FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.avatar_profiles
    WHERE avatar_profiles.id = avatar_parlays.avatar_id
      AND avatar_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can read public avatar parlays"
  ON public.avatar_parlays FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.avatar_profiles
    WHERE avatar_profiles.id = avatar_parlays.avatar_id
      AND avatar_profiles.is_public = true
  ));

-- Legs inherit visibility through their parent parlay's avatar.
CREATE POLICY "Owners can read own avatar parlay legs"
  ON public.avatar_parlay_legs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.avatar_parlays p
    JOIN public.avatar_profiles ap ON ap.id = p.avatar_id
    WHERE p.id = avatar_parlay_legs.parlay_id
      AND ap.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can read public avatar parlay legs"
  ON public.avatar_parlay_legs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.avatar_parlays p
    JOIN public.avatar_profiles ap ON ap.id = p.avatar_id
    WHERE p.id = avatar_parlay_legs.parlay_id
      AND ap.is_public = true
  ));
