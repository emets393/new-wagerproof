# B01 Auth — Reviewer Verdict (Re-Review #2)

**Verdict:** FAIL
**Build:** ❌ (`** BUILD FAILED **` on iPhone 16 Pro, Debug — see Issue #1; root cause is outside B01 scope)
**Date:** 2026-05-20
**Reviewer:** b01-reviewer-2026-05-20 (independent re-review, read-only on code)

---

## Summary

Every B01 fix-up item from the first review's blocking list (Issues 1-3) has landed correctly. The content surface is clean:

- **Fix 1 — raw `.spring(...)` eliminated.** `grep -rnE "\.spring\(" Wagerproof/Features/Auth/` returns **zero hits**. A new `.appCarousel` token (`response: 0.5, dampingFraction: 0.85`) was added to `WagerproofKit/Sources/WagerproofDesign/Animations.swift:10` with a doc comment explaining its purpose. `LoginView.swift:86` now uses `.animation(.appCarousel, value: currentIndex)` and `LoginView.swift:308` now uses `withAnimation(.appQuick) { … }`.
- **Fix 2 — all 6 tap-targets are ≥44×44pt.** Every site was patched with the same two-line pattern: `.contentShape(Rectangle())` immediately followed by `.frame(minWidth: 44, minHeight: 44)`. Each has the comment `// Visual stays 40pt; tap area expands to 44pt (matches RN hitSlop).` (or `32pt` for eye toggles). Verified at:
  - `EmailLoginView.swift:84-85` (back) and `:174-175` (eye)
  - `SignupView.swift:79-80` (back), `:165-166` (password eye), `:203-204` (confirm eye)
  - `ForgotPasswordView.swift:232-233` (back)
- **Fix 3 — carousel rewritten as `TabView`.** `LoginView.swift:78-88` is now `TabView(selection: $currentIndex) { ForEach … .tag(index) } .tabViewStyle(.page(indexDisplayMode: .never)) .indexViewStyle(.page(backgroundDisplayMode: .never)) .animation(.appCarousel, value: currentIndex) .frame(maxWidth: .infinity, maxHeight: .infinity) .allowsHitTesting(false)`. Comment block explains why swipe is suppressed (auto-driven; tap zones in Layer 4 + segmented progress bar in Layer 3 are the only valid input surfaces). This is the spec-prescribed path — no `🔧 justified` row needed.
- **Bonus — Optional Issue #4 fixed.** `// FIDELITY-WAIVER #004` markers are now present in all three RN-equivalent screens (`EmailLoginView.swift:93`, `SignupView.swift:88`, `ForgotPasswordView.swift:241`) so the waiver scanner reflects all affected sites.
- **Pre-existing waivers intact.** `FIDELITY-WAIVER #001` (`OnboardingSlide.swift:98`, with header at `:9` and placeholder at `:445`), `#002` (`SocialSignInButton.swift:74`), `#003` (`LoginView.swift:405`), `#004` (all three screens) — all six markers present, all map to existing tickets in `docs/wagerproof-migration/tickets/001..004-*.md`.
- **No new regressions** in the Auth feature dir. Native primitives (`SignInWithAppleButton`, `GoogleSignInCoordinator`, `NavigationStack`, `NavigationLink`, `.sensoryFeedback`, `AuthFieldRow`) all unchanged. SF Symbol parity preserved.
- **Parity screenshots** still in place for all 4 screens.
- **Inventory overrides** still register the 6 B01 RN files at status `candidate` (unchanged from the first review).

What blocks PASS: the workspace no longer builds. The single compile failure is in `Wagerproof/App/ScreenshotHarness.swift:73-91` (references `PicksFixtures.samplePicks`, `PicksFixtures.gameDataMap`, `PicksFixtures.nbaPick`, `PicksFixtures.nbaGameData`). The source file `Wagerproof/Features/Picks/PicksFixtures.swift` exists on disk but is **not registered in `Wagerproof.xcodeproj/project.pbxproj`** (zero references; compare to `ScoreboardFixtures.swift` and `FeatureRequestsFixtures.swift`, both of which have proper `PBXBuildFile` + `PBXFileReference` + `Sources` entries). This is unambiguously Picks (B-Picks / future batch) territory — no B01 file touches `PicksFixtures` or `ScreenshotHarness`. Per the brief's hard gate ("Build green: `** BUILD SUCCEEDED **` required"), I cannot flip B01 to `reviewed` while the workspace is red.

This mirrors the B07 re-review #2 situation exactly: content-clean, build-broken by another batch's stray scaffolding. The orchestrator should hold the B01 flip until the Picks pbxproj fix lands, then append the 6 rows below without re-running the content audit.

---

## Issues

### 1. Build fails — `PicksFixtures` not registered in Xcode project sources (OUT OF B01 SCOPE)

- **File:** `wagerproof_ios_native/Wagerproof/App/ScreenshotHarness.swift:73,74,85,86,91`
- **Errors:** 5× `error: cannot find 'PicksFixtures' in scope`
- **Root cause:** `Wagerproof/Features/Picks/PicksFixtures.swift` exists on disk and defines the type, but `Wagerproof.xcodeproj/project.pbxproj` has zero references to it (no `PBXBuildFile`, no `PBXFileReference`, no `Sources` build phase entry). The peer fixtures files for the same feature region are correctly registered:
  ```
  ScoreboardFixtures.swift:    pbxproj refs at lines 20, 71, 386, 620
  FeatureRequestsFixtures.swift: pbxproj refs at lines 38, 80, 222, 602
  PicksFixtures.swift:          0 refs ❌
  ```
- **Why this blocks B01:** It doesn't, semantically — no B01 file references `PicksFixtures` or `ScreenshotHarness`. But the brief's "Build green" gate is unconditional, and the workspace is red. The original first-review report explicitly said "Build: ✅ `** BUILD SUCCEEDED **`", so this regression landed between that review and the fix-up.
- **Recommended action:** Have the Picks owner add the four pbxproj entries for `PicksFixtures.swift` (PBXBuildFile + PBXFileReference + group child + Sources build phase membership) using `ScoreboardFixtures.swift` as a template. Once that lands, re-run the B01 build check; if it succeeds and no B01 file has been touched, B01 is eligible to flip on the next pass without re-running the content audit.
- **Workaround for the orchestrator:** Defer the inventory flip until after the Picks pbxproj fix. The B01 fidelity surface is otherwise green.

### 2. Stale fidelity row 48 — not blocking, suggest touch-up

`fidelity/b01-auth.md:48` still documents the carousel transition as:

> `.transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))` driven by `.animation(.spring(response: 0.5, dampingFraction: 0.85))` | ✅

After the Fix-3 rewrite, that `ZStack { … .transition(.asymmetric(…)) }` no longer exists — the carousel is now `TabView.tabViewStyle(.page)` driven by `.animation(.appCarousel, value: currentIndex)`. The visual outcome is equivalent, but the table row should be updated to reflect the actual code, e.g.:

```
| AnimatedSlideContent spring(tension 100, friction 12) | `TabView(selection: $currentIndex).tabViewStyle(.page(indexDisplayMode: .never))` driven by `.animation(.appCarousel, value: currentIndex)` (token = `.spring(response: 0.5, dampingFraction: 0.85)`) | ✅ |
```

Not a blocker — the code is correct and the verdict marker would still be ✅ — but it's a doc-staleness issue worth a 30-second cleanup in the same commit that fixes the build.

### 3. Waiver script reports an unrelated unticketed waiver (NOT a B01 concern)

`scripts/wagerproof-migration/grep-waivers.sh` exits with **code 2** and reports:

```
Tracked waivers: 12
❌ 1 waiver(s) without a matching ticket:
  /Users/chrishabib/Documents/new-wagerproof/wagerproof_ios_native/Wagerproof/Features/Picks/PicksView.swift:27:    /// FIDELITY-WAIVER #012: admin / pro flags ship as plain @State seeded
```

This is `#012` in `PicksView.swift` (same Picks batch that owns the build break) — no ticket file `tickets/012-*.md` exists. **Not a B01 issue** (B01's waivers #001-#004 all have matching ticket files and the script correctly recognizes them), but it does mean the brief's "Waivers script exit 0" gate is failing right now. Same Picks-batch owner should either file `tickets/012-pro-admin-flag-wiring.md` or remove the waiver until B08 wires the actual stores.

---

## Issues — all expected first-review items confirmed fixed

| First-review issue | Fix verified at | Status |
|---|---|---|
| 1. Raw `.spring(...)` in LoginView | `LoginView.swift:86` → `.appCarousel`; `:308` → `.appQuick`; new `.appCarousel` token in `Animations.swift:10` | ✅ FIXED |
| 2a. Back button hit area (EmailLoginView) | `EmailLoginView.swift:84-85` `.contentShape + .frame(minWidth:44)` | ✅ FIXED |
| 2b. Eye toggle hit area (EmailLoginView) | `EmailLoginView.swift:174-175` | ✅ FIXED |
| 2c. Back button hit area (SignupView) | `SignupView.swift:79-80` | ✅ FIXED |
| 2d. Password eye hit area (SignupView) | `SignupView.swift:165-166` | ✅ FIXED |
| 2e. Confirm eye hit area (SignupView) | `SignupView.swift:203-204` | ✅ FIXED |
| 2f. Back button hit area (ForgotPasswordView) | `ForgotPasswordView.swift:232-233` | ✅ FIXED |
| 3. Carousel divergence | `LoginView.swift:78-88` rewritten as `TabView.tabViewStyle(.page(indexDisplayMode: .never))` per spec | ✅ FIXED |
| 4. Logo waiver coverage (optional) | `// FIDELITY-WAIVER #004` now present in all 3 affected screens (EmailLoginView:93, SignupView:88, ForgotPasswordView:241) | ✅ FIXED |

---

## Recommendation

**Hold the inventory flip** until the Picks pbxproj regression in `ScreenshotHarness.swift` is resolved (Issue #1). Once the workspace builds clean again, the six B01 rows below should be **appended** (not amended) to `inventory.overrides.csv`. The inventory builder uses the LAST row per `rn_path`, so an append is equivalent to a status flip and preserves the audit trail. Format mirrors the B03 reviewer rows already in the file (lines 21-26).

```csv
wagerproof-mobile/app/(auth)/_layout.tsx,(auth)/_layout,layout,reviewed,B01 re-review PASS — ported to Features/Auth/AuthRouter.swift,b01-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/app/(auth)/login.tsx,login,screen,reviewed,B01 re-review PASS — TabView carousel + .appCarousel + 44pt tap targets; waivers #001 #002 #003,b01-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/app/(auth)/email-login.tsx,email-login,screen,reviewed,B01 re-review PASS — 44pt tap targets on back + eye; waiver #004,b01-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/app/(auth)/signup.tsx,signup,screen,reviewed,B01 re-review PASS — 44pt tap targets on back + 2 eyes; waiver #004,b01-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/app/(auth)/forgot-password.tsx,forgot-password,screen,reviewed,B01 re-review PASS — 44pt back tap target; waiver #004,b01-reviewer-2026-05-20,2026-05-20
wagerproof-mobile/contexts/AuthContext.tsx,AuthContext,store (context),reviewed,B01 re-review PASS — AuthStore.swift extended with signInWithApple/signInWithGoogle,b01-reviewer-2026-05-20,2026-05-20
```

These rows are **conditional on the Picks pbxproj fix landing**. Strict reading of the brief: FAIL until build green. Practical reading: B01 content is fully clean — flip the moment the unrelated Picks build break is repaired.

---

## Verification commands run

```bash
# Raw .spring(...) elimination in Auth
grep -rnE "\.spring\(" wagerproof_ios_native/Wagerproof/Features/Auth/
#   → (no matches)  ✅

# Named animation tokens at expected sites
grep -nE "\.appCarousel|\.appQuick|\.appBouncy|\.appStandard|\.appSlow|\.appLinear|\.appShimmer" \
  wagerproof_ios_native/Wagerproof/Features/Auth/LoginView.swift
#   → 86: .animation(.appCarousel, value: currentIndex)  ✅
#   → 308: withAnimation(.appQuick)  ✅

# .appCarousel token defined in design system
grep -nE "appCarousel" wagerproof_ios_native/WagerproofKit/Sources/WagerproofDesign/Animations.swift
#   → 10: static let appCarousel: Animation = .spring(response: 0.5, dampingFraction: 0.85)  ✅

# TabView carousel rewrite
grep -nE "TabView|tabViewStyle" wagerproof_ios_native/Wagerproof/Features/Auth/LoginView.swift
#   → 78: TabView(selection: $currentIndex) {  ✅
#   → 84: .tabViewStyle(.page(indexDisplayMode: .never))  ✅

# 44pt tap-target floor — all 6 sites
grep -nE "frame\(minWidth: 44, minHeight: 44\)" \
  wagerproof_ios_native/Wagerproof/Features/Auth/EmailLoginView.swift \
  wagerproof_ios_native/Wagerproof/Features/Auth/SignupView.swift \
  wagerproof_ios_native/Wagerproof/Features/Auth/ForgotPasswordView.swift
#   → EmailLoginView.swift:85  (back)            ✅
#   → EmailLoginView.swift:175  (eye)            ✅
#   → SignupView.swift:80       (back)           ✅
#   → SignupView.swift:166      (password eye)   ✅
#   → SignupView.swift:204      (confirm eye)    ✅
#   → ForgotPasswordView.swift:233  (back)       ✅

# Waiver markers intact
grep -rnE "FIDELITY-WAIVER" wagerproof_ios_native/Wagerproof/Features/Auth/
#   → 6 markers across 5 files; #001 (OnboardingSlide.swift:98), #002 (SocialSignInButton.swift:74),
#     #003 (LoginView.swift:405), #004 ×3 (EmailLoginView:93 / SignupView:88 / ForgotPasswordView:241)  ✅

# Build
cd wagerproof_ios_native && xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build
#   → ** BUILD FAILED **  (5 × "cannot find 'PicksFixtures' in scope" in App/ScreenshotHarness.swift —
#      Picks territory, NOT B01)  ❌

# Waivers script
bash scripts/wagerproof-migration/grep-waivers.sh
#   → "Tracked waivers: 12 / ❌ 1 waiver(s) without a matching ticket:
#       Wagerproof/Features/Picks/PicksView.swift:27: FIDELITY-WAIVER #012 …"
#     Exit 2.  ❌  (Picks territory, NOT B01 — all 4 B01 waivers map to tickets cleanly)
```
