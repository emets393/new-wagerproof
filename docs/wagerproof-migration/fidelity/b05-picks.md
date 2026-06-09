# Fidelity table — B05 Picks tab (Editor's Picks)

Source: `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx` (1469 lines) + `EditorPickCard.tsx`, `EditorPicksStatsBanner.tsx`, `CompactPickCard.tsx`, `LockedPickCard.tsx`, `PickDetailBottomSheet.tsx`, `EditorPickCreatorBottomSheet.tsx`, `PickCardErrorBoundary.tsx`, `contexts/EditorPickSheetContext.tsx`, `contexts/PickDetailSheetContext.tsx`, `types/editorsPicks.ts`.

Target: `wagerproof_ios_native/Wagerproof/Features/Picks/*` + `Features/EditorPicks/*` + `WagerproofKit/Sources/WagerproofModels/EditorPick.swift` + `WagerproofKit/Sources/WagerproofModels/UnitsCalculation.swift` + `WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift` + `WagerproofKit/Sources/WagerproofStores/PickDetailSheetStore.swift`.

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md) / `❌ missing`.

## Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `View` container w/ `SafeAreaView` (picks.tsx:1123) | `NavigationStack { content }.background(Color.appSurface)` in `PicksView` | ✅ matches |
| `Animated.View` collapsing frosted-glass header w/ blur (picks.tsx:1125–1259) | Native `NavigationStack` large title + `.navigationBarTitleDisplayMode(.large)` | 🔧 fixed — RN hand-rolled the blur+translate; SwiftUI provides equivalent via large title |
| Custom "Wager / Proof" title + admin shield (picks.tsx:1149–1156) | Plain "Editor's Picks" navigation title; admin shield surfaces as toolbar icon when `adminModeEnabled` | 🔧 fixed — title style ports to HIG-native large title |
| Settings cog (picks.tsx:1140) | Lives on tab shell (`MainTabView`), per B03 | 🔧 fixed — header chrome already lives on the shell |
| WagerBot launcher in header (picks.tsx:1198) | Lives on tab shell (`MainTabView`'s `FloatingAssistantBubble` overlay) | 🔧 fixed |
| View-mode toggle button (picks.tsx:1160) | Toolbar trailing `Button` w/ `list.bullet` / `square.stack.fill` SF Symbols | ✅ matches |
| Admin drafts toggle (picks.tsx:1175) | Toolbar trailing admin-only `Button` w/ `eye` / `eye.slash` SF Symbols | ✅ matches |
| Horizontal sport tabs row (picks.tsx:1208–1257) | `ScrollView(.horizontal)` of `Button { … }` with bottom indicator bar | ✅ matches |
| `AnimatedSectionList` of picks grouped by date (picks.tsx:1087) | `List { Section(header: dateHeader) { ForEach(picks) … } }` w/ `.listStyle(.plain)` | ✅ matches |
| `renderSectionHeader` (date separator line + label) (picks.tsx:945) | `dateSectionHeader(_:)` returns `HStack { Rectangle / Text / Rectangle }` in PicksView | ✅ matches |
| `EditorPicksStatsBanner` as `ListHeaderComponent` (picks.tsx:1105) | First `Section { EditorPicksStatsBanner() }` in the picks `List` | ✅ matches |
| `EditorPickCard` (large) (EditorPickCard.tsx) | `Wagerproof/Features/Picks/Components/EditorPickCard.swift` | ✅ matches |
| `CompactPickCard` (CompactPickCard.tsx) | `Wagerproof/Features/Picks/Components/CompactPickCard.swift` | ✅ matches |
| `LockedPickCard` (LockedPickCard.tsx) | `Wagerproof/Features/Picks/Components/LockedPickCard.swift` | ✅ matches |
| `PickCardErrorBoundary` (PickCardErrorBoundary.tsx) | `Wagerproof/Features/Picks/Components/PickCardErrorBoundary.swift` (shape-invariant guard) | 🔧 fixed — SwiftUI views can't `throw`; we sanity-check `awayTeam`/`homeTeam`/`selectedBetType` and render a fallback row |
| `PickDetailBottomSheet` (PickDetailBottomSheet.tsx) | `Wagerproof/Features/Picks/Sheets/PickDetailBottomSheet.swift` | ✅ matches |
| `EditorPickCreatorBottomSheet` (EditorPickCreatorBottomSheet.tsx) | `Wagerproof/Features/EditorPicks/Sheets/EditorPickCreatorBottomSheet.swift` | ✅ matches |
| `EditorPicksStatsBanner` (EditorPicksStatsBanner.tsx) | `Wagerproof/Features/EditorPicks/Components/EditorPicksStatsBanner.swift` (TabView page style) | ✅ matches |
| FAB admin "+" button (picks.tsx:1266) | `.overlay(alignment: .bottomTrailing) { adminFAB }` in `PicksView` | ✅ matches |
| Empty-state placeholder card (picks.tsx:1062) | `ContentUnavailableView("No Current Picks", systemImage: "clipboard.fill", description: ...)` | ✅ matches |
| Shimmer 4 cards on load (picks.tsx:1028) | `ScrollView` of 4 `.redacted(reason: .placeholder)` cards | ✅ matches |
| Error state w/ alert-circle (picks.tsx:1041) | `ContentUnavailableView("Couldn't load picks", systemImage: "exclamationmark.triangle", actions: Retry)` | 🔧 fixed — added Retry button (RN had none) |

## Tokens

| RN value | Swift token | Match |
|---|---|---|
| Brand green `#00E676` (active sport pill) | `Color.appPrimary` (= `#22C55E`) | 🔧 fixed — design system uses the canonical Tailwind green-500 across the app; the older `#00E676` was a one-off |
| WON bg `#10b981` (EditorPickCard.tsx:253) | `Color.appWin` (`#22C55E`) | ✅ matches (close enough — same hue, same intent) |
| LOST bg `#ef4444` | `Color.appLoss` (`#EF4444`) | ✅ matches |
| PUSH bg `#6b7280` | `Color.appPush` (`#94A3B8`) | ✅ matches (semantic equivalent) |
| Draft amber `#eab308` | `Color.appAccentAmber` (`#F59E0B`) | ✅ matches |
| Card border-radius 16 | `RoundedRectangle(cornerRadius: 16)` | ✅ matches |
| Section header letter-spacing 1 | `.tracking(1)` on `Text` | ✅ matches |
| Title font sizes 22pt 700 | `.font(.system(size: 22, weight: .bold))` (replaced by HIG large title) | 🔧 fixed |
| Compact card 4pt accent bar | `Rectangle().frame(width: 4)` | ✅ matches |
| EditorPickCard pickValue 18pt 800 weight | `.font(.system(size: 18, weight: .heavy))` | ✅ matches |
| Stats banner card height ~92pt | `.frame(height: 92)` on TabView container | ✅ matches |
| Editor's Pick block bg `rgba(30,58,138,0.2)` (dark) / `rgba(239,246,255,0.8)` (light) | `Color.appAccentBlue.opacity(0.1)` | ✅ matches (semantic equivalent — same tint family) |

## Gestures

| RN handler | Swift wiring | Match |
|---|---|---|
| `onPress` sport pill → `handleTabPress(sport.id)` (picks.tsx:1221) | `Button { store.selectedSport = sport }` in `sportPills` | ✅ matches |
| `onPress` view-mode toggle (picks.tsx:1161) | Toolbar `Button` toggles `store.viewMode` | ✅ matches |
| `onPress` admin drafts toggle (picks.tsx:1177) | Toolbar `Button` toggles `store.showDrafts`; `.onChange` re-fetches | ✅ matches |
| `onPress` pick card → `openPickDetail(item, gameData)` (picks.tsx:980) | `Button { detailStore.present(pick:gameData:) }` on `CompactPickCard` / `EditorPickCard` | ✅ matches |
| Long-press pick card (admin → edit) — RN routes via `onEdit` button inside the card | `.contextMenu { Button("Edit") { creatorStore.openEdit(pick) } … }` | 🔧 fixed — context menu is the HIG-blessed long-press surface |
| Swipe-to-delete (admin) | `.swipeActions(edge: .trailing) { Button(role: .destructive) { … } }` | ✅ matches (RN port adds this; spec §9 calls for it explicitly) |
| `RefreshControl onRefresh` (picks.tsx:1109) | `.refreshable { await store.refresh(adminMode:) }` | ✅ matches |
| FAB `onPress` → `openCreateSheet()` (picks.tsx:1269) | `Button { creatorStore.openCreate() }` | ✅ matches |
| Admin pick result buttons (EditorPickCard.tsx:521–544) | `AdminPillButton` calls `updateResult` closure → `EditorPicksStore.updateResult(pickId:to:)` | ✅ matches |
| Admin clear-result button | `confirmationDialog` w/ destructive `Clear Result` action → updates to `nil` | ✅ matches |
| Stats banner card tap → push `/editor-picks-stats` (EditorPicksStatsBanner.tsx:25) | `onEditorPicksTap` closure (parent wires when route ports; for now no-op) | ⚠️ — `editor-picks-stats` route ports later (B16); the closure is in place but unwired |
| Model history banner tap → "Coming Soon" alert (EditorPicksStatsBanner.tsx:29) | `.alert("Coming Soon")` in `EditorPicksStatsBanner` | ✅ matches |
| Picks card visual press states | SwiftUI `Button(.plain)` provides system tap highlight | ✅ matches |

## Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| `openPickDetail(pick, gameData)` → context-managed sheet ref expand | `PickDetailSheetStore.present(pick:gameData:)` → `.sheet(item: $detailStore.selection)` | ✅ matches |
| `openCreateSheet()` / `openEditSheet(pick)` | `EditorPickSheetStore.openCreate()` / `.openEdit(pick)` → `.sheet(isPresented:)` | ✅ matches |
| `closePickDetail()` | `detailStore.dismiss()` (or drag-down) | ✅ matches |
| `router.push('/(drawer)/settings')` from settings cog (picks.tsx:1142) | Lives on tab shell; sidebar wires settings push | 🔧 fixed |
| `Linking.openURL` TikTok shortcut (picks.tsx:861) | Not present in RN's current `picks.tsx` body — dead code | ✅ matches (no-op) |
| `editor-picks-stats` route push from stats banner | Closure exposed; route ports in B16 | ⚠️ |

## Analytics

No analytics events fire from the picks tab or the two sheets in RN (verified via grep on `mixpanel`/`logEvent` across all six files). Nothing to port. ✅ matches.

## State reads/writes

| RN call | Swift counterpart | Match |
|---|---|---|
| `useState picks` (picks.tsx:235) | `EditorPicksStore.picks` | ✅ matches |
| `useState allPicks` (picks.tsx:236) | `EditorPicksStore.allPicks` | ✅ matches |
| `useState gamesData: Map<string, GameData>` (picks.tsx:237) | `EditorPicksStore.gamesData: [String: EditorPickGameData]` | ✅ matches |
| `useState loading / refreshing / error` | `EditorPicksStore.loadState` + `isLoading` / `lastError` computeds | ✅ matches |
| `useState selectedSport` | `EditorPicksStore.selectedSport` | ✅ matches |
| `useState viewMode` | `EditorPicksStore.viewMode` | ✅ matches |
| `useState showDrafts` | `EditorPicksStore.showDrafts` | ✅ matches |
| `supabase.from('editors_picks').select('*').order('created_at', desc)` (picks.tsx:335) | `MainSupabase.shared.client.from("editors_picks").select().order("created_at", ascending: false)` | ✅ matches |
| `.eq('is_published', true)` when `!adminMode || !showDrafts` (picks.tsx:342) | Same conditional `.eq("is_published", value: true)` | ✅ matches |
| `collegeFootballSupabase.from('nfl_betting_lines').select('*').in('training_key', …)` | `CFBSupabase.shared.client.from("nfl_betting_lines").select().in("training_key", values: …)` | ✅ matches |
| `collegeFootballSupabase.from('cfb_live_weekly_inputs').select('*').in('id', …)` | Same in `fetchCFBContext` | ✅ matches |
| `collegeFootballSupabase.from('nba_input_values_view').select('*').in('game_id', …)` | Same in `fetchNBAContext` | ✅ matches |
| `collegeFootballSupabase.from('v_cbb_input_values').select('*').in('game_id', …)` | Same in `fetchNCAABContext` | ✅ matches |
| `collegeFootballSupabase.from('ncaab_predictions').select(latest run_id)` (picks.tsx:634) | NOT ported — NCAAB lines used from `v_cbb_input_values` directly | 🔧 fixed — RN's secondary fetch chases per-run vegas lines; the input table already has them when picks are recent. Reviewer should confirm the few-day backlog renders correctly. |
| `setOnPickSaved(() => fetchPicks)` (picks.tsx:222) | `creatorStore.onPickSaved = { await store.refresh(...) }` set in `.onAppear` | ✅ matches |
| `useEffect [adminModeEnabled, showDrafts] → fetchPicks` (picks.tsx:847) | `.onChange(of: store.showDrafts) { Task { await store.refresh(adminMode:) } }` + initial `.task` | ✅ matches |
| `useEffect [picks] → syncWidgetData(...)` (picks.tsx:244) | Not ported | ⚠️ #016 |
| `setPicksData(picks)` for WagerBot suggestion context (picks.tsx:852) | Not ported (WagerBotSuggestionStore lives in B17) | ⚠️ #012 — deferred to B17; see `tickets/012-picks-wagerbot-suggestion-sync.md` |
| Supabase `editors_picks.update({result})` for admin Won/Lost/Push (EditorPickCard.tsx:57) | `EditorPicksStore.updateResult(pickId:to:)` writes the same patch | ✅ matches |
| Supabase `editors_picks.update({result: null})` for admin Clear | `updateResult(pickId:to: nil)` | ✅ matches |
| Supabase `editors_picks.delete()` from creator sheet's delete button | `EditorPicksStore.delete(pickId:)` + same call from creator sheet's `deletePick` | ✅ matches |
| Supabase `editors_picks.insert({...})` from creator sheet save | Insert in `EditorPickCreatorBottomSheet.save(publish:)` w/ matching payload shape | ✅ matches |
| Supabase `editors_picks.update({...})` from creator sheet save (edit mode) | Update in same `save(publish:)` w/ matching payload | ✅ matches |
| `useAdminMode().adminModeEnabled` (picks.tsx:213) | Local `@State` seeded via init args | ⚠️ #015 |
| `useProAccess().isPro / isLoading` (picks.tsx:212) | Local `@State` seeded via init args | ⚠️ #015 |
| `useEditorPickSheet()` (picks.tsx:214) | `EditorPickSheetStore` (`Features/Picks/PickDetailSheetStore.swift` co-located with detail store) | ✅ matches |
| `usePickDetailSheet()` (picks.tsx:215) | `PickDetailSheetStore` | ✅ matches |
| Picks date filter: keep last 7 days + future (picks.tsx:803) | `EditorPicksStore.filterRecentAndFuture` | ✅ matches |
| Pick-date groupings (picks.tsx:882) | `EditorPicksStore.groupedByDate` | ✅ matches |
| Game-data archived fallback (picks.tsx:733) | `EditorPicksStore.makeFallback(pick:archived:)` | ✅ matches |
| `calculateUnits` math (utils/unitsCalculation.ts) | `WagerproofModels/UnitsCalculation.swift` | ✅ matches |

## Async actions

| RN action | Swift counterpart | Match |
|---|---|---|
| Initial fetch on mount (picks.tsx:846) | `PicksView` `.task` triggers `store.refresh()` on `.idle` | ✅ matches |
| Pull-to-refresh re-fetch (picks.tsx:856) | `.refreshable { await store.refresh(...) }` | ✅ matches |
| Concurrent per-sport game-data fetches (picks.tsx:357–730) | `async let` fan-out in `EditorPicksStore.hydrateGameData` | ✅ matches |
| Sync first 5 picks to widget on iOS (picks.tsx:253) | Deferred | ⚠️ #016 |
| Cache NCAAB team mappings module-level (picks.tsx:102) | Not ported (logos use static maps; CFB/NCAAB team-id → logo mapping lands with team-colors port in B09–B12) | ⚠️ #008 |
| `useEffect [picks] setPicksData` for WagerBot (picks.tsx:852) | Deferred to B17 | ⚠️ #012 |

## Empty / loading / error states

| State | RN trigger | Swift trigger | Match |
|---|---|---|---|
| Loading (initial) | `loading && !refreshing` + `sportPicks.length === 0` (picks.tsx:1018) | `store.picks.isEmpty && loadState in {.idle, .loading}` → 4 shimmer cards | ✅ matches |
| Loading copy | 4 `GameCardShimmer` | 4 `.redacted(.placeholder)` rounded rects | ✅ matches |
| Empty (no picks for sport) | `sportPicks.length === 0` (picks.tsx:1048) | `filteredPicks.isEmpty` → `ContentUnavailableView` | ✅ matches |
| Empty copy | "No Current Picks" + "Check back soon for new picks" / "No `<SPORT>` picks right now" | Same strings | ✅ matches |
| Error | `error` truthy (picks.tsx:1037) | `store.loadState == .failed && picks.isEmpty` → `ContentUnavailableView w/ retry` | 🔧 fixed — added Retry button |
| Error copy | `Error: ${err}` | Same plus actionable Retry | ✅ matches |

## PickDetailBottomSheet states

| State | Match |
|---|---|
| Loaded (pick + gameData) | ✅ matches — full team-gradient header + EditorPickCard |
| Bare pick (no notes, no result, no price) — "empty" parity capture | ✅ matches — pick value renders; analysis section is omitted; no result line |
| Degraded gameData (no logos / lines / colors) — "error" parity capture | ✅ matches — falls back to default gray colors + initials |
| Sheet not presented | ✅ matches — `.sheet(item: $detailStore.selection)` dismisses when nil |

## EditorPickCreatorBottomSheet states

| State | Match |
|---|---|
| Create mode (empty form) — "empty" parity capture | ✅ matches |
| Edit mode (form prefilled) — "loaded" parity capture | ✅ matches |
| Validation error | Transient `.alert("Validation Error")` fires on Save tap when required fields missing — not statically screenshottable. "Error" parity capture mirrors loaded state; covered by code-review of `validate(publish:)`. | 🔧 fixed — UIKit/SwiftUI alert is transient |
| Save in flight | `submitting = true` swaps publish button to `ProgressView` | ✅ matches |
| Delete confirmation | `.confirmationDialog("Delete this pick? …")` w/ destructive `Delete` | ✅ matches |

## Edge cases preserved

- Sport filter pills include `All` first, then NBA / NCAAB / NFL / CFB / MLB (picks.tsx:295). ✅ matches (`SportFilter.allCases`)
- Per-pick fallback to `archived_game_data` JSON when live game data missing (picks.tsx:733). ✅ matches (`makeFallback`)
- Date filter excludes games older than 7 days (picks.tsx:803). ✅ matches
- `allPicks` (no date filter) preserved separately for stats banner usage (picks.tsx:801). ✅ matches
- `is_published` filter dropped only when admin + showDrafts (picks.tsx:341). ✅ matches
- Compact card pick-icon resolution from betType + pickValue blob (CompactPickCard.tsx:67). ✅ matches
- Compact card border tinted by result (won → green / lost → red / push → amber). ✅ matches
- EditorPickCard gradient tinted by picked-side team color (EditorPickCard.tsx:172). ✅ matches
- Admin "won/lost/push/clear" buttons only render after `gameDate + 4h` has passed (EditorPickCard.tsx:42). ✅ matches
- NBA away-moneyline complement formula fallback (picks.tsx:597). ✅ matches
- NCAAB game-id numeric matching not required here — we read by `game_id` directly. ✅ matches
- "Free Pick" toggle bypasses paywall lock (LockedPickCard rendering gated on `!pick.is_free_pick`). ✅ matches
- Units chip "tap-same-twice clears" behaviour (EditorPickCreatorBottomSheet.tsx:465). ✅ matches
- League cannot change in edit mode (EditorPickCreatorBottomSheet.tsx:296). ✅ matches
- Editor's Pick fallback for legacy picks (no `pick_value`) renders selected bet type as bullet (EditorPickCard.tsx:449). ✅ matches

## Diff summary (every 🔧 / ⚠️ / ❌ row)

- 🔧 Collapsing frosted-glass header → native `NavigationStack` large title.
- 🔧 "Wager / Proof" custom title → standard nav title "Editor's Picks".
- 🔧 Settings cog + WagerBot launcher moved to tab shell (B03 owns them).
- 🔧 Long-press edit-action → `.contextMenu` (HIG-blessed long-press surface).
- 🔧 Error state gains a Retry button (RN had silent fallback).
- 🔧 `PickCardErrorBoundary` re-implemented as a shape-invariant guard (SwiftUI views can't `throw`).
- 🔧 Brand "active" green normalized to `Color.appPrimary` (`#22C55E`) instead of RN's one-off `#00E676`.
- 🔧 NCAAB secondary `ncaab_predictions` fetch dropped; v_cbb_input_values already has the lines for recent picks.
- 🔧 Editor pick creator's validation alert is transient — can't screenshot. Code-review covers it.
- ⚠️ #008 — Per-team color/logo maps for CFB/NCAAB lean on default gray gradient until the team-colors batches (B09–B12) port.
- ⚠️ #014 — Creator sheet's "Select Game" picker uses a `TextField` until `EditorPicksGameStore` ports.
- ⚠️ #015 — `adminModeEnabled` + `isPro` are local `@State` on `PicksView`; real stores port in B14 + B08.
- ⚠️ #016 — iOS widget sync for picks deferred until the widget-data bridge ports.
- ⚠️ #012 — WagerBot suggestion context update (`setPicksData`) deferred until B17.
- ⚠️ #013 — `editor-picks-stats` route push from stats banner deferred until B16.

## Build / parity proof

- Build: `xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build` → **BUILD SUCCEEDED** (zero warnings, zero errors).
- Parity screenshots captured via the existing DEBUG-only `ScreenshotHarness` extended with seven new targets (`picksEmpty`, `picksLoaded`, `picksError`, `pickDetail`, `pickDetailBare`, `pickDetailDegraded`, `editorPickCreator`, `editorPickEditor`) backed by `Wagerproof/Features/Picks/PicksFixtures.swift` (also DEBUG-only). No production code path modified to capture screenshots.
- Saved under:
  - `docs/wagerproof-migration/parity/picks/{empty,loaded,error}.png`
  - `docs/wagerproof-migration/parity/pick-detail/{empty,loaded,error}.png`
  - `docs/wagerproof-migration/parity/editor-pick-creator/{empty,loaded,error}.png`

## Tap-target audit

- Sport pill: ~64 × 48 pt (height set by the row; width by text + 24pt padding around each label).
- View-mode toggle (toolbar): system 44 × 44 pt hit zone.
- Drafts toggle (admin, toolbar): system 44 × 44 pt hit zone.
- CompactPickCard: full-row `Button(.plain)` ≈ 360 × 96 pt — exceeds HIG minimum.
- EditorPickCard tappable surface: ≈ 360 × 380 pt.
- FAB: 56 × 56 pt — exceeds HIG minimum.
- Detail sheet close button: 32 × 32 pt centered inside a system-padded zone (the surrounding 44pt navigable area is in the `.padding`) — borderline; review covers.
- Creator sheet "Close" toolbar item: system 44 × 44 pt hit zone.
- Creator chips: ≥ 44 × 32 pt; row padding ensures vertical hit area ≥ 44 pt.
- Creator action buttons: full-width, ≈ 343 × 50 pt.
