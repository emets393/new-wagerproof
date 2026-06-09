# B01 Auth — Reviewer Verdict

Reviewer: independent (fresh context)
Date: 2026-05-20
Batch: B01 — Auth foundation

---

## Verdict: FAIL

**Build:** ✅ `** BUILD SUCCEEDED **` (xcodebuild iPhone 16 Pro, Debug)

---

## Summary

The implementer delivered a strong, mostly-faithful port: build is green, every prescribed Swift target exists with substantial content (Auth feature dir totals ~2.0k lines), all 4 RN screens have empty/loaded/error parity PNGs, every `// FIDELITY-WAIVER #NNN` maps to an open ticket (#001–#004), and the inventory overrides correctly flip every B01 RN file from `missing` → `candidate`. Screens are wired to the real `AuthStore` via `@Environment(AuthStore.self)`; no `@State` fakes; no mock data; `SignInWithAppleButton` and `GoogleSignInCoordinator` are used per the 08-spec; all SF Symbol swaps match section §A.6.

That said, three contract violations require fixes before this batch can advance to `reviewed`. The first two are hard rules from the reviewer brief; the third is a contract item the implementer is on the hook to either correct or justify.

---

## Issues

### 1. Raw `.spring(...)` calls outside `WagerproofDesign/Animations.swift` (HARD FAIL — check 8)

The reviewer brief states verbatim: *"Animations should use `.appQuick / .appStandard / .appBouncy / .appSlow / .appLinear` — raw `.spring(...)` outside `WagerproofDesign/Animations.swift` is a FAIL."*

Two raw `.spring(...)` invocations remain in `LoginView.swift`:

- `wagerproof_ios_native/Wagerproof/Features/Auth/LoginView.swift:86`
  ```swift
  .animation(.spring(response: 0.5, dampingFraction: 0.85), value: currentIndex)
  ```
  Should be `.animation(.appBouncy, value: currentIndex)` — `.appBouncy` is defined as `.spring(response: 0.5, dampingFraction: 0.65)` so the dampingFraction is slightly different, but the *fix* is to use the named token; if the bounciness is the desired feel, the design system token to add is `.appCarousel` (or use `.appStandard` which is `response: 0.4, damping: 0.8`).

- `wagerproof_ios_native/Wagerproof/Features/Auth/LoginView.swift:308`
  ```swift
  withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { snackbarVisible = true }
  ```
  Should be `withAnimation(.appQuick)` (defined as `.spring(response: 0.25, dampingFraction: 0.85)` — close enough) or `.appStandard`.

Fidelity table makes no note of these.

### 2. Tap-targets below 44×44pt with no hit-area expansion (HARD FAIL — check 12)

The reviewer brief check 12 requires *"every interactive element is ≥ 44×44pt"*. The RN source uses `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` on the 40pt back button (`email-login.tsx:110`, `signup.tsx:170`, `forgot-password.tsx:150`) and `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` on the eye toggles (`email-login.tsx:185`, `signup.tsx:239,273`). The Swift port renders the same buttons at the requested 40pt / 32pt frame but **does not** add a corresponding `.contentShape(Rectangle())` + outer `.padding(...)` to extend the hit area.

Affected sites:
- `EmailLoginView.swift:79` — back button `Button { dismiss() } label: { … .frame(width: 40, height: 40) }`
- `EmailLoginView.swift:167` — eye toggle `.frame(width: 32, height: 32)` (effective hit = 32pt)
- `SignupView.swift:74` — back button (40pt)
- `SignupView.swift:157`, `SignupView.swift:191` — password + confirm eye toggles (32pt)
- `ForgotPasswordView.swift:227` — back button (40pt)

The 08-spec deliberately calls for *40pt* visual sizing; the gap is the missing hit-area extension that RN compensates for via `hitSlop`. Fix is one line per site, e.g.:

```swift
.frame(width: 40, height: 40)
.contentShape(Rectangle())   // 44×44 visual still 40, but tap area expands
.padding(2)                  // → 44×44 effective
```

or wrap the back button in a 44pt outer frame:

```swift
.frame(width: 44, height: 44)   // outer touchable
```

while keeping the inner Circle at 40pt visually.

### 3. Native-primitive divergence not justified — `TabView(selection:).tabViewStyle(.page)` (check 6)

08-spec §1 (LoginView) line 229 prescribes:

> `TabView(selection:).tabViewStyle(.page(indexDisplayMode: .never))` — the 6-page auto-rotating carousel.

`LoginView.swift:75–87` instead uses a manual `ZStack { ForEach … if index == currentIndex { OnboardingSlide … .transition(.asymmetric(…)) } }` driven by `.animation(.spring(…), value: currentIndex)`. The fidelity table line 48 documents the transition as `✅` but does not flag the absence of `TabView` or note this as `🔧 fixed (justified)`.

Either:
- switch to `TabView(selection: $currentIndex) { ForEach … }.tabViewStyle(.page(indexDisplayMode: .never))` per spec, or
- add a `🔧 justified` row to the fidelity table explaining why the ZStack approach is preferable (e.g. the auto-driven carousel needs swipe disabled, and disabling page-view swipe in SwiftUI is awkward — but in that case, the deviation needs an explicit row, not silent omission).

The reviewer brief check 6 explicitly allows "justified divergence" — the failure is the absence of the justification.

---

## Issues — not blocking, worth flagging

### 4. Logo waiver (#004) is sticky — 4 screens, same fix

`FIDELITY-WAIVER #004` is referenced in `EmailLoginView.swift:90`, but `SignupView.swift:82–96` and `ForgotPasswordView.swift:235–249` render the same SF-symbol-plus-wordmark stand-in without their own `// FIDELITY-WAIVER #004` comment. The waiver-tracking script counts only one in-code reference; per `tickets/004-wagerproof-logo-asset.md` (which I confirmed exists), the gap is acknowledged. Suggest adding `// FIDELITY-WAIVER #004` comments to the two missing call sites so the waiver scanner accurately reflects the surface area.

### 5. Parity screenshots — empty == loaded == error for 3 of 4 screens

The implementer documents this honestly in `fidelity/b01-auth.md` lines 300–307: the screenshot harness can't drive keystrokes, so empty / loaded / error for `email-login`, `signup`, and `forgot-password` are identical files. The reviewer brief explicitly accepts this: *"Some may be debug-fixture renders — that's acceptable for unauthenticated screens."* Calling this out so the orchestrator knows a follow-up batch with full UI automation should re-capture them; it does not block PASS.

### 6. Apple cancellation suppression — RN behaviour partially preserved

RN suppresses cancelled Google sign-in via `error.code === 'SIGN_IN_CANCELLED'`. The Swift port preserves Apple cancellation via `ASAuthorizationError.code == .canceled` (LoginView.swift:360, SignupView.swift:401) but Google cancellation suppression is done with `message.localizedCaseInsensitiveContains("cancel")` (AuthStore.swift:162). This is a brittle string-match — GoogleSignIn's `error.code == .canceled` (`GIDSignInError.Code.canceled`) would be more reliable. Not a fidelity bug per se but worth a Phase-2 cleanup.

---

## Required actions for implementer (to flip FAIL → PASS)

1. Replace the two raw `.spring(...)` calls in `LoginView.swift` (line 86 and line 308) with named tokens (`.appBouncy`, `.appQuick`, `.appStandard`) defined in `WagerproofDesign/Animations.swift`. If the existing tokens don't fit the desired feel, add a new token to `Animations.swift` (e.g. `.appCarousel`) and use that.

2. Extend the hit areas of the 40pt back buttons and 32pt eye-toggle buttons to ≥44×44pt. Apply one of:
   - Wrap the label in an outer 44pt `Button` frame, keep the visible Circle/glyph at 40pt or 32pt.
   - Add `.contentShape(Rectangle()).padding(N)` to expand the tappable region.
   
   Affected sites listed in Issue 2.

3. Resolve the LoginView carousel divergence — either rewrite as `TabView(selection: $currentIndex) { … }.tabViewStyle(.page(indexDisplayMode: .never))` per spec, OR add an explicit `🔧 justified` row to `fidelity/b01-auth.md`'s `LoginView → Visual structure` table explaining why `ZStack` is preferable for an auto-driven non-swipeable carousel.

4. (Optional but recommended) Add `// FIDELITY-WAIVER #004` comments to `SignupView.swift:82` and `ForgotPasswordView.swift:235` so the waiver-scanning script reflects all four affected files.

Once these land, re-run `xcodebuild`, re-run `scripts/wagerproof-migration/grep-waivers.sh`, and re-submit. The other 95% of the batch is solid — the foundational architecture (AuthRouter / AuthStore / GoogleSignInCoordinator / SignInWithApple integration / SF Symbol parity / inventory flips / parity screenshots / waiver tickets) is in good shape.

---

## Recommendation (if a future re-review passes)

If the implementer re-spins and addresses issues 1–3, the following rows of `inventory.overrides.csv` should be flipped from `candidate` → `reviewed`:

- `wagerproof-mobile/app/(auth)/_layout.tsx,(auth)/_layout,layout,reviewed,B01 ported to Features/Auth/AuthRouter.swift,b01-reviewer,2026-05-20`
- `wagerproof-mobile/app/(auth)/login.tsx,login,screen,reviewed,B01 ported; waivers #001 #002 #003,b01-reviewer,2026-05-20`
- `wagerproof-mobile/app/(auth)/email-login.tsx,email-login,screen,reviewed,B01 ported; waiver #004,b01-reviewer,2026-05-20`
- `wagerproof-mobile/app/(auth)/signup.tsx,signup,screen,reviewed,B01 ported; waiver #004,b01-reviewer,2026-05-20`
- `wagerproof-mobile/app/(auth)/forgot-password.tsx,forgot-password,screen,reviewed,B01 ported; waiver #004,b01-reviewer,2026-05-20`
- `wagerproof-mobile/contexts/AuthContext.tsx,AuthContext,store (context),reviewed,B01 extended AuthStore.swift with signInWithApple/signInWithGoogle,b01-reviewer,2026-05-20`

I do not have Edit access; the orchestrator should apply these only after issues 1–3 are resolved.
