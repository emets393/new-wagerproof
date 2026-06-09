# Ticket #004 — wagerproofGreenDark.png logo asset missing

**Status:** open
**Filed by:** B01 implementer
**Filed:** 2026-05-20
**Affects screen / file:** All 4 auth screens (`login`, `email-login`, `signup`, `forgot-password`) → corresponding Swift files in `Wagerproof/Features/Auth/`

## What we couldn't ship in scope

All four RN auth screens render a centered `Image source={require('@/assets/wagerproofGreenDark.png')}` brand mark (140×50). The iOS bundle has no asset catalogue yet, so B01 substitutes an `HStack { Image(systemName: "chart.line.uptrend.xyaxis"); Text("WagerProof") }` brand stand-in.

## Why

The Wagerproof brand mark PNG / SVG asset has not yet been imported into the iOS asset catalogue. Setting up the asset catalogue + integrating it into the XcodeGen + SPM resource pipeline is a Phase 0 follow-up task we deferred to keep B01 scope tight.

## Impact

The four auth screens show a teal-tinted chart icon + the wordmark "WagerProof" set in `system rounded heavy` instead of the canonical brand logo PNG. Functionally identical; visually distinct.

## Acceptance criteria

- Import `wagerproof-mobile/assets/wagerproofGreenDark.png` (and the light-mode variant) into `wagerproof_ios_native/Wagerproof/Assets.xcassets/WagerproofLogo.imageset/`.
- Or: import to `WagerproofKit/Sources/WagerproofDesign/Resources/Images.xcassets/` and access via `Bundle.module`.
- Replace the `logo` computed property in each of `LoginView.swift` (not currently using it — the carousel doesn't show the wordmark), `EmailLoginView.swift`, `SignupView.swift`, `ForgotPasswordView.swift` with `Image("WagerproofLogo").resizable().scaledToFit().frame(width: 140, height: 50)`.

## Linked code

- `// FIDELITY-WAIVER #004` in:
  - `Wagerproof/Features/Auth/EmailLoginView.swift` `logo`
  - `Wagerproof/Features/Auth/SignupView.swift` `logo`
  - `Wagerproof/Features/Auth/ForgotPasswordView.swift` `logo`

## Notes

The four auth screens all reuse the same `logo` block, so once the asset lands it's a 3-line change per file plus the asset catalogue import.
