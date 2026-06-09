# B13 — Agents tab landing + components + stores — Fidelity table

Source RN files (port targets):
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/index.tsx` (883 lines — landing screen)
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/_layout.tsx`
- `wagerproof-mobile/components/agents/AgentCard.tsx`
- `wagerproof-mobile/components/agents/AgentIdCard.tsx`
- `wagerproof-mobile/components/agents/AgentLeaderboard.tsx`
- `wagerproof-mobile/components/agents/AgentOverlapFooter.tsx`
- `wagerproof-mobile/components/agents/GlowAccentBar.tsx`
- `wagerproof-mobile/components/agents/GlowingCardWrapper.tsx`
- `wagerproof-mobile/components/agents/index.ts`
- `wagerproof-mobile/hooks/useAgents.ts`
- `wagerproof-mobile/hooks/useFollowedAgents.ts`
- `wagerproof-mobile/hooks/useLeaderboard.ts`
- `wagerproof-mobile/hooks/useAgentEntitlements.ts`
- `wagerproof-mobile/services/agentService.ts`
- `wagerproof-mobile/services/agentPicksService.ts`
- `wagerproof-mobile/services/agentPerformanceService.ts`
- `wagerproof-mobile/services/agentPerformanceMetrics.ts`
- `wagerproof-mobile/types/agent.ts`
- `wagerproof-mobile/contexts/AgentHRSheetContext.tsx`

Match legend:
- matches — same behavior / visuals
- 🔧 fixed — diverged from RN but more idiomatic in SwiftUI
- ⚠️ #NNN — waivered to ticket
- missing — fail

---

## 1. AgentsHubScreen (`agents/index.tsx`) → `AgentsView.swift`

### Visual structure

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Frosted `AndroidBlurView` header w/ insets.top + 56pt | `NavigationStack` title bar (system nav-bar blur) | 🔧 native nav bar replaces custom blur header |
| 2 | "Wager" + "Proof" + green "Agents" pill in header | `ToolbarItem(placement: .principal)` rendering same three-part title | matches |
| 3 | Cog icon (settings push) on the left of header | Hamburger toolbar item from `MainTabView.agentsTab` wrap | 🔧 RN cog deep-links to /settings; iOS uses the standard side-menu hamburger pattern shared across tabs |
| 4 | Robot icon (chat launcher) on right of header | `FloatingAssistantBubble` overlay from `MainTabView.agentsTab` | matches (B17 wires the action) |
| 5 | FlatList grid of agents (2 columns) | `LazyVGrid(columns: 2, spacing: 8)` | matches |
| 6 | `PixelOffice` pixel-art hero above grid | (none) | ⚠️ #073 |
| 7 | `CompanyDashboardBanner` rollup above grid | (none) | ⚠️ #073 |
| 8 | `AgentTimelineSection` per-agent rendering (when picks exist) | (none — B14) | ⚠️ #072 |
| 9 | EmptyState w/ 3-step journey card | `emptyState` view (3 `journeyStep` rows + CTA) | matches |
| 10 | Skeleton loader (AgentTimelineSkeleton w/ shimmer) | `myAgentsSkeleton` w/ `.redacted(.placeholder)` | 🔧 system placeholder replaces shimmer-animated bars |
| 11 | Error state w/ retry button | `ContentUnavailableView` w/ retry `Button` | matches |
| 12 | Pull-to-refresh (`RefreshControl`) | `.refreshable` | matches |
| 13 | FAB ("+" plus icon) bottom-right | `fabOverlay` w/ `Button` in `.overlay(alignment: .bottomTrailing)` | matches |
| 14 | Lock chip when limit reached | Same lock chip rendered inside `fabOverlay` | matches |
| 15 | Long-press → ActionSheetIOS (Settings / Autopilot / Delete) | `.confirmationDialog` w/ same three options | matches |
| 16 | Settings push, Autopilot mutation, Delete confirmation | Same actions; deletion currently optimistic local + service call | matches |
| 17 | Inner-tab picker (My Agents / Leaderboard / Top Picks) | `Picker(.segmented)` on top of body | matches — the RN screen actually only renders My Agents; the inner-tab picker is an iOS-native restructure |
| 18 | `WagerBotSuggestion` set after refresh | (none) | ⚠️ #062 (covered by existing waiver for the suggestion store) |

### State / data layer

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 19 | `useUserAgents` (React Query) → fetches `avatar_profiles` filtered by user | `AgentsStore.refresh()` → `AgentService.fetchUserAgents` | matches |
| 20 | Performance fan-out: `avatar_performance_cache` filtered by ids | Same — joined inside `fetchUserAgents` | matches |
| 21 | `sortedAgents` memo (best-first by net_units) | `AgentsStore.refresh` sorts in-place after fetch | matches |
| 22 | `useUpdateAgent` mutation (full update) | `AgentService.setActive` / `setPublic` / `setAutoGenerate` (granular) | 🔧 split into purpose-specific functions; full update is B15 |
| 23 | `useDeleteAgent` mutation | `AgentsStore.delete` → `AgentService.delete` | matches |
| 24 | `useAgentEntitlements` hook | `AgentEntitlementsStore` w/ same constants + helpers | matches |
| 25 | `trackAppOpen(user.id)` on mount | (none) | ⚠️ Activity-tracking ticket; deferred (no separate B13 ticket) |

### Navigation

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 26 | `router.push('/agents/create')` | `navPath.append(.createAgent)` → `CreateAgentPlaceholderView` | ⚠️ #072 |
| 27 | `router.push('/agents/[id]')` | `navPath.append(.agentDetail(id))` → `AgentDetailPlaceholderView` | ⚠️ #072 |
| 28 | `router.push('/agents/public/[id]')` | `navPath.append(.publicAgentDetail(id))` → `PublicAgentDetailPlaceholderView` | ⚠️ #072 |
| 29 | `router.push('/(drawer)/settings')` cog | Side-menu hamburger; settings is its own tab | 🔧 |

---

## 2. AgentIdCard.tsx → `AgentIdCard.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | TouchableOpacity card, 195pt fixed height | `Button` w/ matching frame height | matches |
| 2 | Top gradient border (3pt strip) | `LinearGradient(.leading→.trailing)` at top | matches |
| 3 | Background-gradient wash from primary → secondary → transparent | Identical `LinearGradient(.top→.bottom)` w/ same stops | matches |
| 4 | 40pt emoji circle w/ primary.opacity(20%) bg | Same | matches |
| 5 | Agent name (14pt bold, 1-line) + sport-symbol badges row | Same — uses `AgentSport.sfSymbol` for the badge glyph | 🔧 RN uses MaterialCommunityIcons names; Swift uses SF Symbols (closest equivalents) |
| 6 | PERFORMANCE label + net-units chip in chart header | Same | matches |
| 7 | Static mini sparkline (12-step synthetic equity) | `AgentSparkline` w/ `Path` + same point-generation algorithm | matches |
| 8 | Record string + streak chip in chart footer | Same — `recordLabel` + flame/snowflake icon | matches |
| 9 | Autopilot On (green dot + time pill) | Same | matches |
| 10 | Autopilot Off (pause icon + label) | Same | matches |
| 11 | Long-press w/ 400ms delay | `.onLongPressGesture(minimumDuration: 0.4)` | matches |

---

## 3. AgentCard.tsx → `AgentCard.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Card w/ accent bar header (GlowAccentBar w/ animation) | `GlowAccentBar` static gradient bar | ⚠️ #071 |
| 2 | Avatar circle (gradient or solid) + emoji | Same — `LinearGradient` for gradient case | matches |
| 3 | Name row + sport-label pills | Same | matches |
| 4 | Active indicator dot | Green circle when `isActive` | matches |
| 5 | Stats row (Record / Net Units / Streak) w/ borders | `statCell` triple inside an `HStack` | matches |

Note: `AgentCard` is not used by `AgentsView` directly in B13 — it's a primitive consumed by `AgentTimelineSection` (B14). Port shipped to unblock the B14 implementer.

---

## 4. AgentLeaderboard.tsx → `AgentLeaderboard.swift` (`AgentLeaderboardView`)

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Sort-mode filter pill row | `filterPill` row in `filterRows` ScrollView | matches |
| 2 | Timeframe filter pill row + "10+ picks" toggle | Same | matches |
| 3 | FlatList of `LeaderboardRow` | `LazyVStack` of `LeaderboardRow` | matches |
| 4 | Top-3 rows wrapped in `GlowingCardWrapper` | Same — Swift `GlowingCardWrapper` with static gradient | ⚠️ #071 |
| 5 | Rank medal (trophy/medal icons w/ gold/silver/bronze) | Same w/ SF Symbol equivalents | matches |
| 6 | Avatar circle (gradient-aware) + name + sport labels | Same | matches |
| 7 | Record + net-units + win-rate columns | Same | matches |
| 8 | Lock blur overlay on units when not pro | `.ultraThinMaterial` overlay + lock icon | 🔧 native material replaces RN `AndroidBlurView` |
| 9 | Empty state | `emptyState` view | matches |
| 10 | Skeleton rows | `.redacted(.placeholder)` rows | 🔧 |
| 11 | Pull-to-refresh + first-load `.task` | Same | matches |
| 12 | `usePrefetchAgentPicks` on row press | (none) | ⚠️ optimization — wire when AgentDetailView lands (B15) |
| 13 | `router.push('/agents/public/[id]')` on row tap | `onRowTap` callback → `navPath.append(.publicAgentDetail(id))` | matches (#072 placeholder) |

---

## 5. AgentOverlapFooter.tsx → `AgentOverlapFooter.swift`

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Avatar stack (max 5) w/ overlap | `HStack(spacing: -8)` w/ z-index | matches |
| 2 | Overflow +N circle | Same | matches |
| 3 | "N other agents made this pick" label | Same | matches |
| 4 | Gradient circle support | `LinearGradient` when `gradient:` prefix | matches |

Note: Footer isn't rendered in B13 (no pick rows yet). Port shipped for B14.

---

## 6. GlowAccentBar.tsx + GlowingCardWrapper.tsx → static gradient variants

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | `react-native-animated-glow` w/ 5-color cycling halo | `LinearGradient` + `.blur` static halo | ⚠️ #071 |
| 2 | HSL palette generation (darkest / dark / base / light / lightest / shifted) | (dropped — single gradient stop pair) | ⚠️ #071 |

---

## 7. Hooks → stores

### useAgents.ts → `AgentsStore.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `useUserAgents` (React Query) | `AgentsStore.refresh()` | matches |
| 2 | `useAgent` (single) | `AgentService.fetchAgent(id)` | matches |
| 3 | `useCreateAgent` | (none — B14) | ⚠️ #077 |
| 4 | `useUpdateAgent` | `AgentService.setActive/setPublic/setAutoGenerate` | 🔧 split into purpose-specific calls |
| 5 | `useDeleteAgent` | `AgentsStore.delete` | matches |
| 6 | `useInvalidateAgents` | implicit — `refresh()` is the invalidation primitive | 🔧 |
| 7 | 5-min stale time | (none — manual refresh) | 🔧 manual refresh on `.task` + `.refreshable` |

### useFollowedAgents.ts → `FollowedAgentsStore.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `useFollowedAgents` query | `FollowedAgentsStore.refresh` | matches |
| 2 | `useFavoriteAgentIds` query (joins own + followed) | (none) | ⚠️ deferred — used by Top Picks "Favorites" mode (#070) |

### useLeaderboard.ts → `LeaderboardStore.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `useLeaderboard` (single mode) | `LeaderboardStore.refresh` | matches |
| 2 | `useLeaderboardByMode` (mode binding) | `LeaderboardStore.sortMode` + `didSet` re-fetch | matches |
| 3 | `useAgentPerformance(id)` | `AgentPerformanceService.fetchPerformance(id)` | matches |
| 4 | `useTopPerformersBySport` | (none — handled by `sport: AgentSport?` binding on store) | 🔧 |

### useAgentEntitlements.ts → `AgentEntitlementsStore.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `canCreateAnotherAgent(active, total)` | Same signature | matches |
| 2 | `canViewLeaderboardRank(rank)` | Same | matches |
| 3 | `canViewAgentPicks` / `canCreatePublicAgent` / `canUseAutopilot` | Same | matches |
| 4 | `FREE_AGENT_LIMIT` / `PRO_MAX_ACTIVE_AGENTS` / `PRO_MAX_TOTAL_AGENTS` constants | Same constants | matches |
| 5 | `isOffline` + `isLockedDueToNetwork` | (none) | ⚠️ offline gating ticket (covered by existing offline-banner ticket) |

---

## 8. Services

### agentService.ts → `AgentService.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `fetchUserAgents(userId)` w/ slim+perf join | Same | matches |
| 2 | `fetchAgentById(id)` w/ detail+perf join | `fetchAgent(id:)` | matches |
| 3 | `createAgent` (edge function `invokeAgentAuthorizedAction`) | (none — B14) | ⚠️ #077 |
| 4 | `updateAgent` (edge function) | Granular setters | 🔧 |
| 5 | `deleteAgent` (direct table delete) | `delete(agentId:)` | matches |
| 6 | `fetchPresetArchetypes` | (none — B14) | ⚠️ #077 |
| 7 | `AGENT_LIST_COLUMNS` / `PERF_COLUMNS` projections | Same string constants | matches |
| 8 | Zod validation on create/update | Decode-tolerant init + RPC validates server-side | 🔧 |

### agentPicksService.ts → `AgentPicksService.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `fetchAgentPicks(agentId, filters)` | `fetchPicks(agentId:)` (no filters in B13) | matches (filter overloads ship w/ B15) |
| 2 | `fetchTodaysPicks` | Same | matches |
| 3 | `fetchTodaysGenerationRun` | (none — B14) | ⚠️ #077 |
| 4 | `generatePicks` (V2 enqueue + poll) | (none — B14) | ⚠️ #077 |
| 5 | `fetchTopAgentPicksFeed` (table query) | `fetchUpcomingFeed` | matches |
| 6 | `fetchTopAgentPicksFeedV2` (RPC) | `fetchTopAgentPicksFeed(filterMode:viewerUserId:limit:)` | matches (single mode in B13 — see #070) |
| 7 | `fetchAgentDetailSnapshotV2` | (none — B15) | ⚠️ #076 |
| 8 | `fetchAgentPicksPageV2` (paginated) | (none — B15) | ⚠️ #076 |
| 9 | `enrichPicksWithOverlap` | (none — B14 wires overlap into AgentPickItem) | ⚠️ deferred (B14) |
| 10 | `fetchPicksForAgents` | (none — used by AgentTimeline, B14) | ⚠️ #076 |

### agentPerformanceService.ts → `AgentPerformanceService.swift`

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `fetchAgentPerformance(id)` | Same | matches |
| 2 | `fetchLeaderboard` (V2-first + fallback) | `fetchLeaderboard` (V2 only) | 🔧 fallback not ported — RPC has stabilized in prod |
| 3 | `fetchLeaderboardV2` w/ all six params | Same | matches |
| 4 | `fetchPerformanceForAgents(ids)` | (none — handled by `fetchUserAgents` join) | 🔧 |
| 5 | `calculateNetUnits` Formula B helper | (none — server-side via RPC) | 🔧 already lives in `WagerproofModels/UnitsCalculation.swift` if needed |
| 6 | `calculateStreaks` helper | (none — server-side via RPC) | 🔧 |
| 7 | `sortLeaderboardEntries` helper | (none — RPC sorts) | 🔧 |
| 8 | `trackAgentTiming` mixpanel/perf logging | (none) | ⚠️ deferred (covered by Mixpanel-events ticket #052) |

### agentPerformanceMetrics.ts (mixpanel emitter)

Not ported — covered by existing ticket #052 (paywall Mixpanel events) for the broader analytics gap.

---

## 9. Models (`types/agent.ts` → `WagerproofModels/Agent*.swift`)

| # | RN type | Swift type | Match |
|---|---|---|---|
| 1 | `PersonalityParams` (28 fields, scale-validated) | `AgentPersonalityParams` (same field set, snake_case CodingKeys) | matches |
| 2 | `CustomInsights` | `AgentCustomInsights` | matches |
| 3 | `AgentProfile` (24 fields) | `Agent` | matches |
| 4 | `AgentPick` (17 fields) | `AgentPick` | matches |
| 5 | `OverlapAgentSummary` + `AgentPickOverlap` | (inlined in `AgentOverlapFooter.OverlapSummary`) | 🔧 |
| 6 | `AgentGenerationRunSummary` | (none — B14) | ⚠️ #077 |
| 7 | `AgentDecisionTrace` + `AgentUsedMetric` | (none — B15) | ⚠️ #076 |
| 8 | `AgentPerformance` (14 fields) | `AgentPerformance` | matches |
| 9 | `PresetArchetype` | (none — B14) | ⚠️ #077 |
| 10 | `AgentWithPerformance` | Same | matches |
| 11 | `LeaderboardEntry` (in service file) | `AgentLeaderboardEntry` | matches |
| 12 | `TopAgentPickFeedV2Row` (in service file) | `TopAgentPickFeedRow` | matches |
| 13 | `formatRecord` / `formatNetUnits` / `formatStreak` helpers | Properties on `AgentPerformance` (`recordLabel`, `netUnitsLabel`, `currentStreakLabel`) | matches |
| 14 | `oddsToImpliedProb` / `oddsToPayoutMultiplier` | (none — already exist in `UnitsCalculation.swift`) | 🔧 |
| 15 | Zod schemas (CreateAgentSchema / UpdateAgentSchema / etc.) | (none — server-side validation via edge function) | 🔧 |

---

## 10. Layout (`agents/_layout.tsx`)

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | Stack screen w/ slide-from-right animation | `NavigationStack` + system push animation | matches |
| 2 | Header hidden | `.navigationBarTitleDisplayMode(.inline)` w/ custom principal | 🔧 |
| 3 | Nested routes (create / [id] / public) | `navigationDestination(for: AgentsRoute.self)` | matches |

---

## 11. AgentHRSheetContext.tsx

Not ported. Context provides the "agent HR bottom sheet" — a multi-agent comparison surface that launches from elsewhere in RN. Lives behind the Top Picks feed and ships with B14 / B15 alongside the surfaces that present it. No B13 surface needs it.

---

## 12. MainTabView changes

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | Agents in bottom tab bar | New `agentsTab` slot at position 2; `MainTabStore.Tab.agents` added | matches |
| 2 | Brain icon for Agents | `brain.head.profile` SF Symbol | 🔧 |
| 3 | `agents` deep link → opens side menu | `agents` deep link → selects `.agents` tab (B13 lands the real tab) | 🔧 supersedes prior behavior |
| 4 | Hamburger toolbar + offline banner + WagerBot bubble overlay | Wrapped same way as picks/outliers/settings tabs | matches |

---

## 13. Inventory deltas

The following RN files flip from `missing` → `candidate` in `inventory.overrides.csv`:
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/index.tsx`
- `wagerproof-mobile/app/(drawer)/(tabs)/agents/_layout.tsx`
- `wagerproof-mobile/components/agents/AgentCard.tsx`
- `wagerproof-mobile/components/agents/AgentIdCard.tsx`
- `wagerproof-mobile/components/agents/AgentLeaderboard.tsx`
- `wagerproof-mobile/components/agents/AgentOverlapFooter.tsx`
- `wagerproof-mobile/components/agents/GlowAccentBar.tsx`
- `wagerproof-mobile/components/agents/GlowingCardWrapper.tsx`
- `wagerproof-mobile/hooks/useAgents.ts`
- `wagerproof-mobile/hooks/useFollowedAgents.ts`
- `wagerproof-mobile/hooks/useLeaderboard.ts`
- `wagerproof-mobile/hooks/useAgentEntitlements.ts`
- `wagerproof-mobile/services/agentService.ts`
- `wagerproof-mobile/services/agentPicksService.ts`
- `wagerproof-mobile/services/agentPerformanceService.ts`
- `wagerproof-mobile/types/agent.ts`
