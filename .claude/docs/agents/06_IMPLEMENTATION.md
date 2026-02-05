# Agent Implementation Plan

## Master To-Do List

Ordered implementation checklist. Each task should be completable independently.

---

## Critical Specifications (Must Define Before Implementation)

### Rate Limiting
- **Limit**: 1 pick generation per agent per hour
- **Storage**: Track `last_generated_at` timestamp in `avatar_profiles`
- **Error**: Return `429 Too Many Requests` with cooldown remaining
- **Bypass**: None (even for premium users)

### Weak Slate Definition
- **Threshold**: Less than 3 games for a given sport on that day
- **Behavior**: If `skip_weak_slates=true` AND games < 3, return empty picks with message "No strong plays on today's slate"
- **Multi-sport**: Evaluate per-sport; agent with NFL+NBA might skip NFL (2 games) but generate NBA (8 games)

### Grading Logic

| Bet Type | Won | Lost | Push |
|----------|-----|------|------|
| **Spread** | `picked_team_margin > -spread` | `picked_team_margin < -spread` | `picked_team_margin == -spread` |
| **Moneyline** | `picked_team won game` | `picked_team lost game` | N/A (ties rare, handle as push) |
| **Total (Over)** | `actual_total > line` | `actual_total < line` | `actual_total == line` |
| **Total (Under)** | `actual_total < line` | `actual_total > line` | `actual_total == line` |

**Net Units Calculation:**
```
if (result === 'won') {
  if (odds < 0) return 100 / Math.abs(odds);  // -110 → +0.91 units
  else return odds / 100;                      // +150 → +1.50 units
}
if (result === 'lost') return -1;  // Always lose 1 unit
if (result === 'push') return 0;
```

### Data Availability Limitations

| Sport | Available Data | NOT Available |
|-------|----------------|---------------|
| **NFL** | Model predictions, weather, public betting | Team ratings, trends, streaks |
| **CFB** | Model predictions, weather, public betting | Team ratings, trends, streaks |
| **NBA** | Model predictions, team ratings, L3/L5 trends, streaks, ATS%, luck | Weather (N/A) |
| **NCAAB** | Model predictions, team ratings, rankings | Trends, streaks, Polymarket (limited) |

**Prompt Handling**: If agent has a param for unavailable data (e.g., `ride_hot_streaks` for NFL agent), the prompt builder will note: "Note: Streak data not available for NFL. This preference will be applied when data permits."

---

## Phase 0: Specification Documents

### 0.1 Pre-Implementation Docs
- [ ] **Task 0.1.1**: Create `08_PROMPT_MAPPING.md`
  - How each personality param translates to AI instructions
  - Example prompts for each archetype
  - Sport-specific prompt variations
  - See detailed spec below

---

## Phase 1: Database Foundation

### 1.1 Create Database Tables
- [ ] **Task 1.1.1**: Write migration `001_create_avatar_tables.sql`
  - `avatar_profiles` (identity columns + JSONB params)
  - `avatar_picks` (picks with archived data)
  - `avatar_performance_cache` (W-L-P stats)
  - `user_avatar_follows` (follow system)
  - `preset_archetypes` (agent templates)

- [ ] **Task 1.1.2**: Write migration `002_create_rls_policies.sql`
  - Enable RLS on all tables
  - Owner CRUD policies for avatar_profiles
  - Public read policies for public avatars
  - Service role write for picks

- [ ] **Task 1.1.3**: Write migration `003_create_functions.sql`
  - `update_updated_at()` trigger function
  - `recalculate_avatar_performance()` function

- [ ] **Task 1.1.4**: Write migration `004_seed_preset_archetypes.sql`
  - Seed 8 preset archetypes with full personality_params
  - Include: contrarian, chalk_grinder, plus_money_hunter, model_truther, polymarket_prophet, momentum_rider, weather_watcher, the_analyst

- [ ] **Task 1.1.5**: Run migrations and verify tables created

### 1.2 TypeScript Types
- [ ] **Task 1.2.1**: Create `/wagerproof-mobile/types/agent.ts`
  - `AgentProfile` interface
  - `PersonalityParams` interface
  - `CustomInsights` interface
  - `AgentPick` interface
  - `AgentPerformance` interface
  - `PresetArchetype` interface

- [ ] **Task 1.2.2**: Create Zod validation schemas
  - `PersonalityParamsSchema` for runtime validation
  - `CustomInsightsSchema` with char limits

---

## Phase 2: Agent Service Layer

### 2.1 Core Service
- [ ] **Task 2.1.1**: Create `/wagerproof-mobile/services/agentService.ts`
  - `fetchUserAgents(userId)` - Get user's agents
  - `fetchAgentById(agentId)` - Get single agent
  - `createAgent(userId, data)` - Create new agent
  - `updateAgent(agentId, data)` - Update agent
  - `deleteAgent(agentId)` - Soft delete agent
  - `fetchPresetArchetypes()` - Get preset templates

- [ ] **Task 2.1.2**: Create `/wagerproof-mobile/services/agentPicksService.ts`
  - `fetchAgentPicks(agentId, filters)` - Get picks with filters
  - `fetchPendingPicks(agentId)` - Get ungraded picks
  - `fetchPicksByDate(agentId, date)` - Get picks for date

- [ ] **Task 2.1.3**: Create `/wagerproof-mobile/services/agentPerformanceService.ts`
  - `fetchAgentPerformance(agentId)` - Get cached stats
  - `fetchLeaderboard(limit, sport?)` - Get top agents

### 2.2 React Query Hooks
- [ ] **Task 2.2.1**: Create `/wagerproof-mobile/hooks/useAgents.ts`
  - `useUserAgents()` - Fetch user's agents
  - `useAgent(agentId)` - Fetch single agent
  - `useCreateAgent()` - Mutation for creation
  - `useUpdateAgent()` - Mutation for updates
  - `useDeleteAgent()` - Mutation for deletion

- [ ] **Task 2.2.2**: Create `/wagerproof-mobile/hooks/useAgentPicks.ts`
  - `useAgentPicks(agentId)` - Fetch picks
  - `useTodaysPicks(agentId)` - Fetch today's picks
  - `useGeneratePicks(agentId)` - Trigger pick generation

- [ ] **Task 2.2.3**: Create `/wagerproof-mobile/hooks/usePresetArchetypes.ts`
  - `usePresetArchetypes()` - Fetch all presets

---

## Phase 3: Agent Creation Flow (Mobile)

> **UX Decision**: Consolidated from 11 steps to 6 grouped screens to reduce drop-off.

### 3.1 Creation Screen
- [ ] **Task 3.1.1**: Create `/wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx`
  - 6-screen wizard with progress indicator (dots, not stepper)
  - Swipe navigation + Next/Back buttons
  - Form state persisted across screens
  - Save/cancel handlers

### 3.2 Screen Components (6 Total)

- [ ] **Task 3.2.1**: Create `Screen1_SportArchetype.tsx`
  - **Part A**: Multi-select chips for NFL, CFB, NBA, NCAAB (at least 1 required)
  - **Part B**: Archetype grid (8 presets + "Start from scratch")
  - Auto-fills all params when archetype selected
  - Users can customize in later screens

- [ ] **Task 3.2.2**: Create `Screen2_Identity.tsx`
  - Name input (required, unique per user)
  - Emoji picker grid (32 options)
  - Color picker (8 preset colors)

- [ ] **Task 3.2.3**: Create `Screen3_Personality.tsx`
  - **Groups all core personality + bet selection params**:
  - risk_tolerance (slider 1-5)
  - underdog_lean (slider 1-5)
  - over_under_lean (slider 1-5)
  - confidence_threshold (slider 1-5)
  - chase_value (toggle)
  - preferred_bet_type (radio: spread/ML/total/any)
  - max_picks_per_day (slider 1-5)
  - skip_weak_slates (toggle)
  - Scrollable card layout

- [ ] **Task 3.2.4**: Create `Screen4_DataAndConditions.tsx`
  - **Data Trust Section**:
    - trust_model (slider)
    - trust_polymarket (slider)
    - polymarket_divergence_flag (toggle)
  - **Conditional: If NFL/CFB selected**:
    - fade_public (toggle)
    - public_threshold (slider, shown if fade_public=true)
    - weather_impacts_totals (toggle)
    - weather_sensitivity (slider, shown if weather_impacts_totals=true)
  - **Conditional: If NBA/NCAAB selected**:
    - trust_team_ratings (slider)
    - pace_affects_totals (toggle)
  - **Conditional: If NBA selected**:
    - weight_recent_form (slider)
    - ride_hot_streaks, fade_cold_streaks (toggles)
    - trust_ats_trends, regress_luck (toggles)
  - **Situational (always)**:
    - home_court_boost (slider)
    - fade_back_to_backs (toggle, if NBA/NCAAB)
    - upset_alert (toggle, if NCAAB)
  - **Odds Limits Section**:
    - max_favorite_odds (input)
    - min_underdog_odds (input)

- [ ] **Task 3.2.5**: Create `Screen5_CustomInsights.tsx`
  - 4 collapsible text areas:
    - betting_philosophy (500 chars)
    - perceived_edges (500 chars)
    - avoid_situations (300 chars)
    - target_situations (300 chars)
  - Helper text + examples for each
  - All optional

- [ ] **Task 3.2.6**: Create `Screen6_Review.tsx`
  - Agent preview card (emoji, name, color)
  - Sports badges
  - Key personality summary (3-5 bullet points)
  - "This agent will..." description
  - Confirm button → Creates agent

### 3.3 Shared Components
- [ ] **Task 3.3.1**: Create `SliderInput.tsx`
  - 1-5 scale with semantic labels (e.g., "Conservative" to "Aggressive")
  - Haptic feedback on value change

- [ ] **Task 3.3.2**: Create `ToggleInput.tsx`
  - Boolean toggle with label and optional description

- [ ] **Task 3.3.3**: Create `OddsInput.tsx`
  - American odds input (-500 to +500)
  - "No limit" chip option
  - Validation for valid odds values

- [ ] **Task 3.3.4**: Create `ArchetypeCard.tsx`
  - Emoji, name, 1-line description
  - Recommended sports badges
  - Selected state with checkmark

---

## Phase 4: Agent Hub & List

### 4.1 Hub Screen
- [ ] **Task 4.1.1**: Create `/wagerproof-mobile/app/(drawer)/(tabs)/agents/index.tsx`
  - "My Agents" list
  - "Create Agent" FAB
  - Empty state for no agents

- [ ] **Task 4.1.2**: Create `AgentCard.tsx`
  - Emoji, name, sports badges
  - W-L-P record
  - Net units (+/-)
  - Current streak
  - Tap to view detail

### 4.2 Navigation Updates
- [ ] **Task 4.2.1**: Update tab layout
  - Rename "Picks" tab → "Agents"
  - Update icon to brain icon
  - Route to agents/index

---

## Phase 5: Agent Detail Screen

### 5.1 Detail Screen
- [ ] **Task 5.1.1**: Create `/wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/index.tsx`
  - Agent header (emoji, name, stats)
  - "Generate Picks" button
  - Picks list (today + history)
  - Settings button

### 5.2 Pick Components
- [ ] **Task 5.2.1**: Create `AgentPickCard.tsx`
  - Matchup, bet type, selection
  - Confidence level (1-5 dots)
  - Reasoning text (expandable)
  - Result badge (W/L/P/Pending)

- [ ] **Task 5.2.2**: Create `ThinkingAnimation.tsx`
  - Animated "thinking" state
  - Fake typing effect for reasoning
  - Progress stages

---

## Phase 6: Pick Generation Edge Function

### 6.1 Edge Function
- [ ] **Task 6.1.1**: Create `/supabase/functions/generate-avatar-picks/index.ts`
  - **Rate Limiting**: Check `last_generated_at` - reject if < 1 hour ago
  - **Validation**: Verify agent ownership via auth
  - Fetch agent profile + personality_params
  - Fetch games for selected sports from CFB Supabase
  - Apply weak slate logic (skip if < 3 games AND skip_weak_slates=true)
  - Build game payloads (reuse existing builders from `generate-page-level-analysis`)
  - Call OpenAI with personality-aware prompt
  - Parse and validate response with Zod
  - Insert picks into avatar_picks with archived snapshots
  - Update `last_generated_at` on avatar_profiles
  - Return picks to client

- [ ] **Task 6.1.2**: Create `/supabase/functions/generate-avatar-picks/promptBuilder.ts`
  - Import personality→prompt mappings from `08_PROMPT_MAPPING.md`
  - Build system prompt with agent persona
  - Inject personality params as natural language instructions
  - Inject custom_insights verbatim
  - Add sport-specific context based on selected sports
  - Handle unavailable data gracefully (note in prompt)
  - Output format schema with examples

- [ ] **Task 6.1.3**: Create `/supabase/functions/generate-avatar-picks/pickSchema.ts`
  - Zod schema for structured output:
    ```typescript
    {
      picks: [{
        game_id: string,
        bet_type: 'spread' | 'moneyline' | 'total',
        selection: string,  // "Bills -1.5", "Chiefs +150", "Over 48.5"
        odds: string,
        confidence: 1-5,
        reasoning: string,  // 2-3 sentences
        key_factors: string[]  // 3-5 bullet points
      }]
    }
    ```

- [ ] **Task 6.1.4**: Create rate limit helper
  - `checkRateLimit(avatarId)` → returns { allowed: boolean, cooldownSeconds: number }
  - Update timestamp on successful generation

### 6.2 Integration
- [ ] **Task 6.2.1**: Wire up "Generate Picks" button
  - Disable button if picks already generated today
  - Show cooldown timer if rate limited
  - Call edge function
  - Show thinking animation with stages
  - Display results with typewriter effect
  - Handle errors gracefully (network, rate limit, no plays)

---

## Phase 7: Pick Grading

### 7.1 Grading Edge Function
- [ ] **Task 7.1.1**: Create `/supabase/functions/grade-avatar-picks/index.ts`
  - Fetch all pending picks where `game_date <= today`
  - For each pick, fetch final score from live scores service
  - Skip if game status !== 'final'
  - Apply grading logic (see Critical Specifications above):
    - **Spread**: Compare actual margin to spread line
    - **Moneyline**: Check if picked team won
    - **Total**: Compare actual total to line
  - Update `avatar_picks.result` = 'won' | 'lost' | 'push'
  - Update `avatar_picks.actual_result` = "Bills 27, Chiefs 24"
  - Update `avatar_picks.graded_at` = now()
  - Call `recalculate_avatar_performance(avatar_id)` for each affected agent

- [ ] **Task 7.1.2**: Create grading helper functions
  - `gradeSpread(pickSelection, homeScore, awayScore)` → result
  - `gradeMoneyline(pickedTeam, homeTeam, homeScore, awayScore)` → result
  - `gradeTotal(overUnder, line, homeScore, awayScore)` → result
  - Handle half-point lines (no push possible)

### 7.2 CRON Setup
- [ ] **Task 7.2.1**: Set up pg_cron job for grading
  - Run every hour between 10pm-2am ET (when most games end)
  - Run every 2 hours otherwise
  - Call grade-avatar-picks function via HTTP

---

## Phase 7.5: Automatic Pick Delivery (Daily Generation)

> **Feature**: Agents automatically generate picks each day so users have fresh picks waiting when they open the app.

### 7.5.1 Database Changes
- [ ] **Task 7.5.1.1**: Add columns to `avatar_profiles`
  ```sql
  ALTER TABLE avatar_profiles ADD COLUMN auto_generate boolean DEFAULT true;
  ALTER TABLE avatar_profiles ADD COLUMN last_auto_generated_at timestamptz;
  ALTER TABLE avatar_profiles ADD COLUMN owner_last_active_at timestamptz;
  ```

- [ ] **Task 7.5.1.2**: Create activity tracking
  - Update `owner_last_active_at` on any app open (via auth session refresh or explicit call)
  - Track in `user_profiles` or via Supabase auth metadata

### 7.5.2 Auto-Generation Edge Function
- [ ] **Task 7.5.2.1**: Create `/supabase/functions/auto-generate-avatar-picks/index.ts`
  - Fetch all agents where:
    - `auto_generate = true`
    - `is_active = true`
    - `last_auto_generated_at < today` (haven't generated today)
    - `owner_last_active_at > now() - interval '5 days'` (user active recently)
  - For each eligible agent:
    - Check if games exist for agent's sports today
    - Skip if weak slate AND skip_weak_slates=true
    - Call internal generate logic (same as manual generation)
    - Update `last_auto_generated_at = now()`
  - Log results for monitoring

- [ ] **Task 7.5.2.2**: Set up pg_cron job for auto-generation
  - Run daily at 9am ET (before most games)
  - Also run at 6pm ET for evening slates
  - Call auto-generate-avatar-picks function

### 7.5.3 Activity Tracking
- [ ] **Task 7.5.3.1**: Create `/wagerproof-mobile/services/activityService.ts`
  - `trackAppOpen()` - Called on app foreground
  - Updates `owner_last_active_at` for user's agents
  - Debounce to once per hour

- [ ] **Task 7.5.3.2**: Wire up activity tracking
  - Call on app state change (AppState listener)
  - Call on successful auth

### 7.5.4 Settings UI
- [ ] **Task 7.5.4.1**: Add auto-generate toggle to agent settings
  - "Automatically generate picks daily"
  - Default: ON
  - Explain: "Your agent will generate picks each morning. Paused if you haven't opened the app in 5 days."

### 7.5.5 Notification (Future)
- [ ] **Task 7.5.5.1**: (Optional) Push notification when auto-picks ready
  - "🎯 Your agent has 3 picks ready for today!"
  - Requires push notification setup

---

## Phase 8: Agent Settings Screen

### 8.1 Settings Screen
- [ ] **Task 8.1.1**: Create `/wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/settings.tsx`
  - All personality params editable
  - Organized by section (collapsible)
  - Save/discard buttons
  - Delete agent option

### 8.2 Settings Components
- [ ] **Task 8.2.1**: Create `SettingsSection.tsx`
  - Collapsible section with header

- [ ] **Task 8.2.2**: Reuse step components as settings editors

---

## Phase 9: Public Leaderboard

### 9.1 Leaderboard
- [ ] **Task 9.1.1**: Add "Make Public" toggle to settings
- [ ] **Task 9.1.2**: Create leaderboard view
  - Ranked by net units
  - Filter by sport
  - Tap to view public agent

### 9.2 Public Agent View
- [ ] **Task 9.2.1**: Create `/wagerproof-mobile/app/(drawer)/(tabs)/agents/public/[id].tsx`
  - Read-only agent detail
  - Follow button
  - View picks history

---

## Phase 10: Polish & Testing

### 10.1 Testing
- [ ] **Task 10.1.1**: Test agent creation flow end-to-end
- [ ] **Task 10.1.2**: Test pick generation with different personalities
- [ ] **Task 10.1.3**: Test grading accuracy
- [ ] **Task 10.1.4**: Test leaderboard ranking

### 10.2 Polish
- [ ] **Task 10.2.1**: Add loading states
- [ ] **Task 10.2.2**: Add error handling
- [ ] **Task 10.2.3**: Add haptic feedback
- [ ] **Task 10.2.4**: Optimize performance

---

## File Summary

### Documentation (1 file)
```
/.claude/docs/agents/
└── 08_PROMPT_MAPPING.md  (NEW)
```

### Database (4 files)
```
/supabase/migrations/
├── YYYYMMDD_001_create_avatar_tables.sql
├── YYYYMMDD_002_create_rls_policies.sql
├── YYYYMMDD_003_create_functions.sql
└── YYYYMMDD_004_seed_preset_archetypes.sql
```

### Edge Functions (4 files)
```
/supabase/functions/
├── generate-avatar-picks/
│   ├── index.ts
│   ├── promptBuilder.ts
│   └── pickSchema.ts
├── grade-avatar-picks/index.ts
└── auto-generate-avatar-picks/index.ts  (NEW - daily auto-gen)
```

### Mobile Types (1 file)
```
/wagerproof-mobile/types/
└── agent.ts
```

### Mobile Services (4 files)
```
/wagerproof-mobile/services/
├── agentService.ts
├── agentPicksService.ts
├── agentPerformanceService.ts
└── activityService.ts  (NEW - tracks user activity for auto-gen)
```

### Mobile Hooks (3 files)
```
/wagerproof-mobile/hooks/
├── useAgents.ts
├── useAgentPicks.ts
└── usePresetArchetypes.ts
```

### Mobile Screens (5 files)
```
/wagerproof-mobile/app/(drawer)/(tabs)/agents/
├── index.tsx
├── create.tsx
├── [id]/index.tsx
├── [id]/settings.tsx
└── public/[id].tsx
```

### Mobile Components - Display (4 files)
```
/wagerproof-mobile/components/agents/
├── AgentCard.tsx
├── AgentPickCard.tsx
├── ThinkingAnimation.tsx
└── AgentLeaderboard.tsx
```

### Mobile Components - Creation Screens (6 files - consolidated from 12)
```
/wagerproof-mobile/components/agents/creation/
├── Screen1_SportArchetype.tsx
├── Screen2_Identity.tsx
├── Screen3_Personality.tsx
├── Screen4_DataAndConditions.tsx
├── Screen5_CustomInsights.tsx
└── Screen6_Review.tsx
```

### Mobile Components - Shared Inputs (4 files)
```
/wagerproof-mobile/components/agents/inputs/
├── SliderInput.tsx
├── ToggleInput.tsx
├── OddsInput.tsx
└── ArchetypeCard.tsx
```

### Mobile Components - Settings (2 files)
```
/wagerproof-mobile/components/agents/settings/
├── SettingsSection.tsx
└── SettingsScreen.tsx
```

---

## Total: ~38 files

| Category | Files |
|----------|-------|
| Documentation | 1 |
| Database migrations | 4 |
| Edge functions | 4 |
| Types | 1 |
| Services | 4 |
| Hooks | 3 |
| Screens | 5 |
| Components - Display | 4 |
| Components - Creation | 6 |
| Components - Inputs | 4 |
| Components - Settings | 2 |
| **Total** | **38** |
