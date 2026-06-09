# B16 — Top Agent Picks Feed + widget-sync + favorites — Fidelity table

Source RN files (port targets):
- `wagerproof-mobile/components/agents/TopAgentPicksFeed.tsx` (~570 lines)
- `wagerproof-mobile/hooks/useTopAgentPicksFeed.ts`
- `wagerproof-mobile/hooks/useTopAgentsWidgetSync.ts`
- `wagerproof-mobile/hooks/useWidgetDataSync.ts` (top-agents path only)
- `wagerproof-mobile/services/topAgentsWidgetService.ts`
- `wagerproof-mobile/services/agentPicksService.ts` (`fetchTopAgentPicksFeedV2` + cursor params)
- `wagerproof-mobile/modules/widget-data-bridge/src/WidgetDataBridge.ts` (JS facade)

Predecessor: **B13 (Agents hub)** left `topPicksBranch` as a single-mode
placeholder under FIDELITY-WAIVER #070. B16 builds the full filter UI but
defers actually wiring it into `AgentsView.swift` to ticket #081 so the
in-flight B14 (creation) and B15 (detail) batches can land without
three-way conflicts.

Match legend:
- matches — same behavior / visuals
- 🔧 fixed — diverged from RN but more idiomatic in SwiftUI
- ⚠️ #NNN — waivered to ticket
- missing — fail

---

## 1. TopAgentPicksFeed (`TopAgentPicksFeed.tsx` → `TopAgentPicksFeed.swift`)

### Filter row

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Horizontally-scrolling pill row (Top / Following / Favorites) | `Picker("Filter", selection: $store.filterMode).pickerStyle(.segmented)` | 🔧 native segmented control replaces custom pills |
| 2 | `setFilter('top10' | 'following' | 'favorites')` | Bindable `store.filterMode` with `didSet` → `refresh()` | matches |
| 3 | Haptics on filter change | `.sensoryFeedback(.selection, trigger: filterMode)` | matches |

### Search

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | Inline TextInput with magnify icon + clear button | `.searchable` on parent (`AgentsView`); `store.searchText` bindable | 🔧 native search field — see ticket #081 for parent wiring |
| 2 | Local `filter()` over `picks` by name/matchup/selection | `TopAgentPicksFeedStore.filterLocally(_:)` + server-side `p_search_text` | matches |
| 3 | Submit on type | `.task(id: store.searchText)` with 250ms debounce → `store.applySearchText` | 🔧 debounced — RN debounces via React render cycle |

### Pagination

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | RN reads `picks` from `useQuery`, no `onEndReached` wired | `LazyVStack` + `.task(id: section.id)` on the last section → `store.loadMore()` | 🔧 cursor pagination newly added — RN has the cursor in `fetchTopAgentPicksFeedV2` but the hook never paginates |
| 2 | `cursor`, `p_cursor`, `has_more` (in `AgentPicksPageV2`) | `TopAgentPicksFeedStore.cursor` / `.hasMore` / `loadMore()` | matches |
| 3 | Dedup logic across pages | Set-based dedupe by row id in `loadMore` | matches |

### Sectioned feed

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | `groupPicksByAgent(picks)` → contiguous agent sections | `TopAgentPicksFeedStore.sections` computed property | matches |
| 2 | Agent header: rank badge, emoji bubble, name, record, net units, chevron | `AgentSectionView.agentHeader` | matches |
| 3 | Rank 1/2/3 → trophy/medal/medal-outline icons in gold/silver/bronze | SF Symbols `trophy.fill` / `medal.fill` / `medal` with the same hex colors | matches |
| 4 | Spotify-style horizontal `ScrollView` of pick cards (≤4) | `ScrollView(.horizontal)` of `OutlierMatchupCardView` | matches |
| 5 | Tap pick → `openGameForPick` (sheet) | `onPickTap` callback with 500ms loading flash; parent wires sheet (deferred to #081) | ⚠️ #081 |
| 6 | Tap agent → `/agents/public/[id]` | `onAgentTap` callback; parent pushes `AgentsRoute.publicAgentDetail` | matches |
| 7 | Pro-gate: free users see first 3 picks, then `LockedOverlay` | Not yet wired — Pro gate lands once parent wires `ProAccessStore`; ticket #081 covers | ⚠️ #081 |
| 8 | Empty state per filter mode | `ContentUnavailableView` with mode-specific title / icon / message | matches |
| 9 | Skeleton: 3 sections × 3 shimmer cards | Same — reuses `OutlierCardShimmerView` | matches |
| 10 | Cascading shimmer delays (i*400 + j*150) | Uses `phase = (i + j) % 3` for the existing shimmer staggering | 🔧 simpler delay model |

### Favorites

| # | RN element | Swift counterpart | Match |
|---|---|---|---|
| 1 | `useFavoriteAgentIds` returns union(own widget favorites, followed-with-is_favorite=true) | `FavoriteAgentsStore` (local) + server-side handled by RPC `p_filter_mode='favorites'`; store ORs local set defensively | 🔧 adds local-only favorites layer iOS users can toggle from the feed header (RN has no per-row favorite toggle) |
| 2 | Server-side check via `is_widget_favorite` + `user_avatar_follows.is_favorite` | Untouched — RPC `get_top_agent_picks_feed_v2` resolves both | matches |
| 3 | No per-row favorite UI in RN | Added star button on each agent header (haptics + `FavoriteAgentsStore.toggle`) | 🔧 iOS adds first-class favorite affordance |

---

## 2. TopAgentsWidgetService (`topAgentsWidgetService.ts` → `TopAgentsWidgetService.swift`)

| # | RN behavior | Swift counterpart | Match |
|---|---|---|---|
| 1 | `fetchTopAgentsForWidget(userId)` — agents + perf + 3-day picks | `TopAgentsWidgetService.fetchTopAgents(userId:)` | matches |
| 2 | Favorites-first sort, then performance | `byPerformanceDesc` + favorites-first split | matches |
| 3 | `MAX_WIDGET_AGENTS=3`, `PICKS_PER_AGENT=2` | Same constants | matches |
| 4 | Today's picks → fallback historical picks per agent | `selectPicks(for:)` mirrors RN dedup logic | matches |
| 5 | `getWidgetData` reads existing payload | `readPayload()` reads from `UserDefaults(suiteName: "group.com.wagerproof.mobile")` | matches |
| 6 | `syncWidgetData(...)` writes JSON to App Group | `writePayload(_:)` JSON-encodes to the App Group suite | matches |
| 7 | RN native module bridges to WidgetKit; calls `reloadTimelines` | No widget extension target yet — see ticket #079 | ⚠️ #079 |
| 8 | Fallback if App Group not available | Falls back to `.standard` UserDefaults — see ticket #080 | ⚠️ #080 |
| 9 | Hash-based change detection in `useTopAgentsWidgetSync` | `TopAgentsWidgetService.hash(of:)` returns canonical JSON hash callers can use | matches |
| 10 | `AppState.addEventListener('change', ...)` triggers re-sync on foreground | Not yet wired — caller (a top-level app delegate / scene phase observer) needs to pump `sync(userId:)` on `.active` | ⚠️ #081 |

---

## 3. TopAgentPicksFeedStore (new — RN had a React-Query orchestrator)

| # | RN behavior | Swift counterpart | Match |
|---|---|---|---|
| 1 | `useTopAgentPicksFeed(filter)` returns `picks`, `isLoading`, `isRefetching`, `refetch`, `agentMetaMap` | `@Observable` store with `items`, `loadState`, `sections`, `refresh()`, `loadMore()`, `applySearchText(_:)` | matches |
| 2 | Sort: `top10` orders by rank asc + created_at desc | RPC returns rows in rank order; store preserves order | matches |
| 3 | Enrich picks with agent meta via `useFollowedAgents` (when filter='following') | RPC `get_top_agent_picks_feed_v2` already joins meta; store doesn't need a parallel fetch | 🔧 single round-trip vs RN's parallel queries |
| 4 | React-Query `staleTime: 2 * 60 * 1000` | `loadState` tracked manually; pull-to-refresh = `.refreshable` | 🔧 native refresh semantics |
| 5 | Pagination via cursor `created_at` of last row | `nextCursor(from:)` uses `last?.createdAt` | matches |

---

## 4. FavoriteAgentsStore (new — RN had Supabase-backed favorites only)

| # | RN behavior | Swift counterpart | Match |
|---|---|---|---|
| 1 | Server-side `is_widget_favorite` + `user_avatar_follows.is_favorite` | Unchanged — still resolved server-side by the RPC | matches |
| 2 | No local favorites set | `FavoriteAgentsStore` persists to `UserDefaults` (`topPicksFavoriteAgentIds`) | 🔧 iOS adds local layer so power users can curate without flipping server flags |
| 3 | `toggle(_:)` / `isFavorite(_:)` / `clear()` | Same surface | matches |
| 4 | RN reads favorites via `useFavoriteAgentIds` hook | View injects via `.environment(favorites)` and `@Environment(FavoriteAgentsStore.self)` | matches |

---

## 5. AgentPicksService extension

| # | RN | Swift | Match |
|---|---|---|---|
| 1 | `fetchTopAgentPicksFeedV2(filterMode, viewerUserId, searchText?, limit, cursor?)` | `AgentPicksService.fetchTopAgentPicksFeed(filterMode:viewerUserId:searchText:limit:cursor:)` | matches |
| 2 | `trackAgentTiming('top_picks_time_to_content_ms', ...)` | Not yet — analytics shim lands in a follow-up batch (no ticket yet — see B12 analytics gap) | missing |

---

## 6. Integration into AgentsView

| # | What | Status |
|---|---|---|
| 1 | Replace inline `TopPickRow` list with `TopAgentPicksFeedContainer` | ⚠️ #081 |
| 2 | Add `.searchable` to parent NavigationStack when active tab = `.topPicks` | ⚠️ #081 |
| 3 | Resolve waiver #070 (Top Picks filter UI is single-mode) | ⚠️ #081 |

Reason for deferral: B14 (creation wizard) and B15 (detail/settings) are in
flight against `AgentsView.swift` in parallel. Touching the same file from
B16 would force a 3-way merge. The component is ready; the wiring is a
single replacement.

---

## Build verification

```
xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -configuration Debug build
** BUILD SUCCEEDED **
```

---

## Waivers filed

- #079 — iOS widget extension target not wired in Swift project.
- #080 — TopAgentsWidgetService falls back to `.standard` UserDefaults.
- #081 — Wire TopAgentPicksFeed into `AgentsView.topPicksBranch` (resolves #070).
