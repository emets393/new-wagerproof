# B03 — Tab shell + side menu + drawer — Fidelity table

Batch: B03 (Tab shell + side menu + drawer)
Owner: implementer agent
Build status: `xcodebuild ... build` succeeded.
Parity screenshots: `docs/wagerproof-migration/parity/main-tab/`

## Scope mapping

| RN source | Swift target | Status | Notes |
|---|---|---|---|
| `app/(drawer)/(tabs)/_layout.tsx` | `Wagerproof/Features/Navigation/MainTabView.swift` | ported | Native `TabView` replaces RN `FloatingTabBar` overlay. |
| `app/(drawer)/_layout.tsx` | `Wagerproof/Features/Navigation/MainTabView.swift` + `SideMenuSheet.swift` | ported | RN drawer collapsed into a hamburger-opened `.sheet` per HIG. |
| `components/SideMenu.tsx` | `Wagerproof/Features/Navigation/SideMenuSheet.swift` | ported (structural) | Navigate / More / Preferences / Support / Legal / Sign Out rows wired. Subscription state + secret-settings tap lands in B08/B22. |
| `components/FloatingAssistantBubble.tsx` | `Wagerproof/Features/Navigation/FloatingAssistantBubble.swift` | partial | Always-on launcher pill is shipped. Draggable detached bubble + typewriter animation deferred to B17 (Chat). |
| `components/OfflineBanner.tsx` | `Wagerproof/Features/Navigation/OfflineBanner.swift` | ported | `@react-native-community/netinfo` → `NWPathMonitor`. |
| `components/GlobalErrorBoundary.tsx` | n/a | deferred | SwiftUI doesn't have React-style error boundaries. Per scope, becomes a `.alert` integration. Lands when the first feature view that needs an error-recovery alert ships — out of scope for navigation chrome. |
| `app/_layout.tsx` (root providers) | `Wagerproof/App/WagerproofApp.swift` + `RootView.swift` | refined | `.ready` branch now renders `MainTabView`. Deep-link consumption wired through `RootRouter.consumePendingDeepLink()` on `MainTabView.onChange(of: phase)`. |
| `components/navigation/*.tsx` | n/a | scoped out | Directory is empty in the RN source. |

## New Swift files

| Path | Purpose |
|---|---|
| `WagerproofKit/Sources/WagerproofStores/MainTabStore.swift` | Observable tab selection + side-menu open state + scroll-to-top trigger. |
| `Wagerproof/App/ScaffoldPlaceholder.swift` | Extracted from `RootView.swift`; reused by both `RootView` and downstream batches. |
| `Wagerproof/Features/Navigation/MainTabView.swift` | Five-slot tab shell with hamburger toolbar, offline banner, floating WagerBot launcher. |
| `Wagerproof/Features/Navigation/SideMenuSheet.swift` | Sheet content for the hamburger drawer. |
| `Wagerproof/Features/Navigation/FloatingAssistantBubble.swift` | Always-on bottom-trailing launcher pill. |
| `Wagerproof/Features/Navigation/OfflineBanner.swift` | Top-pinned offline banner driven by `NWPathMonitor`. |
| `Wagerproof/App/ScreenshotHarness.swift` (DEBUG only) | Launch-arg-gated harness for parity screenshots. |

## Tab order

Per `REBUILD_PLAN.md` B03 line 104 — five visible tabs: Games · Picks · Outliers · Scoreboard · Settings.

Note: this intentionally diverges from the RN bottom bar (Games / Agents / Outliers / Scoreboard, with Picks `href: null`). The migration plan calls for a five-tab iPhone shell aligned to iOS HIG with Agents reached via the side menu + a `NavigationStack` push in B13. RN's Agents tab is mapped to the side menu's "More → Agents" row.

## Deep link routing

`RootRouter.handle(deepLink:)` already mirrored the RN map in B01. This batch wires consumption:

- `wagerproof://picks` → `MainTabStore.selected = .picks`
- `wagerproof://outliers` → `MainTabStore.selected = .outliers`
- `wagerproof://feed` → `MainTabStore.selected = .games`
- `wagerproof://agents` → opens the side menu sheet so the user can navigate from there until B13 lands the Agents stack.
- `wagerproof://reset-password` → ignored by the tab shell (auth router handles).

## Items deferred (and where they land)

| Item | Deferred to | Reason |
|---|---|---|
| Real per-tab feature views | B04 (Games) / B05 (Picks) / B06 (Outliers) / B07 (Scoreboard) / B08 (Settings) | Each tab's body is a `ContentUnavailableView` placeholder pinned to the tab's `NavigationStack`. |
| Subscription state in side menu (Pro pill, manage subscription, sign-out flow polish) | B08 (Settings + RevenueCat) | Requires RevenueCat client + `useProAccess` port. |
| Side-menu secret-settings double-tap | B08 / B22 | Requires the secret-settings screen. |
| Agents push from side menu | B13 (Agents tab) | Agents stack hasn't landed yet. |
| WagerBot push from floating bubble | B17 (Chat) | Chat screen + suggestion bubble draggable mode haven't landed. |
| `WagerBotSuggestionBubble` draggable detached mode + typewriter | B17 (Chat) | Out of navigation-shell scope. |
| Live-scores tab badge pulse on Scoreboard | B07 (Scoreboard) | Requires `LiveScoresStore` to expose `hasLiveGames` — partially exists but the tab-badge overlay belongs with the live-scores feature port. |
| `GlobalErrorBoundary` → `.alert` integration | TBD (first feature view that needs alert recovery) | SwiftUI doesn't have a single root-level error-boundary surface; integration is per-screen. |

## Waivers

None opened. All deviations are documented as "deferred" above and tracked against the corresponding downstream batch.

## Quirks / decisions

1. **No native iPhone drawer.** RN's `expo-router/drawer` is collapsed into a `.sheet` opened by the toolbar hamburger. Justified in `docs/wagerproof-migration/08-screen-native-spec.md` §6 and the iOS HIG.
2. **Native `TabView`, not a custom `FloatingTabBar`.** RN renders an `AndroidBlurView` overlay with custom hit testing. Native `TabView` already provides the same blur and accessibility behavior; we tint to `#00E676` for parity.
3. **`MainTabStore` initial-tab injection via `init(initialTab:openSideMenu:)`.** Production callers use the default; the DEBUG screenshot harness passes overrides. No production code paths set fake state — the harness is gated by `#if DEBUG` and launch arg.
4. **Color token visibility fix.** Made `Color.init(hex:opacity:)` and `Color.init(light:dark:)` public in `WagerproofDesign/Tokens.swift` so feature targets can call them. Was internal-only — every existing `Color(hex: ...)` call site (including `EmailLoginView`) needed this access bump.
5. **Stub auth screens.** `EmailLoginView`, `SignupView`, `ForgotPasswordView` were referenced from B02's `AuthRouter.swift` but missing. EmailLoginView was already restored to the full implementation by the linter; Signup + ForgotPassword ship as `ScaffoldPlaceholder`-backed stubs so the unauthenticated stack compiles. Real implementations land in B02.
6. **`LiveScoreCard.swift` typo fix.** Pre-existing scaffold had `if hasPredictions, let line = predictionsLine` where `predictionsLine` is `some View` (non-optional). Changed to `if hasPredictions { predictionsLine }`. Belongs with B07 conceptually but the file was already in source and blocking the build.

## Parity screenshots

| Screenshot | File |
|---|---|
| Games tab (default) | `parity/main-tab/tab-games.jpg` |
| Picks tab | `parity/main-tab/tab-picks.jpg` |
| Outliers tab | `parity/main-tab/tab-outliers.jpg` |
| Scoreboard tab | `parity/main-tab/tab-scoreboard.jpg` |
| Settings tab | `parity/main-tab/tab-settings.jpg` |
| Side menu sheet open | `parity/main-tab/side-menu-open.jpg` |

Captured with the DEBUG-only screenshot harness:
```
xcrun simctl launch booted com.wagerproof.mobile \
  -uiScreenshotMode mainTabs \
  -tab <games|picks|outliers|scoreboard|settings> \
  [-showSideMenu 1]
```
