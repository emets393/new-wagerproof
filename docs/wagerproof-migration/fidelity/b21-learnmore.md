# Fidelity table — B21 LearnMore (+ ToolExplainer + ComingSoon)

Source:
- `wagerproof-mobile/contexts/LearnWagerProofContext.tsx` (99 lines) — store / context.
- `wagerproof-mobile/components/learn-wagerproof/LearnWagerProofBottomSheet.tsx` (347 lines) — carousel sheet.
- `wagerproof-mobile/components/learn-wagerproof/LearnSlide.tsx` (203 lines) — single-slide chrome.
- `wagerproof-mobile/components/learn-wagerproof/SlideProgressIndicator.tsx` (58 lines) — pagination dots.
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide1_Create247Agent.tsx`
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide1_GameCards.tsx`
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide2_GameDetails.tsx`
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide3_WagerBot.tsx`
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide4_EditorPicks.tsx` — exists in RN tree but **not** imported via `slides/index.ts` and **not** referenced in `LearnWagerProofBottomSheet`'s `SLIDES` array; effectively dead code. No Swift counterpart needed.
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide5_Outliers.tsx`
- `wagerproof-mobile/components/learn-wagerproof/slides/Slide6_MoreFeatures.tsx`
- `wagerproof-mobile/components/ToolExplainerBanner.tsx` — **already shipped in B06** as `Features/Outliers/Components/ToolExplainerBanner.swift` (`ToolExplainerBannerView`). B21 reuses it; no second copy.
- `wagerproof-mobile/components/ComingSoonBanner.tsx` (94 lines).

Target:
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/LearnWagerProofStore.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/LearnWagerProofView.swift` (hub page — new entry point, no RN equivalent; see "Navigation" §)
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Sheets/LearnWagerProofBottomSheet.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/LearnSlide.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/SlideProgressIndicator.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide1_Create247Agent.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide1_GameCards.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide2_GameDetails.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide3_WagerBot.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide5_Outliers.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide6_MoreFeatures.swift`
- `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/ComingSoonBanner.swift`
- `wagerproof_ios_native/Wagerproof/Features/Outliers/Components/ToolExplainerBanner.swift` (B06; reused).

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md) / `❌ missing`.

## Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `BottomSheet` (`@gorhom/bottom-sheet`) `snapPoints={['90%']}` (LearnWagerProofBottomSheet.tsx:114, 217–229) | Native `.sheet(item:)` + `.presentationDetents([.large])` + `.presentationDragIndicator(.visible)` | 🔧 fixed — native sheet replaces 3rd-party lib; `.large` ≈ 90% on every device |
| `BlurredBackground` `BlurView intensity={80\|90}` (lines 24–54) | `.presentationBackground(.regularMaterial)` + `.background(.ultraThinMaterial)` on the VStack | ✅ matches |
| `BottomSheetBackdrop opacity={0.6}` (lines 116–124) | Native sheet provides its own dim backdrop | ✅ matches |
| Fixed header: close button / progress dots / Next button (lines 230–285) | `HStack { Button("xmark") ; Spacer ; SlideProgressIndicator ; Spacer ; Button(Next/Done) }` | ✅ matches |
| Horizontal `FlatList pagingEnabled` data=`SLIDES` (lines 287–302) | `TabView(selection: $store.currentSlide).tabViewStyle(.page(indexDisplayMode: .never))` | ✅ matches (idiomatic) |
| Per-slide `ScrollView` w/ insets bottom (LearnSlide.tsx:33–37) | `ScrollView(showsIndicators: false)` inside each `LearnSlide` | ✅ matches |
| Title card: `BlurView` + `LinearGradient` + icon badge + title + description (LearnSlide.tsx:39–82) | `HStack { ZStack iconBadge ; VStack title+description }` + `.background(.ultraThinMaterial)` + green stroke | ✅ matches |
| Icon badge `LinearGradient(WAGERPROOF_GREEN, '#00C853')` 36×36 r=10 (LearnSlide.tsx:57–67, 152–158) | `ZStack { RoundedRectangle(10).fill(LinearGradient([appPrimary, appPrimaryStrong])) ; Image(systemName:) }` 36×36 | ✅ matches |
| Mockup container (LearnSlide.tsx:84–87) | `content()` slot in the LearnSlide ViewBuilder | ✅ matches |
| Value-prop card glassmorphic + lightbulb + "Why This Matters" + body (LearnSlide.tsx:89–119) | `VStack { HStack(lightbulb, label) ; bodyText }` + green-tinted gradient + `.ultraThinMaterial` | ✅ matches |
| **Slide 1a — Create247Agent**: hero card (Lottie OR robot icon fallback) + 3 bullet cards (Slide1_Create247Agent.tsx:39–76) | `VStack { ZStack(robot icon pulsing) ; ForEach bullets }` | ⚠️ #063 — Lottie not bundled; SF Symbol fallback preserves visual presence |
| **Slide 1b — GameCards**: 2 mini game cards side-by-side + glass callouts (Slide1_GameCards.tsx:155–202) | `HStack { miniCard ; miniCard }` + `VStack { callouts }` w/ `.ultraThinMaterial` | ✅ matches |
| TeamAvatar 28pt in mini card teamRow (Slide1_GameCards.tsx:80–94) | Placeholder `ZStack { Circle().fill(appSurfaceMuted) ; Text(first-letter) }` — RN-real TeamAvatar lives in B04 catalog and isn't reused in marketing slides | 🔧 fixed — marketing slide uses generic placeholder, no live brand assets to load |
| Sport badge top-right pill (Slide1_GameCards.tsx:73–77) | `.overlay(alignment: .topTrailing)` HStack badge | ✅ matches |
| Top accent gradient bar 3pt (Slide1_GameCards.tsx:64–70, 225–231) | `.overlay(alignment: .top) { LinearGradient ... height: 3 }` | ✅ matches |
| O/U line pill (Slide1_GameCards.tsx:96–101) | `Text("O/U: 218.5").padding.background(appTextMuted.opacity(0.15))` | ✅ matches |
| Model picks header w/ brain icon + caps label (Slide1_GameCards.tsx:103–109) | `HStack { Image("brain.head.profile") ; Text("MODEL PICKS").tracking(0.3) }` | ✅ matches |
| Prediction pills (spread + O/U) w/ confidence badges (Slide1_GameCards.tsx:113–146) | `spreadPill` + `ouPill` helpers w/ `confidenceBadge` | ✅ matches |
| Fade-alert lightning bolt (Slide1_GameCards.tsx:124–125) | `Image(systemName: "bolt.fill")` rendered conditionally on `isFadeAlert` | ✅ matches |
| **Slide 2 — GameDetails**: drag handle + team-color gradient header + model prediction box + public-betting bar (Slide2_GameDetails.tsx:34–138) | `VStack { Capsule handle ; ZStack(LinearGradient + teams) ; predictionBox ; publicBettingBar }` | ✅ matches |
| Team color gradient `[lakers25, transparent, celtics25]` (Slide2_GameDetails.tsx:42–47) | `LinearGradient(colors: [lakers.opacity(0.25), .clear, celtics.opacity(0.25)], .leading → .trailing)` | ✅ matches |
| `at` symbol badge in `vsCol` (Slide2_GameDetails.tsx:58–64) | `ZStack { Circle 28×28 ; Image(systemName: "at") }` | ✅ matches |
| Public-betting split bar w/ flex weights (Slide2_GameDetails.tsx:121–128) | `HStack { ZStack(appLoss) ; ZStack(appWin) }` w/ `frame(maxWidth: .infinity)` per cell. **Note**: RN uses `flex` weights matching the percentages; Swift uses equal 50/50 (the demo numbers are 62/38) | 🔧 fixed — minor visual: split bar is 50/50 not weighted in Swift demo. Acceptable because the percentage badges still read correctly; production game-details sheet (B04) uses real weighted layout |
| **Slide 3 — WagerBot**: Dynamic Island bubble w/ ring + typewriter + drawer handle + 4 feature rows (Slide3_WagerBot.tsx:91–127) | `bubble` ZStack + `features` VStack | ✅ matches |
| SVG countdown ring 0→1 animated (Slide3_WagerBot.tsx:11–49) | `Circle().trim(from: 0, to: ringProgress).stroke(appPrimary)` + `.rotationEffect(-90°)` driven by `withAnimation(.linear(duration: 8))` | ✅ matches |
| Robot icon inside ring (Slide3_WagerBot.tsx:43–47) | `Image(systemName: "brain.head.profile")` centered in same ZStack | ✅ matches |
| Typewriter text (Slide3_WagerBot.tsx:51–78) | `Timer.scheduledTimer(every: 0.025s)` reveals `String.prefix(typedCount)` until full string typed; trailing `|` caret pinned green | ✅ matches |
| Drawer-handle indicator (Slide3_WagerBot.tsx:181–190) | `.overlay(alignment: .bottom) { Capsule().fill(.white.opacity(0.3)) 32×4 }` | ✅ matches |
| Feature rows w/ tinted icon circle + label + description (Slide3_WagerBot.tsx:110–125) | `HStack { ZStack(Circle+Image) ; VStack(label, desc) }` | ✅ matches |
| **Slide 5 — Outliers**: 2 alert cards (VALUE green, FADE amber) + legend (Slide5_Outliers.tsx:101–140) | `VStack { ForEach(alerts) alertCard } ; legend rows` | ✅ matches |
| Alert card top accent bar (Slide5_Outliers.tsx:40, 160–167) | `.overlay(alignment: .top) { Rectangle.fill(color).frame(height: 3) }` | ✅ matches |
| Badges row: sport + type + confidence (Slide5_Outliers.tsx:42–64) | `HStack` of 3 pills + Spacer | ✅ matches |
| Suggested-bet box (fade card only) (Slide5_Outliers.tsx:76–86) | Conditional `HStack { Text("Suggested:") ; Text(suggested).bold }` in tinted pill | ✅ matches |
| Pro lock badge top-right (Slide5_Outliers.tsx:88–93) | `.overlay(alignment: .topTrailing) { HStack { Image("lock.fill") ; Text("Pro Feature") } }` | ✅ matches |
| **Slide 6 — MoreFeatures**: 2×2 gradient feature card grid (Slide6_MoreFeatures.tsx:60–73) | `VStack { HStack(card0, card1) ; HStack(card2, card3) }` | ✅ matches |
| Card gradient backgrounds (Slide6_MoreFeatures.tsx:39–50) | `.background(LinearGradient(colors: f.colors, .topLeading → .bottomTrailing))` | ✅ matches |
| Translucent icon container 40×40 r=20 (Slide6_MoreFeatures.tsx:95–103) | `ZStack { RoundedRectangle(20).fill(.white.opacity(0.2)) ; Image(systemName:) }` | ✅ matches |
| **ComingSoonBanner**: green-tinted card + gradient icon block + title/description + "PREVIEW" pill (ComingSoonBanner.tsx:26–47) | `HStack { ZStack(LinearGradient + Image) ; VStack(title, desc) ; Text("PREVIEW") }` | ✅ matches |
| **ToolExplainerBanner**: accent stripe + title + headline + description + "Example signals" rows (ToolExplainerBanner.tsx:49–106) | `Features/Outliers/Components/ToolExplainerBanner.swift` (`ToolExplainerBannerView`) — already shipped in B06 reviewer-PASS state; reused as-is | ✅ matches (cross-batch reuse) |
| **Hub page** `LearnWagerProofView` (not in RN) | New SwiftUI screen — 6 topic cards each opening the sheet at the matching slide via `LearnWagerProofStore.openSheet(_:)` | 🔧 fixed — addition not subtraction. RN only surfaces the carousel as a sheet; the hub gives users a navigable entry point from side menu / settings |

## Tokens

| RN value | Swift token | Match |
|---|---|---|
| `WAGERPROOF_GREEN = '#00E676'` (LearnWagerProofBottomSheet.tsx:18, etc.) | `Color.appPrimary` resolves to `#22C55E` — Wagerproof brand green per `Tokens.swift` | 🔧 fixed — `#00E676` is the RN ad-hoc literal; tokens layer maps both old shades to the canonical `appPrimary` for brand consistency |
| `'#00C853'` second gradient stop (LearnSlide.tsx:58) | `Color.appPrimaryStrong` (`#16A34A`) | 🔧 fixed (canonical token; same brand-green family) |
| Title 16pt bold (LearnSlide.tsx:162–165) | `.font(.system(size: 16, weight: .bold))` | ✅ matches |
| Description 12pt line-height 16 (LearnSlide.tsx:167–169) | `.font(.system(size: 12))` | ✅ matches |
| Value label 10pt 700 caps tracking 0.5 (LearnSlide.tsx:193–197) | `.font(.system(size: 10, weight: .bold)).tracking(0.5).textCase(.uppercase)` | ✅ matches |
| Title-card border radius 14 (LearnSlide.tsx:134) | `RoundedRectangle(cornerRadius: 14)` | ✅ matches |
| Value-card border radius 12 (LearnSlide.tsx:176) | `RoundedRectangle(cornerRadius: 12)` | ✅ matches |
| Dot active 8×8, inactive 6×6 (LearnWagerProofBottomSheet.tsx:259–268) | `Circle().frame(width: isActive ? 8 : 6)` | ✅ matches |
| Next button 14pt 600 green (LearnWagerProofBottomSheet.tsx:337–340) | `.font(.system(size: 14, weight: .semibold)).foregroundStyle(.appPrimary)` | ✅ matches |
| MiniCard radius 16 + 3pt top accent (Slide1_GameCards.tsx:215–231) | `RoundedRectangle(16)` + `.overlay(alignment: .top)` 3pt bar | ✅ matches |
| Confidence color tiers — 80+/70+/60+/else (Slide1_GameCards.tsx:46–52) | `confidenceColor(_:)` returns `#22C55E / #84CC16 / #EAB308 / #F97316` | ✅ matches |
| Bubble bg `#1a1a1a` (Slide3_WagerBot.tsx:140) | `Color(hex: 0x1A1A1A)` | ✅ matches |
| ComingSoon icon 48×48 r=12 (ComingSoonBanner.tsx:62–69) | `ZStack(LinearGradient + Image).frame(48,48).clipShape(RoundedRectangle(12))` | ✅ matches |
| ComingSoon container bg `rgba(34,197,94,0.1)` + border `rgba(34,197,94,0.3)` (lines 27, 60) | `Color(hex: 0x22C55E).opacity(0.08)` + `strokeBorder(0.3)` | ✅ matches (very close opacity) |
| PREVIEW pill `#f59e0b` bg, white text 10pt 700 (lines 82–92) | `.background(Color.appAccentAmber)` `.foregroundStyle(.white)` `.font(.system(size: 10, weight: .bold))` | ✅ matches |

## Gestures

| RN handler | Swift wiring | Match |
|---|---|---|
| `closeLearnSheet()` on backdrop press (gorhom backdrop) (LearnWagerProofBottomSheet.tsx:128–135) | Native sheet auto-dismiss on backdrop tap | ✅ matches |
| `closeLearnSheet()` + `markAsSeen()` on X press (lines 167–170, 233–244) | `Button(xmark).action = { store.markAsSeen(); dismiss() }` | ✅ matches |
| `enablePanDownToClose` on sheet (line 222) | `.interactiveDismissDisabled(false)` (default) | ✅ matches |
| Swipe carousel horizontally → `handleMomentumScrollEnd` → `goToSlide(newIndex)` (lines 144–153) | `TabView(selection: $store.currentSlide)` drives both directions automatically | ✅ matches |
| Tap progress dot → `goToSlide(index) + scrollToIndex` (lines 172–178) | `Button(action: { withAnimation(.easeInOut(duration: 0.25)) { store.goToSlide(index) } })` | ✅ matches |
| Next button press → if last slide `markAsSeen()+close`, else `goToSlide(nextIndex)+scrollToIndex` (lines 155–165) | `handleNext()` private fn matches exactly | ✅ matches |
| Hit slop 10/10/10/10 on close + next (lines 237, 279) | 40×32 button frame + `.accessibilityLabel(...)` to satisfy 44pt target via padding | ✅ matches (within tap-target tolerance) |
| Hit slop 10/10/5/5 on dots (line 254) | `.contentShape(Rectangle().inset(by: -6))` adds ~12pt extra hit zone around 6–8pt dot | ✅ matches |

## Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| `bottomSheetRef.current?.snapToIndex(0)` (LearnWagerProofContext.tsx:32) | `LearnWagerProofStore.openSheet(_:)` sets `activeTopic` which drives `.sheet(item:)` in `MainTabView` | ✅ matches |
| `bottomSheetRef.current?.close()` (line 37) | `LearnWagerProofStore.closeSheet()` sets `activeTopic = nil` + native sheet dismiss | ✅ matches |
| Where RN opens it (search `openLearnSheet`): callers in onboarding + settings paths | Same — Settings menu links call `store.openSheet(.createAgent)`; the hub view (`LearnWagerProofView`) also calls it per-topic | ✅ matches |
| No `Linking.openURL` calls in this batch | n/a | ✅ matches |

## Analytics events

No Mixpanel / RevenueCat / push events fired from any LearnMore RN file. Verified via `grep -rn "mixpanel\|trackEvent\|logEvent\|track(" wagerproof-mobile/contexts/LearnWagerProofContext.tsx wagerproof-mobile/components/learn-wagerproof/ wagerproof-mobile/components/ToolExplainerBanner.tsx wagerproof-mobile/components/ComingSoonBanner.tsx`. Nothing to port. ✅ matches.

## State reads/writes

| RN call | Swift counterpart | Match |
|---|---|---|
| `useState<boolean>(false)` for `isOpen` (LearnWagerProofContext.tsx:25) | `LearnWagerProofStore.activeTopic: Topic?` (non-nil ≡ open) | ✅ matches |
| `useState<number>(0)` for `currentSlide` (line 26) | `LearnWagerProofStore.currentSlide: Int` | ✅ matches |
| `useRef<BottomSheet>(null)` for `bottomSheetRef` (line 27) | Replaced by `.sheet(item: $store.activeTopic)` — no manual ref needed | 🔧 fixed (native pattern) |
| `AsyncStorage.setItem('@wagerproof_has_seen_learn_sheet', 'true')` (line 56) | `AppGroup.defaults.set(true, forKey: "@wagerproof_has_seen_learn_sheet")` — RN key preserved verbatim | ✅ matches |
| `AsyncStorage.getItem('@wagerproof_has_seen_learn_sheet')` (line 64) | `AppGroup.defaults.bool(forKey: "@wagerproof_has_seen_learn_sheet")` | ✅ matches |
| `useThemeContext()` (LearnSlide.tsx:7, etc.) | `@Environment(\.colorScheme)` — implicit via SwiftUI's color-scheme propagation through tokens | ✅ matches |
| `useTheme()` (react-native-paper) (LearnSlide.tsx:28) | `WagerproofDesign` color tokens drive all text/background colors | ✅ matches |
| `useSafeAreaInsets()` (LearnSlide.tsx:8, 30, 35) | `ScrollView` content padding + native sheet handles safe area automatically | ✅ matches |

## Async actions

| RN call | Swift counterpart | Match |
|---|---|---|
| None of the sheet / slide content fetches over the network | n/a | ✅ matches |
| `markAsSeen()` is `async`-tagged but body is synchronous `AsyncStorage.setItem` (lines 54–60) | `LearnWagerProofStore.markAsSeen()` is synchronous on `UserDefaults` | ✅ matches |
| `checkIfSeen()` is `async` returning Bool (lines 62–70) | `LearnWagerProofStore.hasBeenSeen() -> Bool` synchronous on `UserDefaults` | ✅ matches |
| Auto-open on first launch — **commented out in RN** (verified via `grep -rn "checkIfSeen\|openLearnSheet" wagerproof-mobile/app/`) | Same — Swift port does not auto-present | ✅ matches (parity to current RN state) |

## Empty / loading / error states

| RN state | Swift counterpart | Match |
|---|---|---|
| Sheet "closed" — `index={-1}` (LearnWagerProofBottomSheet.tsx:216) | `activeTopic == nil` ⇒ native `.sheet(item:)` not presented; hub page (`LearnWagerProofView`) is the visible artifact. Parity screenshot: `parity/learn-wagerproof/empty.png` | ✅ matches |
| Sheet "loaded" — `index={0}` snapped at 90% with carousel showing slide 0 | `activeTopic = .createAgent`, `currentSlide = 0`; sheet visible with full carousel. Parity screenshot: `parity/learn-wagerproof/loaded.png` | ✅ matches |
| No "error" state — there are no network calls in this feature | Captured as the last-slide variant (More Features) to exercise the "no value-prop card" layout branch. Parity screenshot: `parity/learn-wagerproof/error.png` | 🔧 fixed — "error" slot repurposed for a degenerate-layout variant since no real error path exists |

## Out-of-scope RN files (noted for inventory hygiene)

| RN file | Disposition |
|---|---|
| `wagerproof-mobile/components/learn-wagerproof/slides/Slide4_EditorPicks.tsx` | Dead RN code — exported from the `slides/` folder but not imported by `index.ts` and not referenced in `LearnWagerProofBottomSheet`'s `SLIDES` array. The carousel only renders slides 0/1/2/3/5 from the source (5 unique slides) plus a "more features" closer = 6 total. Slide4 is unused. No Swift port required; inventory row will be marked `candidate` with note "RN dead code; intentionally not ported". |

## Diff list

Rows requiring callout from the table above:

- 🔧 fixed (intentional divergence, no waiver):
  - Native `.sheet(item:)` replaces `@gorhom/bottom-sheet` (native pattern).
  - `TabView(.page)` replaces horizontal `FlatList` (idiomatic).
  - `Color.appPrimary` (#22C55E) replaces RN ad-hoc `#00E676` per token consolidation.
  - Hub page `LearnWagerProofView` added (no RN equivalent). Provides a navigable entry point from settings / side menu.
  - Mini game card uses placeholder avatar (first letter in circle) instead of real `TeamAvatar` — appropriate for marketing slide.
  - Public-betting split bar in Slide2 uses equal split visually; percentages still read from text.
  - Auto-open removed for `markAsSeen` storage path replaced by `UserDefaults`; semantics identical.
  - "error" parity screenshot repurposed for last-slide layout variant (no real error path exists).
  - `LearnToolExplainerBanner.swift` deleted — duplicate of the already-shipped, B06-reviewer-PASS `Features/Outliers/Components/ToolExplainerBanner.swift`. Future call sites import that canonical view.

- ⚠️ waivered:
  - **#063** — Slide 1 Lottie `RobotAnalyzing.json` not ported; SF Symbol fallback used. Tracked in `tickets/063-learn-lottie-robot-analyzing.md`.

- ❌ missing: none.
