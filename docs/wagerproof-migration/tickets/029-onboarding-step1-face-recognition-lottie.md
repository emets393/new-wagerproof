# Ticket #029 — Onboarding Step 1 face-recognition Lottie deferred to SF Symbol stand-in

**Status:** open
**Filed by:** orchestrator (post B02 review)
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/components/onboarding/steps/Step1_PersonalizationIntro.tsx` → `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingPersonalizationIntroView.swift`

## What we couldn't ship in scope

RN's Step 1 renders a face-recognition Lottie animation (`FaceScanAnimation.json` or similar) as the visual hero. The Swift port ships an SF Symbol stand-in (`person.crop.circle.badge.checkmark`) — visual parity but not Lottie-exact.

## Why

`lottie-ios` is not yet in the Swift project's SPM dependencies. The Pixel/Lottie asset bundle import is a cross-batch concern (see ticket #001 — the broader asset import sweep). Step 1 is functional with the SF Symbol; the Lottie can land later without changing the screen's behaviour.

## Impact

Visual fidelity drop on Step 1's hero only. No functional regression.

## Acceptance criteria

- `lottie-ios` added to `WagerproofKit/Package.swift` deps.
- `FaceScanAnimation.json` (or equivalent) imported into the asset bundle.
- `OnboardingPersonalizationIntroView.swift` swaps the SF Symbol for `LottieView(name: "FaceScanAnimation")`.

## Linked code

- `// FIDELITY-WAIVER #029` in `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingPersonalizationIntroView.swift` line ~26.

## Notes

Parallels every other Onboarding step that drops Lottie to an SF Symbol stand-in (per the fidelity table). A single Lottie-import batch could resolve all of these — file as a follow-up if multiple Steps need the same Lottie integration.
