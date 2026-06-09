# B03 — Tab shell + side menu + drawer — Reviewer verdict

**Reviewer:** `b03-reviewer-2026-05-20`
**Verdict:** ✅ PASS (with 2 minor data-hygiene observations + 1 design-pattern note — none block the batch)
**Build:** ✅ `** BUILD SUCCEEDED **` (iPhone 16 Pro simulator, Debug)
**Waivers script:** ✅ exit 0 ("Tracked waivers: 6. All waivers map to tickets.")

---

## Summary

The implementer landed a coherent native-iOS tab shell that respects iOS HIG, mirrors the RN deep-link map, wires the drawer-as-sheet pattern that 08-spec §6 prescribes, and keeps the floating WagerBot launcher overlaid on every tab's content. The five-tab divergence (Games · Picks · Outliers · Scoreboard · Settings vs RN's Games · Agents · Outliers · Scoreboard with Picks hidden) is **explicitly authorized by REBUILD_PLAN.md Phase 2 line 104** (`MainTabView (TabView with 4-5 visible tabs: Games, Picks, Outliers, Scoreboard, Settings)`) and batches.md §B03 line 104 — citation confirmed. Agents is re-routed through the side menu's "More" section as a `placeholderRow` until B13 lands.

All 6 parity screenshots exist (jpg per allowance) and visually confirm the named states.

---

## Critical-question answers

### 1. Tab order divergence

✅ **Documented + justified.**

- `REBUILD_PLAN.md` line 104 in the B03 row explicitly says *"TabView with 4-5 visible tabs: Games, Picks, Outliers, Scoreboard, Settings"*.
- `batches.md` §B03 line 104 repeats the same five-tab list.
- `08-screen-native-spec.md` §7 line 648 says *"The Picks tab is hidden from the visible bar (`href: null`) but pushed from the drawer side menu. Mirror by NOT including Picks in the TabView"* — which is the OPPOSITE of what shipped. The implementer chose to follow the REBUILD_PLAN over the 08-spec. The fidelity table acknowledges this divergence (line 35–37). Since REBUILD_PLAN is the authoritative contract (per its line 24 "Hard rules") and Picks is reachable from BOTH the tab bar AND the side menu, no information is lost; Agents simply moves the other direction (out of the bar, into the menu). I accept the divergence.
- **Side menu exposes Agents:** verified — `SideMenuSheet.swift` line 92 renders `placeholderRow(title: "Agents", systemImage: "brain.head.profile", note: "Agents (B13)")` in the "More" section. The screenshot `side-menu-open.jpg` shows the row prominently. Discoverable.
- **Deep link `wagerproof://agents` still routes:** verified — `MainTabStore.apply(deepLink:)` line 64–67 sets `isSideMenuPresented = true` instead of switching tabs, so a widget-tap or push-notification lands the user on the side menu where Agents is visible. The fidelity table documents this. Once B13 lands the Agents stack, this same hook will push into the stack instead of opening the sheet (or the sheet's Agents row will push).

### 2. Deep link mapping

✅ Every URL listed in `app/(drawer)/_layout.tsx`'s handler is mapped:

| RN | Swift |
|---|---|
| `wagerproof://picks` | `DeepLinkRoute.picks` → `MainTabStore.selected = .picks` |
| `wagerproof://agents` | `DeepLinkRoute.agents` → opens side menu (Agents row inside, until B13) |
| `wagerproof://outliers` | `DeepLinkRoute.outliers` → `MainTabStore.selected = .outliers` |
| `wagerproof://feed` | `DeepLinkRoute.feed` → `MainTabStore.selected = .games` |
| Unknown | `DeepLinkRoute.init` defaults to `.feed` → `.games` (matches RN's default) |
| `wagerproof://reset-password` | `DeepLinkRoute.resetPassword` → no-op for tab shell (auth router owns it) |

The buffer + replay pattern (`pendingDeepLinkRoute` + `consumePendingDeepLink()`) handles both cold-start (URL arrives before `.ready`) and warm-start (URL arrives while `.ready`). Both paths covered by separate `.onChange` handlers in `MainTabView.swift` lines 85–99.

### 3. Hamburger drawer-as-sheet

✅ `MainTabView.swift` line 76–81 presents `SideMenuSheet` via `.sheet(isPresented:)` with `.presentationDetents([.large])` and `.presentationDragIndicator(.visible)`. The hamburger button is a `topBarLeading` toolbar item per `tabContent` line 122–131. Matches 08-spec §6 prescription.

### 4. OfflineBanner

✅ `NWPathMonitor` is used (line 49 `let m = NWPathMonitor()`), runs on a background `DispatchQueue`, re-publishes to `MainActor` via `Task { @MainActor in ... }`. The `.task` lifecycle starts/stops cleanly via `.onDisappear`. No polling loop.

Surfacing in `MainTabView`: the banner is composed inside `tabContent` via `ZStack(alignment: .top)` (line 113), not `.safeAreaInset(edge: .top)` or `.overlay(alignment: .top)` as the brief suggested. ZStack-top is functionally similar — the banner renders on top of the placeholder content via its red background. This is a minor stylistic choice; not a failure. Worth noting for the implementer that `.safeAreaInset(edge: .top)` would auto-push tab content down and is the more idiomatic SwiftUI primitive when the banner should NOT overlap content.

### 5. FloatingAssistantBubble overlay

✅ `MainTabView.swift` line 133–138 applies `.overlay(alignment: .bottomTrailing) { FloatingAssistantBubble { ... } }` on the placeholder inside `tabContent` (the shell-level wrapper that runs for every tab), NOT inside per-feature view files. When real feature views replace `ContentUnavailableView` in B04–B08, the overlay stays in the shell wrapper. Per-tab implementations won't need to know about the bubble. Verified.

---

## Standard checks

| # | Check | Result |
|---|---|---|
| 1 | Build green | ✅ `** BUILD SUCCEEDED **` |
| 2 | No `❌` in fidelity table | ✅ All rows `ported` / `partial` / `deferred` |
| 3 | No `@State` fakes in `Features/Navigation/` | ✅ Only `MainTabStore` (owned store), `isConnected`, `didDismiss`, `monitor` (local UI state) — no fake arrays |
| 4 | `MainTabView` real-store wiring | ⚠️ See "Design-pattern note" below |
| 5 | Native primitives (`TabView` + `.tabItem`) | ✅ Lines 41–71 |
| 6 | SF Symbol parity | ✅ `trophy.fill`, `star.fill`, `bell.badge.fill`, `sportscourt.fill`, `gearshape.fill`, `brain.head.profile`, `line.3.horizontal` — all canonical |
| 7 | Animation tokens | ✅ `.appStandard` in OfflineBanner; no raw `.spring(...)` |
| 8 | Parity screenshots | ✅ 6 .jpg files: tab-games / tab-picks / tab-outliers / tab-scoreboard / tab-settings / side-menu-open |
| 9 | Waivers script | ✅ exit 0 |
| 10 | Inventory rows `status=candidate` | ✅ All 6 rows correctly `candidate`. See observations. |

---

## Observations (non-blocking)

### Obs 1 — Implementer pre-filled `reviewer` + `reviewed_at` on its own rows

The 6 B03 rows in `inventory.overrides.csv` have `reviewer=b03-implementer` and `reviewed_at=2026-05-20`. Per REBUILD_PLAN §"Done" gate G8, the **reviewer** flips status to `reviewed` and stamps those columns. The implementer's job is to leave the `reviewer` cell blank (or use their own ID with status=`candidate`) and let the reviewer fill in their own ID with status=`reviewed`. Status is still `candidate`, so the batch isn't broken — but on the next batch, the implementer should leave `reviewer`/`reviewed_at` blank to avoid implying premature signoff.

### Obs 2 — `app/_layout.tsx` not in inventory.overrides.csv

The B03 fidelity table claims `app/_layout.tsx` is "refined" (root providers), but there's no row in `inventory.overrides.csv` for this file. It was already in scope for B01 (foundation) and may have been counted there. Not a B03 failure, but the inventory delta is incomplete for end-to-end audit. Suggest the orchestrator add a row marking `app/_layout.tsx` as `candidate` with a note pointing at `WagerproofApp.swift` + `RootView.swift`.

### Design-pattern note — `MainTabStore` ownership

`MainTabView.swift` line 27 declares `@State private var tabStore: MainTabStore` and creates the store in `init(initialTab:openSideMenu:)`. It then injects via `.environment(tabStore)` for children. The reviewer brief said "MainTabView reads from `@Environment(MainTabStore.self)`" — implying the store is owned at the app level and injected into MainTabView. Honeydew's `MainTabView` does it that way (uses `@Environment(TabSelection.self)`).

The current pattern is **OK but less standard**:
- ✅ The store is real (no `@State` fakes).
- ✅ Children (`SideMenuSheet`) consume it via `@Environment(MainTabStore.self)` (verified line 24).
- ⚠️ Re-creating MainTabView (e.g. on phase change) would create a fresh store. That's not currently a problem because RootView only renders MainTabView on `.ready` and doesn't re-mount, but it's brittle.
- ⚠️ Init-param overrides (`initialTab`, `openSideMenu`) are described as "screenshot harness only" but exist in the public init — a non-test caller could pass them.

**Recommendation (non-blocking):** in a future cleanup batch, lift `MainTabStore` ownership into `WagerproofApp` and inject via `.environment(mainTabStore)`. For now, the current design satisfies the contract because the store is single-source-of-truth and children read from Environment.

---

## Inventory rows to flip (PASS recommendation)

If the orchestrator confirms PASS, append the following 6 rows to `inventory.overrides.csv` (do NOT amend the existing rows — append new rows so the audit trail shows both the implementer's `candidate` stamp and the reviewer's `reviewed` stamp; the inventory builder uses the last row per `rn_path`):

```csv
wagerproof-mobile/app/(drawer)/(tabs)/_layout.tsx,_layout,layout,reviewed,B03 reviewer PASS — MainTabView native TabView + .sheet drawer,b03-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/app/(drawer)/_layout.tsx,_layout,layout,reviewed,B03 reviewer PASS — drawer collapsed into MainTabView + SideMenuSheet,b03-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/components/SideMenu.tsx,SideMenu,component,reviewed,B03 reviewer PASS — structural rows + nav; sub state lands B08,b03-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/components/FloatingAssistantBubble.tsx,FloatingAssistantBubble,component,reviewed,B03 reviewer PASS — launcher pill shipped; draggable mode lands B17,b03-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/components/OfflineBanner.tsx,OfflineBanner,component,reviewed,B03 reviewer PASS — NWPathMonitor port,b03-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/components/GlobalErrorBoundary.tsx,GlobalErrorBoundary,component,reviewed,B03 reviewer PASS — deferred to per-screen .alert per RN→Swift idiom delta,b03-reviewer-2026-05-20,2026-05-20
```

Total rows to flip: **6**.
