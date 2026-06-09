# Ticket #063 — Learn slide 1 Lottie `RobotAnalyzing.json` not ported

**Status:** open
**Filed by:** b21-implementer
**Filed:** 2026-05-21
**Affects screen / file:** `wagerproof-mobile/components/learn-wagerproof/slides/Slide1_Create247Agent.tsx` → `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide1_Create247Agent.swift`

## What we couldn't ship in scope

The RN walkthrough slide 1 (Create a 24/7 Agent) renders `assets/RobotAnalyzing.json` via `lottie-react-native`. The Swift port substitutes a large `brain.head.profile` SF Symbol with a gentle scale-pulse animation. The visual presence is preserved but the Lottie scene's character + frame-by-frame motion is not.

## Why

No Lottie SwiftUI integration in the iOS port yet — adding `lottie-ios` as an SPM dependency is owned by a future cross-cutting batch (same situation as ticket #B19-1 Roast ChattingRobot). The B21 brief explicitly bans new SDK adoptions in scope.

## Impact

Slide 1's hero panel uses a static-with-pulse SF Symbol robot instead of the animated Lottie character. Functional content (the three bullet rows below) is unaffected.

## Acceptance criteria

- `lottie-ios` (or equivalent) is added to `WagerproofKit/Package.swift`.
- A reusable `LottieView` SwiftUI wrapper exists under `WagerproofKit/Sources/WagerproofDesign/` (or similar) loading from bundled JSON.
- `Slide1_Create247Agent.swift` renders `RobotAnalyzing.json` through the wrapper; the SF Symbol fallback is removed.
- The `FIDELITY-WAIVER #063` comment + this ticket reference are removed.

## Linked code

- `// FIDELITY-WAIVER #063` in `wagerproof_ios_native/Wagerproof/Features/LearnMore/Components/Slide1_Create247Agent.swift` at the hero-card ZStack.

## Notes

This is one of several Lottie-equivalent gaps:
- #B19-1 (Roast `ChattingRobot.json`)
- #029-onboarding-step1-face-recognition-lottie
- Ticket #050 (thinking sprite picker) is adjacent but lottie-specific.

A single "Lottie integration" batch can close all of them.
