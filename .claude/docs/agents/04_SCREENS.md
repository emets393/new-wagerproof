# Screen Specifications

## Screen 1: Agents Hub (`/agents/index.tsx`)

**Purpose:** Main entry point for the Agents feature. Shows user's agents and public leaderboard.

### March 2026 Behavior Notes
- Leaderboard in this screen now supports V2 server-ranked data path.
- In Secret Settings, `Force Agents V2 Only` disables legacy fallback for leaderboard and shows error toast if V2 fails.
- Leaderboard/My Agents skeleton states now include animated motion (pulse) so loading is visibly active.

### Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│ ☰  WagerProof                                    [+] [🤖]           │
├─────────────────────────────────────────────────────────────────────┤
│  [My Agents]  [Leaderboard]                    ← SegmentedControl  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ AgentCard                                                     │   │
│  │ 🎯 Sharp Steve                              12-5-1  +8.2u    │   │
│  │ NFL, NBA • Aggressive                       🔥 4 streak      │   │
│  │ ▓▓▓▓▓▓▓▓▓░░ 68.8%                          [View Picks →]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   │
│  │ + Create New Agent                          (dashed border)  │   │
│  │ Build your AI betting expert                                 │   │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘   │
│                                                                      │
│  (if 5 agents: hide create card, show "Max agents reached")         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### State
```typescript
interface AgentsHubState {
  activeTab: 'my-agents' | 'leaderboard';
  myAgents: Agent[];
  leaderboardAgents: Agent[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}
```

### User Interactions
| Action | Result |
|--------|--------|
| Tap agent card | Navigate to `/agents/[id]` |
| Tap "Create New Agent" | Navigate to `/agents/create` |
| Pull to refresh | Refetch agents list |
| Switch tabs | Toggle between My Agents / Leaderboard |
| Tap leaderboard agent | Navigate to `/agents/public/[id]` |

### Edge Cases
- 0 agents: Show empty state with prominent "Create your first agent" CTA
- 5 agents: Hide create button, show subtle "Max agents reached" text
- Loading: Show AgentCard shimmers (3 placeholders)
- Error: Show error banner with retry button
- No public agents on leaderboard: "No public agents yet. Be the first!"

---

## Screen 2: Agent Creation (`/agents/create.tsx`)

**Purpose:** 6-18 step on-rails flow to configure a new agent's personality.

### Layout (Step Example)
```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                        Step 3 of 10         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🤖  How aggressive should "Sharp Steve" be?                 │    │
│  │                                                              │    │
│  │     This affects bet sizing and risk tolerance.             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│     ○ Conservative                                                   │
│       Protect the bankroll, smaller bets, fewer picks               │
│                                                                      │
│     ● Balanced                         ← Selected                   │
│       Mix of safe and aggressive plays                              │
│                                                                      │
│     ○ Aggressive                                                     │
│       Bigger bets, more picks, chase the big wins                   │
│                                                                      │
│  ┌─────────────────────┐                                            │
│  │ 🎯                  │  ← Live preview card                       │
│  │ Sharp Steve         │     (updates as user answers)              │
│  │ NFL, NBA            │                                            │
│  │ Risk: 6/10          │                                            │
│  └─────────────────────┘                                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                         Next →                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Creation Flow (Progressive Disclosure)

**Phase 1: Quick Start (6 steps)**

| Step | Question | UI Component | Maps To |
|------|----------|--------------|---------|
| 1 | "Let's build your betting agent! What should we call them?" | Text input | `name` |
| 2 | "Pick a look for {name}" | Emoji grid + Color swatches | `avatar_emoji`, `avatar_color` |
| 3 | "Which sports should {name} analyze?" | Multi-select chips | `preferred_sports[]` |
| 4 | "Start from a template or build custom?" | Archetype cards OR "Build Custom" | Pre-fills OR continues |
| 5 | "How aggressive is {name}?" | Illustrated slider | `risk_tolerance` |
| 6 | "What data should {name} trust most?" | Allocation sliders (sum to 100) | `data_weights.*` |

After Step 6: Show **[Create Agent]** or **[Customize More →]**

**Phase 2: Fine Tune (12 optional steps)**

| Step | Question | UI Component | Maps To |
|------|----------|--------------|---------|
| 7 | "Bet type preferences?" | Drag-to-rank list | `bet_type_weights.*` |
| 8 | "Unit sizing strategy?" | Cards with descriptions | `unit_sizing_strategy` |
| 9 | "How many picks per day?" | Dual-thumb range slider | `min/max_picks_per_day` |
| 10 | "Minimum confidence to make a pick?" | Labeled slider 55-80% | `min_confidence_threshold` |
| 11 | "Minimum edge to consider?" | Labeled slider 0-15% | `min_edge_threshold` |
| 12 | "Favorite vs underdog lean?" | Slider -10 to +10 | `underdog_bias` |
| 13 | "Home or road team lean?" | Slider -10 to +10 | `home_away_bias` |
| 14 | "Over or under lean?" | Slider -10 to +10 | `over_under_bias` |
| 15 | "How much does weather matter?" | Slider 0-10 | `external_factors.weather_sensitivity` |
| 16 | "Follow line movement signals?" | Multi-slider group | `market_signals.*` |
| 17 | "Situational spot awareness?" | Multi-slider group | `situational_factors.*` |
| 18 | "Any teams to favor or avoid?" | Searchable team picker | `favorite_teams`, `avoided_teams` |

### Edge Cases
- Name already exists: Show inline error "You already have an agent named X"
- Network error on submit: Show error toast, keep form state
- Back navigation during creation: Confirm dialog "Discard this agent?"
- App backgrounded: Persist draft state to AsyncStorage

---

## Screen 3: Agent Detail (`/agents/[id].tsx`)

**Purpose:** View agent's picks, history, and stats. Entry point for pick generation.

### March 2026 Behavior Notes
- Agent detail supports V2 snapshot + V2 history path behind flags.
- With force mode enabled, detail uses V2 only and shows error toast on failure.
- Initial load is optimized to avoid eager full-history fetch until history section is opened (V2 path).

### Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                      [⚙️]                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              🎯                                               │   │
│  │         Sharp Steve                                           │   │
│  │   NFL, NBA • Aggressive (8/10) • Spreads-focused             │   │
│  │                                                               │   │
│  │   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │   │
│  │   │ 12-5-1 │ │ +8.2u  │ │ 68.8%  │ │ 🔥 4   │               │   │
│  │   │ Record │ │ Units  │ │ Win %  │ │ Streak │               │   │
│  │   └────────┘ └────────┘ └────────┘ └────────┘               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  [Today's Picks]  [History]  [Stats]           ← Sub-navigation    │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│                                                                      │
│  IF generating (ThinkingTrace):                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 📡 Scanning today's games...              ✓                  │   │
│  │ 🧮 Analyzing model predictions...         ✓                  │   │
│  │ 📊 Identifying value edges...             ● ←                │   │
│  │ 🎯 Applying {name}'s strategy...                             │   │
│  │ ✨ Making final selections...                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  IF picks exist:                                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ KC @ DEN                              Today 4:25 PM          │   │
│  │ ┌─────┐                                                      │   │
│  │ │ KC  │  KC -3.5 (-110)        2u     62% confidence        │   │
│  │ └─────┘                                                      │   │
│  │ "Model shows 4-point edge. Public heavy on Denver, but      │   │
│  │  sharp money moving toward Chiefs..."                        │   │
│  │                                                               │   │
│  │ Key factors: [Model +4.2%] [RLM] [Public fade]              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  IF no games today:                                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              📅                                               │   │
│  │   No NFL or NBA games today                                  │   │
│  │   Next games: Thursday, Jan 16                               │   │
│  │                                                               │   │
│  │   [View Upcoming Schedule]                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### State
```typescript
interface AgentDetailState {
  agent: Agent | null;
  activeTab: 'today' | 'history' | 'stats';

  // Today's Picks tab
  todaysPicks: AgentPick[] | null;
  isGenerating: boolean;
  generationStage: number;  // 0-5 for ThinkingTrace
  noGamesMessage: string | null;

  // History tab
  historicalPicks: AgentPick[];
  historyPage: number;
  hasMoreHistory: boolean;

  // Stats tab
  stats: AgentStats | null;
}
```

### User Interactions
| Action | Result |
|--------|--------|
| Settings icon | Navigate to edit screen |
| Tab switch | Load relevant data for tab |
| Pull to refresh (Today) | Re-check for picks (won't regenerate if exist) |
| "Regenerate" button | Force new generation (1x/day limit) |
| Pick card tap | Expand to show full reasoning |
| History scroll | Load more picks (infinite scroll) |
| Stats period selector | Filter stats by time range |

### Edge Cases
- Agent has 0 picks ever: Show "No picks yet" with explanation
- Generation takes >15s: Show "Taking longer than usual..." message
- Generation fails: Show error with retry button
- Agent deleted while viewing: Redirect to hub with toast
- No games + no upcoming: "Off-season for {sports}. Check back when games resume."

---

## Screen 4: Agent Settings (`/agents/[id]/settings.tsx`)

**Purpose:** Comprehensive view and edit of ALL agent parameters. Full control panel.

### Layout (Sectioned Scrollable View)
```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                          Agent Settings            [Save]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  📋 IDENTITY                                           [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Name, Emoji & Color, Sports                                        │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  📊 DATA SOURCE WEIGHTING                              [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Model, Sharp Money, Public Fade, Prediction Markets, News          │
│  (Sliders that must sum to 100)                                     │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  ⚡ RISK PROFILE                                       [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Risk Tolerance, Max Units, Base Unit, Sizing Strategy              │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  🎯 EDGE REQUIREMENTS                                  [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Min Edge, Min Confidence, Value vs Certainty                       │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  🎲 BET TYPE PREFERENCES                               [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Drag-to-reorder: Spreads, Totals, Moneylines, etc.                 │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  📈 VOLUME & TIMING                                    [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Picks Per Day Range, Pass on Weak Slates, Primetime Preference     │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  ⚖️ BIASES & TENDENCIES                                [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Underdog/Favorite Lean, Home/Away Lean, Over/Under Lean            │
│  Favorite Teams, Avoided Teams                                      │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  🎭 SITUATIONAL FACTORS                                [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Rest Days, Travel, B2B, Revenge, Letdown, Lookahead, etc.          │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  📉 MARKET SIGNALS                                     [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Line Movement, RLM, Steam Moves, Opening Line Value                │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  🌤️ EXTERNAL FACTORS                                   [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Weather, Wind, Cold Weather, Indoor Preference                     │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  ✏️ ANALYSIS STYLE                                     [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Stats Heavy / Balanced / Contrarian / Narrative / Situational      │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  🌐 VISIBILITY                                         [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Make Public toggle                                                 │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  ⚠️ DANGER ZONE                                        [Expand ▼]  │
│  ═══════════════════════════════════════════════════════════════   │
│  Reset to Defaults, Delete Agent                                    │
│                                                                      │
│  ⚠️ Changes take effect on next pick generation.                    │
│     Existing record will not be affected.                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Save Changes                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Validation Rules
```typescript
const VALIDATION = {
  // Data weights must sum to 100
  data_weights: (weights) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return sum === 100 ? null : `Must sum to 100 (currently ${sum})`;
  },

  // Name validation
  name: (name) => {
    if (name.length < 2) return 'Name must be at least 2 characters';
    if (name.length > 20) return 'Name must be at most 20 characters';
    return null;
  },

  // At least one sport selected
  preferred_sports: (sports) => {
    return sports.length > 0 ? null : 'Select at least one sport';
  },

  // Min picks <= max picks
  picks_range: (min, max) => {
    return min <= max ? null : 'Min picks cannot exceed max picks';
  },
};
```

### User Interactions
| Action | Result |
|--------|--------|
| Section header tap | Toggle expand/collapse |
| Any slider change | Update state, mark hasChanges |
| Save button | Validate all → update DB → show success |
| Back with changes | Confirm dialog: "Discard changes?" |
| Reset to Defaults | Confirm → restore preset values |
| Delete Agent | Double confirm → delete → navigate to hub |

---

## Screen 5: Public Agent View (`/agents/public/[id].tsx`)

**Purpose:** View someone else's public agent (read-only).

### Differences from owned Agent Detail
- No settings/edit icon
- Shows owner username with link to profile
- Follow button instead of edit
- No "Regenerate" option
- Can view picks but not modify agent

---

## Screen 6: Leaderboard Tab (in Agents Hub)

**Purpose:** Ranked list of all public agents by net units.

### Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│  [My Agents]  [Leaderboard]                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🏆 Top Agents                          [Filter ▼]                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1  🔥 The Oracle          +42.3u   89-51  @user123           │   │
│  │    NFL • Contrarian                                   →      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 2  🎯 Spread King         +38.1u   72-44  @bettor99          │   │
│  │    NFL, NBA • Balanced                                →      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 4  💰 Money Machine       +28.9u   58-39  @you ★             │   │
│  │    NFL, CFB • Aggressive             ← Your agent marked     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ... (infinite scroll) ...                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Filter Options
- All Sports / NFL only / NBA only / etc.
- Time period: All time / This season / Last 30 days
- Minimum picks: 10+ / 25+ / 50+
