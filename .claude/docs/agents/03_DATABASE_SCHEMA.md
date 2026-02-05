# Database Schema (Supabase)

## Design Approach: Hybrid (Columns + JSONB)

We use a **hybrid approach**:
- **Columns** for identity fields (queryable, rarely change)
- **JSONB** for personality params (flexible, evolves, loaded as unit)
- **JSONB** for custom insights (user text inputs)

This allows the personality system to evolve without database migrations.

---

## Tables Overview

| Table | Purpose |
|-------|---------|
| `avatar_profiles` | Core agent config (identity + JSONB params) |
| `avatar_picks` | Picks made by agents |
| `avatar_performance_cache` | Cached W-L-P stats |
| `user_avatar_follows` | Follow system for public agents |
| `preset_archetypes` | Pre-configured agent templates |

---

## `avatar_profiles` - Core Agent Configuration

```sql
CREATE TABLE public.avatar_profiles (
  -- ═══════════════════════════════════════════════════════════════════
  -- IDENTITY (columns - queryable, rarely change)
  -- ═══════════════════════════════════════════════════════════════════
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '🎯',
  avatar_color text NOT NULL DEFAULT '#6366f1',
  preferred_sports text[] NOT NULL DEFAULT ARRAY['nfl'],
  archetype text,  -- 'contrarian', 'chalk_grinder', 'plus_money_hunter', etc.

  -- ═══════════════════════════════════════════════════════════════════
  -- PERSONALITY PARAMS (JSONB - flexible, evolves without migrations)
  -- See 02_PERSONALITY_PARAMS.md for full interface
  -- ═══════════════════════════════════════════════════════════════════
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
  }',

  -- ═══════════════════════════════════════════════════════════════════
  -- CUSTOM INSIGHTS (JSONB - user's free-text inputs)
  -- ═══════════════════════════════════════════════════════════════════
  custom_insights jsonb DEFAULT '{
    "betting_philosophy": null,
    "perceived_edges": null,
    "avoid_situations": null,
    "target_situations": null
  }',

  -- ═══════════════════════════════════════════════════════════════════
  -- META
  -- ═══════════════════════════════════════════════════════════════════
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- ═══════════════════════════════════════════════════════════════════
  -- AUTO-GENERATION (for daily automatic pick delivery)
  -- ═══════════════════════════════════════════════════════════════════
  auto_generate boolean NOT NULL DEFAULT true,           -- User can toggle off
  last_generated_at timestamptz,                         -- Last manual OR auto generation
  last_auto_generated_at timestamptz,                    -- Last auto-generation specifically
  owner_last_active_at timestamptz DEFAULT now(),        -- Track user activity for pause logic

  CONSTRAINT unique_avatar_name_per_user UNIQUE (user_id, name)
);

-- Indexes
CREATE INDEX idx_avatar_profiles_user ON avatar_profiles(user_id);
CREATE INDEX idx_avatar_profiles_public ON avatar_profiles(is_public) WHERE is_public = true;
CREATE INDEX idx_avatar_profiles_archetype ON avatar_profiles(archetype);
CREATE INDEX idx_avatar_profiles_auto_gen ON avatar_profiles(auto_generate, is_active, last_auto_generated_at)
  WHERE auto_generate = true AND is_active = true;  -- For daily auto-generation query

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER avatar_profiles_updated_at
  BEFORE UPDATE ON avatar_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### `personality_params` JSONB Structure

All 27 structured parameters stored in JSONB:

```typescript
interface PersonalityParams {
  // Core Personality (always present)
  risk_tolerance: 1 | 2 | 3 | 4 | 5;
  underdog_lean: 1 | 2 | 3 | 4 | 5;
  over_under_lean: 1 | 2 | 3 | 4 | 5;
  confidence_threshold: 1 | 2 | 3 | 4 | 5;
  chase_value: boolean;

  // Bet Selection (always present)
  preferred_bet_type: 'spread' | 'moneyline' | 'total' | 'any';
  max_favorite_odds: number | null;
  min_underdog_odds: number | null;
  max_picks_per_day: 1 | 2 | 3 | 4 | 5;
  skip_weak_slates: boolean;

  // Data Trust (always present)
  trust_model: 1 | 2 | 3 | 4 | 5;
  trust_polymarket: 1 | 2 | 3 | 4 | 5;
  polymarket_divergence_flag: boolean;

  // NFL/CFB only (optional)
  fade_public?: boolean;
  public_threshold?: 1 | 2 | 3 | 4 | 5;
  weather_impacts_totals?: boolean;
  weather_sensitivity?: 1 | 2 | 3 | 4 | 5;

  // NBA/NCAAB only (optional)
  trust_team_ratings?: 1 | 2 | 3 | 4 | 5;
  pace_affects_totals?: boolean;

  // NBA only (optional)
  weight_recent_form?: 1 | 2 | 3 | 4 | 5;
  ride_hot_streaks?: boolean;
  fade_cold_streaks?: boolean;
  trust_ats_trends?: boolean;
  regress_luck?: boolean;

  // Situational (conditional)
  home_court_boost: 1 | 2 | 3 | 4 | 5;
  fade_back_to_backs?: boolean;
  upset_alert?: boolean;
}
```

### `custom_insights` JSONB Structure

```typescript
interface CustomInsights {
  betting_philosophy: string | null;  // max 500 chars
  perceived_edges: string | null;     // max 500 chars
  avoid_situations: string | null;    // max 300 chars
  target_situations: string | null;   // max 300 chars
}
```

---

## `preset_archetypes` - Agent Templates

```sql
CREATE TABLE public.preset_archetypes (
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

-- Seed data added via migration
```

---

## `avatar_picks` - Picks Made by Agents

```sql
CREATE TABLE public.avatar_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id uuid NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,

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

  -- Snapshot of data at pick time
  archived_game_data jsonb NOT NULL,
  archived_personality jsonb NOT NULL,

  -- Result (filled in by grading)
  result text CHECK (result IN ('won', 'lost', 'push', 'pending')) DEFAULT 'pending',
  actual_result text,  -- "Bills 27, Chiefs 24"
  graded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_avatar_pick UNIQUE (avatar_id, game_id, bet_type)
);

-- Indexes
CREATE INDEX idx_avatar_picks_avatar ON avatar_picks(avatar_id);
CREATE INDEX idx_avatar_picks_date ON avatar_picks(game_date);
CREATE INDEX idx_avatar_picks_pending ON avatar_picks(result) WHERE result = 'pending';
CREATE INDEX idx_avatar_picks_sport ON avatar_picks(sport);
```

---

## `avatar_performance_cache` - Cached Stats

```sql
CREATE TABLE public.avatar_performance_cache (
  avatar_id uuid PRIMARY KEY REFERENCES avatar_profiles(id) ON DELETE CASCADE,

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

  -- By sport
  stats_by_sport jsonb DEFAULT '{}',
  -- Example: {"nfl": {"wins": 5, "losses": 3, "net_units": 2.5}, ...}

  -- By bet type
  stats_by_bet_type jsonb DEFAULT '{}',
  -- Example: {"spread": {"wins": 8, "losses": 6}, "moneyline": {...}}

  last_calculated_at timestamptz NOT NULL DEFAULT now()
);

-- Function to recalculate cache
CREATE OR REPLACE FUNCTION recalculate_avatar_performance(p_avatar_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO avatar_performance_cache (avatar_id, total_picks, wins, losses, pushes, pending, win_rate, net_units, last_calculated_at)
  SELECT
    p_avatar_id,
    COUNT(*),
    COUNT(*) FILTER (WHERE result = 'won'),
    COUNT(*) FILTER (WHERE result = 'lost'),
    COUNT(*) FILTER (WHERE result = 'push'),
    COUNT(*) FILTER (WHERE result = 'pending'),
    CASE
      WHEN COUNT(*) FILTER (WHERE result IN ('won', 'lost')) > 0
      THEN COUNT(*) FILTER (WHERE result = 'won')::numeric / COUNT(*) FILTER (WHERE result IN ('won', 'lost'))
      ELSE NULL
    END,
    COALESCE(SUM(
      CASE
        WHEN result = 'won' THEN units * 1.0  -- Simplified, actual calc depends on odds
        WHEN result = 'lost' THEN -units
        ELSE 0
      END
    ), 0),
    now()
  FROM avatar_picks
  WHERE avatar_id = p_avatar_id
  ON CONFLICT (avatar_id) DO UPDATE SET
    total_picks = EXCLUDED.total_picks,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    pushes = EXCLUDED.pushes,
    pending = EXCLUDED.pending,
    win_rate = EXCLUDED.win_rate,
    net_units = EXCLUDED.net_units,
    last_calculated_at = EXCLUDED.last_calculated_at;
END;
$$ LANGUAGE plpgsql;
```

---

## `user_avatar_follows` - Follow System

```sql
CREATE TABLE public.user_avatar_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  notify_on_pick boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, avatar_id)
);

-- Indexes
CREATE INDEX idx_avatar_follows_user ON user_avatar_follows(user_id);
CREATE INDEX idx_avatar_follows_avatar ON user_avatar_follows(avatar_id);
```

---

## Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_performance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_avatar_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_archetypes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- avatar_profiles
-- ═══════════════════════════════════════════════════════════════════

-- Users can CRUD their own avatars
CREATE POLICY "Users can manage own avatars" ON avatar_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Anyone can read public avatars
CREATE POLICY "Anyone can read public avatars" ON avatar_profiles
  FOR SELECT USING (is_public = true);

-- ═══════════════════════════════════════════════════════════════════
-- avatar_picks
-- ═══════════════════════════════════════════════════════════════════

-- Users can read their own avatar's picks
CREATE POLICY "Users can read own avatar picks" ON avatar_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
      AND avatar_profiles.user_id = auth.uid()
    )
  );

-- Anyone can read picks from public avatars
CREATE POLICY "Anyone can read public avatar picks" ON avatar_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM avatar_profiles
      WHERE avatar_profiles.id = avatar_picks.avatar_id
      AND avatar_profiles.is_public = true
    )
  );

-- Service role inserts picks (edge function)
-- Note: Use service_role key in edge function, bypasses RLS

-- ═══════════════════════════════════════════════════════════════════
-- avatar_performance_cache
-- ═══════════════════════════════════════════════════════════════════

-- Anyone can read (for leaderboard)
CREATE POLICY "Anyone can read performance cache" ON avatar_performance_cache
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- user_avatar_follows
-- ═══════════════════════════════════════════════════════════════════

-- Users can manage their own follows
CREATE POLICY "Users can manage own follows" ON user_avatar_follows
  FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- preset_archetypes
-- ═══════════════════════════════════════════════════════════════════

-- Anyone can read presets
CREATE POLICY "Anyone can read preset archetypes" ON preset_archetypes
  FOR SELECT USING (is_active = true);
```

---

## Auto-Generation Logic

The `auto_generate` feature runs daily via pg_cron:

```sql
-- Query to find agents eligible for auto-generation
SELECT ap.*
FROM avatar_profiles ap
WHERE ap.auto_generate = true
  AND ap.is_active = true
  AND (ap.last_auto_generated_at IS NULL OR ap.last_auto_generated_at::date < CURRENT_DATE)
  AND ap.owner_last_active_at > now() - interval '5 days';  -- Pause if user inactive
```

**Activity Tracking**: The `owner_last_active_at` timestamp is updated when:
1. User opens the app (AppState foreground event)
2. User logs in
3. User views their agent detail screen

This ensures we don't waste resources generating picks for users who haven't used the app recently.

---

## Validation Notes

Since `personality_params` is JSONB, validation happens at the **application level**:

1. **TypeScript interface** - Primary validation via types
2. **Zod schema** - Runtime validation before insert/update
3. **Edge function** - Validates before generating picks

```typescript
// Example Zod schema for validation
const PersonalityParamsSchema = z.object({
  risk_tolerance: z.number().min(1).max(5),
  underdog_lean: z.number().min(1).max(5),
  // ... etc
});

// Validate before saving
const validated = PersonalityParamsSchema.parse(params);
```

---

## Migration Files

1. `YYYYMMDD_001_create_avatar_tables.sql` - Create all tables
2. `YYYYMMDD_002_create_rls_policies.sql` - Create RLS policies
3. `YYYYMMDD_003_seed_preset_archetypes.sql` - Seed archetype data
4. `YYYYMMDD_004_create_functions.sql` - Create helper functions
