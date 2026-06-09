# B07 Scoreboard — Reviewer Verdict

**Verdict:** FAIL
**Build:** ✅ (`** BUILD SUCCEEDED **` on iPhone 16 Pro, Debug)
**Date:** 2026-05-20
**Reviewer:** independent (fresh context, read-only)

---

## Summary

The Swift port itself is well-executed: every RN file has a Swift counterpart (>20 LOC each, no stubs), the backend queries are byte-identical, the store is real (`@Observable LiveScoresStore` polling on a 120s loop), the view binds to it correctly, all native primitives in the spec are present (`NavigationStack` + `ScrollView` + `LazyVStack(pinnedViews:)` + `LazyVGrid` + `.refreshable` + `.sheet(item:)` + `.presentationDetents` + `.presentationDragIndicator(.visible)` + `ContentUnavailableView` + `.sensoryFeedback` on selection and impact), animations use design tokens (`.appStandard`, `.appShimmer`), the screenshot fixtures are `#if DEBUG`-gated, and the three parity screenshots show the correct states.

What blocks PASS: the fidelity table contains **three `❌ missing` rows** without matching `// FIDELITY-WAIVER #NNN` annotations or tickets. Per [REBUILD_PLAN.md](../REBUILD_PLAN.md) §"Hard rules" #2 ("No silent drops") and the agent contract ("A row marked `❌` is a FAIL"), this fails the batch as written.

The implementer needs to either (a) wire the missing behavior, or (b) file tickets and add inline `// FIDELITY-WAIVER #NNN` comments. Option (b) is the lighter lift here since two of the three rows are explicitly slated for B17 (Chat).

---

## Issues (numbered, citable)

### 1. `❌ missing` row #1 — `onPageChange('scoreboard')` — no waiver, no ticket

- **Fidelity claim:** `docs/wagerproof-migration/fidelity/b07-scoreboard.md:58` — "Not yet wired — store will broadcast via shared `WagerBotSuggestionStore` … deferred until B17 (Chat) ports `WagerBotSuggestionStore`"
- **RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx:51–53`
  ```ts
  useEffect(() => {
    onPageChange('scoreboard');
  }, [onPageChange]);
  ```
- **Swift target:** `wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift` — no `onPageChange` analogue, and no `// FIDELITY-WAIVER #NNN` comment.
- **Problem:** The fidelity row is `❌`. No ticket exists for it. No inline waiver in the Swift code. Per `REBUILD_PLAN.md` "Hard rules" #2, this is a silent drop.

### 2. `❌ missing` row #2 — `setScoreboardData(games)` — no waiver, no ticket (reviewer brief's primary flag)

- **Fidelity claim:** `fidelity/b07-scoreboard.md:81` — "Not yet wired — pending B17"
- **RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx:48,56–60`
  ```ts
  const { onPageChange, openManualMenu, setScoreboardData } = useWagerBotSuggestion();
  useEffect(() => {
    if (games.length > 0) {
      setScoreboardData(games);
    }
  }, [games, setScoreboardData]);
  ```
- **Swift target:** No `setScoreboardData` call exists in `ScoreboardView.swift` or `LiveScoresStore.swift`. Also no `// FIDELITY-WAIVER #NNN`.
- **Problem:** The 08-spec §2 ("Edge cases preserved from RN", line 1379) explicitly lists this as a required behavior: "Scoreboard data syncs to `WagerBotSuggestionStore` for AI assistant scanning even when not on screen." The implementer dropped it silently. This is the issue the reviewer brief specifically called out.

### 3. `❌ missing` row #3 — `useNetworkState` gating — no waiver, no ticket

- **Fidelity claim:** `fidelity/b07-scoreboard.md:101` — "Not yet wired … deferred — file ticket if discovered as a real-world bug"
- **RN source:** `wagerproof-mobile/hooks/useLiveScores.ts:10–11,27–36`
  ```ts
  const { isConnected, isInternetReachable } = useNetworkState();
  const isOnline = isConnected && isInternetReachable !== false;
  useEffect(() => {
    if (!isOnline) return;
    fetchGames();
    const interval = setInterval(fetchGames, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchGames, isOnline]);
  ```
- **Swift target:** `WagerproofKit/Sources/WagerproofStores/LiveScoresStore.swift:48–65` polls unconditionally; no network gating, no `// FIDELITY-WAIVER #NNN`.
- **Problem:** The fidelity row is `❌`. The implementer's own note even says "file ticket" — but they didn't. Per `REBUILD_PLAN.md` "Hard rules" #2 ("file a `docs/wagerproof-migration/tickets/NNN-<slug>.md` waiver AND annotate the Swift code with `// FIDELITY-WAIVER #NNN`"), this is a silent drop.

### 4. Note on the two `⚠️` rows (#007, #008) — these PASS

- `⚠️ #007` (NoGamesTerminal → ContentUnavailableView): ticket exists at `tickets/007-no-games-terminal.md`, inline `// FIDELITY-WAIVER #007` at `ScoreboardView.swift:150`. ✅
- `⚠️ #008` (TeamCircleView brand-green fallback): ticket exists at `tickets/008-team-colors.md`, inline `// FIDELITY-WAIVER #008` at `LiveScorePredictionCard.swift:197`. ✅
- `scripts/wagerproof-migration/grep-waivers.sh` exits 0. ✅

### 5. Native primitives spot-check — PASS

All items from `08-screen-native-spec.md` §2 are present in `ScoreboardView.swift`:
- `NavigationStack` (line 46) ✅
- `ScrollView` (line 96) ✅
- `.refreshable { await store.refresh() }` (line 70–72) ✅
- `.sheet(item: $selectedGame)` (line 73) ✅
- `.presentationDetents([.medium, .large])` + `.presentationDragIndicator(.visible)` (`LiveScoreDetailModal.swift:58–59`) ✅
- `LazyVStack(pinnedViews: [.sectionHeaders])` (line 203) ✅
- `LazyVGrid(columns: ..., count: 2)` (lines 137, 213) ✅
- `ContentUnavailableView` (line 155) ✅
- `.sensoryFeedback(.selection, trigger: isExpanded)` (line 90) ✅
- `.sensoryFeedback(.impact(weight: .medium), trigger: game.id)` on sheet (line 79) ✅
- `.sensoryFeedback(.impact(weight: .light), trigger:)` on card tap (line 221) ✅
- `.symbolEffect(.bounce, value: isExpanded)` (line 66) ✅
- `.contentTransition(.numericText())` on score numbers (`LiveScoreCard.swift:112,120`; etc.) ✅

### 6. SF Symbol parity — PASS

`ScoreboardView.swift:302–311` maps NFL→`shield.lefthalf.filled`, NCAAF/CFB→`trophy.fill`, NBA/NCAAB→`basketball.fill`, NHL→`hockey.puck.fill`, MLB→`baseball.fill`, MLS/EPL→`soccerball`. Matches `08-spec` §2 "SF Symbol swaps" table exactly. ✅

### 7. Animation tokens — PASS

No raw `.spring(...)` calls anywhere in `Features/Scoreboard/`. Animations resolve to `.appStandard` (line 113–114), `.appShimmer` (LiveScoreCardShimmer.swift:48), and `.easeInOut` for the hitting-pulse loop (LiveScoreCard.swift:81 — this is a finite repeating pulse, not a token-eligible state change; reasonable). ✅

### 8. No `@State` fakes — PASS

`grep -rE "@State.*=\s*\[" Features/Scoreboard/` returns no matches. `grep -rEi "(mock|sample|placeholder|stub)Data"` returns no matches. `ScoreboardFixtures.swift` is correctly wrapped in `#if DEBUG ... #endif` (lines 1, 199). ✅

### 9. Real-store wiring — PASS

`ScoreboardView` holds `@State private var store: LiveScoresStore` and the store calls `LiveScoresService.shared.getLiveScores()` which calls `MainSupabase.shared.client` + `CFBSupabase.shared.client`. No inline fetches in the view. ✅

### 10. Backend byte-identity — PASS

Compared `LiveScoresService.swift` against `wagerproof-mobile/services/liveScoresService.ts`:
- `live_scores` query: `.eq("is_live", true).order("league").order("away_abbr")` ✅
- NFL: `nfl_predictions_epa` run_id resolution + `training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob` select + `nfl_betting_lines` merge ✅
- CFB: `cfb_live_weekly_inputs` + `cfb_api_predictions` (join on `id`) ✅
- NBA: `nba_predictions` ordered by `as_of_ts_utc` + `nba_input_values_view` merge ✅
- NCAAB: `ncaab_predictions` ordered by `as_of_ts_utc` ✅
- `calculatePredictionStatus` math: ML/spread/OU branches, sign-flip logic, `0.5 + min(diff*0.05, 0.35)` heuristic for NBA spread — all match the TS verbatim.

### 11. Parity screenshots — PASS

- `parity/scoreboard/empty.png` (23 KB) — shows "Live Scoreboard" title, "No live games right now" + ContentUnavailableView. ✅
- `parity/scoreboard/loaded.png` (40 KB) — shows three league sections (NFL, NBA, College Basketball) with badges, hitting cards (green border), missing cards (red border). ✅
- `parity/scoreboard/error.png` (24 KB) — shows error banner with retry button. ✅

### 12. Inventory flip — PASS

8 rows in `inventory.overrides.csv` for B07 RN files, all `candidate`:
- `app/(drawer)/(tabs)/scoreboard.tsx`
- `components/LiveScoreCard.tsx`
- `components/LiveScoreCardShimmer.tsx`
- `components/LiveScorePredictionCard.tsx`
- `components/LiveScoreDetailModal.tsx`
- `services/liveScoresService.ts`
- `hooks/useLiveScores.ts`
- `types/liveScores.ts`

### 13. Waivers script — PASS

`scripts/wagerproof-migration/grep-waivers.sh` exits 0; six tracked waivers (#001, #002, #003, #004, #007, #008) all map to open tickets.

---

## Required actions for implementer

Pick option A or option B per `❌` row. The lightest path is option B for all three since two are already slated for B17.

### Action 1: Resolve `onPageChange('scoreboard')` (Issue #1)

- **Option A:** Wire a `WagerBotSuggestionStore` stub in `WagerproofStores/` now and call `wagerBotStore.onPageChange("scoreboard")` from `.task` in `ScoreboardView`.
- **Option B (recommended):** File `tickets/NNN-wagerbot-page-change-binding.md` ("WagerBot suggestion store deferred to B17") and add `// FIDELITY-WAIVER #NNN: WagerBotSuggestionStore ports in B17` at the relevant `.task` site in `ScoreboardView.swift`.

### Action 2: Resolve `setScoreboardData(games)` (Issue #2 — reviewer brief's primary concern)

- **Option A:** Add a `WagerBotSuggestionStore.setScoreboardData(_:)` stub now and wire `LiveScoresStore` to push `games` into it on every refresh.
- **Option B (recommended):** File `tickets/NNN-scoreboard-wagerbot-sync.md` ("Scoreboard → WagerBot suggestion store sync deferred to B17 per 08-spec §2 edge case") and add `// FIDELITY-WAIVER #NNN: Scoreboard games sync to WagerBotSuggestionStore lands in B17` either at the call-site in `ScoreboardView.swift` (where it would fire on `games` change) or at the top of `LiveScoresStore.swift` next to the property comment.

### Action 3: Resolve `useNetworkState` gating (Issue #3)

- **Option A:** Add a `NetworkStateStore` (or use `NWPathMonitor` directly) and gate the polling loop in `LiveScoresStore.start()` on connectivity.
- **Option B (recommended):** File `tickets/NNN-livescores-network-gating.md` ("Defer network-state-aware polling until B22 hardening; URLSession retries are cheap") and add `// FIDELITY-WAIVER #NNN` at `LiveScoresStore.swift:54` (the polling-loop body).

### After fixing

Re-run `scripts/wagerproof-migration/grep-waivers.sh` (exit 0 required) and update the three `❌` rows in `fidelity/b07-scoreboard.md` to `⚠️ #NNN` with the new ticket numbers, then re-submit for review.

---

## Recommendation (if PASS — for future use)

Once the three `❌` rows resolve to `⚠️ #NNN` (with tickets + inline waivers), the eight inventory rows should flip from `candidate` → `reviewed`. The exact rows to add to `inventory.overrides.csv` after a clean PASS:

```
wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx,scoreboard,screen,reviewed,B07 reviewed; 3 ⚠️ waivers (WagerBot + network state) deferred to B17/B22,,
wagerproof-mobile/components/LiveScoreCard.tsx,LiveScoreCard,component,reviewed,B07 reviewed,,
wagerproof-mobile/components/LiveScoreCardShimmer.tsx,LiveScoreCardShimmer,component,reviewed,B07 reviewed,,
wagerproof-mobile/components/LiveScorePredictionCard.tsx,LiveScorePredictionCard,component,reviewed,B07 reviewed; team colors ticket #008 still open,,
wagerproof-mobile/components/LiveScoreDetailModal.tsx,LiveScoreDetailModal,sheet,reviewed,B07 reviewed; native .sheet,,
wagerproof-mobile/services/liveScoresService.ts,liveScoresService,service,reviewed,B07 reviewed; backend byte-identical,,
wagerproof-mobile/hooks/useLiveScores.ts,useLiveScores,hook,reviewed,B07 reviewed; ported to LiveScoresStore,,
wagerproof-mobile/types/liveScores.ts,liveScores,type,reviewed,B07 reviewed; ported to WagerproofModels/LiveScore.swift,,
```

Do NOT apply these now — the orchestrator applies them only after the implementer addresses Issues #1–#3 and the batch returns clean.
