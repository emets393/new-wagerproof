# B21 Review — LearnMore + ToolExplainer + ComingSoon

**Reviewer:** b21-reviewer-2026-05-21 (fresh context, read-only)
**Reviewed:** 2026-05-21
**Verdict:** FAIL
**Build:** ❌ (`** BUILD FAILED **` — 3 failures total in the tree)

---

## Summary

The B21 work itself — `LearnWagerProofStore`, the `LearnWagerProofBottomSheet`, the six slides, `LearnSlide`, `SlideProgressIndicator`, `ComingSoonBanner`, the hub `LearnWagerProofView`, the global `.sheet(item:)` wiring in `MainTabView` — is high-fidelity, well-commented, and consumes the real store. The fidelity table (`fidelity/b21-learnmore.md`) is exhaustive and honest. Parity screenshots exist. The Lottie gap is correctly waivered (`#063`) and the dead-code Slide4 is correctly documented (RN file is never imported by `slides/index.ts` and never referenced in `SLIDES`).

**However, the project does not build.** The `xcodebuild` step exits with `** BUILD FAILED **` (3 failures). Per `REBUILD_PLAN.md` §G3 + the reviewer brief §1, a non-green build is an automatic FAIL — no exceptions, regardless of whether B21 caused the breakage.

Two distinct compile errors block:
1. `ScreenshotHarness.swift:62,64,76` — references `settingsTargetsA`, `settingsTargetsB`, and `ScreenshotHarness.isSettingsClusterTarget` (the last one exists; the first two are referenced but never declared as `@ViewBuilder` properties). These are B08-cluster harness paths — the B08 implementer added the outer-switch cases + `isSettingsClusterTarget` helper but forgot the corresponding two `@ViewBuilder` properties.
2. `GamesStore.swift:55,677,773` — references undefined type `NBAGameSummary` (B11 NBA work has not landed in models yet).

Neither is owned by B21, but the B21 work is bolted onto the same tree and the reviewer brief is unambiguous: **build green or FAIL**.

---

## Issues

### Build (blocking)

1. **`Wagerproof/App/ScreenshotHarness.swift:62`** — references `settingsTargetsA`, which is not declared anywhere in the file or project (`grep -rn 'settingsTargetsA' wagerproof_ios_native/` returns only the one call site at this line). The outer-switch dispatch for `settings*` / `deleteAccount*` / `discord` / `iosWidget` targets points at a non-existent `@ViewBuilder` property. **Owner:** B08 (settings cluster), not B21 — but the broken build is on the swift branch at review time.

2. **`Wagerproof/App/ScreenshotHarness.swift:64`** — same pattern: references `settingsTargetsB` (for `secretSettings / paywall / paywallError / customerCenter`) without the property body. **Owner:** B08.

3. **`Wagerproof/App/ScreenshotHarness.swift:76`** — `if ScreenshotHarness.isSettingsClusterTarget { ... }`. The static var IS defined at line 536, so this line itself is fine — but the compiler error cascade from #1 + #2 surfaces it via "type 'ScreenshotHarness' has no member ...". Will likely auto-resolve once #1+#2 are fixed. **Owner:** B08.

4. **`WagerproofKit/Sources/WagerproofStores/GamesStore.swift:55,677,773`** — `cannot find type 'NBAGameSummary' in scope`. **Owner:** B11 (NBA models). Not B21.

### Fidelity / wiring (non-blocking observations)

5. **Raw animation curves outside `Animations.swift`** — `LearnWagerProofBottomSheet.swift:54, 146, 156` uses `.easeInOut(duration: 0.25)`; `Slide1_Create247Agent.swift:50` uses `.easeInOut(duration: 1.6).repeatForever(...)`; `Slide3_WagerBot.swift:116` uses `.linear(duration: 8)`. The hard-rule explicitly bans `.spring(...)` outside `Animations.swift` (which all three avoid), but the Honeydew language prefers the named tokens `appQuick / appStandard / appBouncy / appSlow / appLinear`. **Recommendation:** introduce a `.appCarouselSlide` token + a `.appPulse` token + the existing `.appLinear` (which is `linear(duration: 0.15)` — not 8s, so a new bespoke timer is fine as a one-off here). Non-blocking.

6. **`Slide4_EditorPicks.tsx` disposition** — the implementer correctly identified that `slides/index.ts` does NOT export Slide4 and `LearnWagerProofBottomSheet.tsx`'s `SLIDES` array does NOT include it (`grep -rn "Slide4_EditorPicks" wagerproof-mobile/` confirms only the file itself contains the symbol). The fidelity table at row line 12 + the diff list at line 160 document this as RN dead code; the inventory row was correctly flipped to `candidate` with the "intentionally not ported" note. **No issue** — this is exactly the right call. Reviewer should now flip the row to `reviewed` (terminal state) with `wontport=true` semantics captured in the note. The inventory schema only has `reviewed` / `candidate` / `waivered` / `missing`, so `reviewed` is the right terminal state.

7. **Hub view divergence** — `LearnWagerProofView.swift` adds a hub page that does NOT exist in the RN tree. The fidelity table at row line 78 explicitly labels this as `🔧 fixed — addition not subtraction`. Per the diff-list discipline this needs a tracking note. **Recommendation:** add an inline `// FIDELITY-ADDITION` comment at the top of `LearnWagerProofView.swift` body to explicitly flag the divergence (the file's docstring already explains the intent, so this is a polish suggestion, not a blocker).

8. **B08 cross-batch impact warning** — the orchestrator should re-run B08 before B21 can re-PASS. Two harness `@ViewBuilder` properties are missing; the fix is mechanical (declare `settingsTargetsA` and `settingsTargetsB` returning the per-target `EmptyView()`-default switch over the relevant `Target` cases). This is purely a B08 omission.

### Passing checks (no issue)

- Fidelity table at `fidelity/b21-learnmore.md` — complete row-by-row enumeration with Visual / Tokens / Gestures / Navigation / Analytics / State / Async / Empty-Loading-Error sections. Five spot-checks all verified against the Swift code.
- No `❌ missing` rows in the fidelity table.
- No `@State`-fake arrays in production paths (`grep -rEn '@State.*=\s*\[' wagerproof_ios_native/Wagerproof/Features/LearnMore/` returns nothing; the slide marketing copy lives in `private let` literals which are the slide content, not fake data).
- DEBUG fixtures (`ScreenshotHarness`-fed `makeLearn` helper) correctly `#if DEBUG`-gated.
- Real-store wiring — `LearnWagerProofView` uses `@Environment(LearnWagerProofStore.self)`; the bottom sheet receives `@Bindable var store: LearnWagerProofStore`; `MainTabView` and `SideMenuSheet` both read the same environment store.
- Native primitives per 08-spec — `.sheet(item:)` + `.presentationDetents([.large])` + `.presentationDragIndicator(.visible)` + `TabView(.page(indexDisplayMode: .never))` all correctly used.
- SF Symbol parity — all 10 MaterialCommunityIcons / icon names map to canonical SF Symbols per the 08-spec A.6 table (`robot → brain.head.profile`, `cards → rectangle.stack.fill`, `chart-box → chart.bar.fill`, `trending-up → chart.line.uptrend.xyaxis`, `apps → square.grid.2x2.fill`, `baseball → baseball.fill`, `close → xmark`, `lightbulb-on → lightbulb.fill`, `lightning-bolt → bolt.fill`, `lock → lock.fill`).
- Parity screenshots present at `docs/wagerproof-migration/parity/learn-wagerproof/{empty,loaded,error}.png`.
- Ticket #063 follows `_template.md` exactly and cites the real Swift file at `Features/LearnMore/Components/Slide1_Create247Agent.swift` line ~41.
- Waivers script `scripts/wagerproof-migration/grep-waivers.sh` exits 0 (49 tracked waivers, all mapped to tickets).
- Inventory — 13 candidate rows in `inventory.overrides.csv` covering all 13 RN files in scope (1 context + 1 sheet + 1 slide-helper + 1 progress + 1 barrel-export + 7 slides + 1 ComingSoonBanner = 13). `ToolExplainerBanner.tsx` correctly recognized as already `reviewed` by B06.

---

## Required actions for implementer (B21 + B08 coordination)

Before B21 can re-enter review:

1. **B08 implementer** — add the missing `settingsTargetsA` and `settingsTargetsB` `@ViewBuilder` properties in `ScreenshotHarness.swift` (parallel to `learnTargets`, `gamesTargets`, etc.).
2. **B11 implementer (or whoever owns NBA models)** — add `NBAGameSummary` (and `NCAABGameSummary`, `MLBGameSummary` — verify those compile too) to `WagerproofKit/Sources/WagerproofModels/`. `GamesStore.swift:55,677,773` will not compile without these.
3. **Re-run** `xcodebuild ... -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build` and confirm `** BUILD SUCCEEDED **`.
4. (Optional, B21 polish) — Replace raw `.easeInOut(duration:)` / `.linear(duration:)` calls with named tokens from `Animations.swift`. Add a `.appCarouselSlide` token if needed.

Once the build is green, B21's substantive work passes muster — the implementer should re-run the build check and resubmit. The reviewer notes 1–8 in §Issues do not require code changes to LearnMore; they require coordination with B08 and B11.

---

## Recommendation

**Hold the batch.** Do NOT flip any rows from `candidate` → `reviewed` until the build is green.

When the build passes (i.e. after B08 + B11 land their fixes), the rows below should be appended to `inventory.overrides.csv` flipping each from `candidate` → `reviewed`. The exact rows to append:

```csv
rn_path,name,type,status,note,reviewer,reviewed_date
wagerproof-mobile/contexts/LearnWagerProofContext.tsx,LearnWagerProofContext,store,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/LearnWagerProofBottomSheet.tsx,LearnWagerProofBottomSheet,sheet,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/LearnSlide.tsx,LearnSlide,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/SlideProgressIndicator.tsx,SlideProgressIndicator,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/index.ts,index,component,reviewed,B21 reviewer PASS — barrel-export collapsed,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide1_Create247Agent.tsx,Slide1_Create247Agent,component,reviewed,B21 reviewer PASS — waiver #063 (Lottie) accepted,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide1_GameCards.tsx,Slide1_GameCards,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide2_GameDetails.tsx,Slide2_GameDetails,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide3_WagerBot.tsx,Slide3_WagerBot,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide4_EditorPicks.tsx,Slide4_EditorPicks,component,reviewed,B21 reviewer PASS — RN dead code (not exported from index.ts, not in SLIDES) intentionally not ported,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide5_Outliers.tsx,Slide5_Outliers,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/learn-wagerproof/slides/Slide6_MoreFeatures.tsx,Slide6_MoreFeatures,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/ComingSoonBanner.tsx,ComingSoonBanner,component,reviewed,B21 reviewer PASS,b21-reviewer-2026-05-21,2026-05-21
```

13 inventory rows to flip on re-review. **Held this pass.**
