# Ticket #080 — Agent creation generation intro uses SF Symbol pulse instead of Lottie

**Status:** open
**Filed by:** B14 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects file:** `wagerproof_ios_native/Wagerproof/Features/Agents/Creation/AgentCreationGenerationIntroView.swift`

## What we couldn't ship in scope

The RN `AgentCreationGenerationIntro.tsx` plays two large Lottie scenes (`GalaxyPlanet.json` then `OrbitPlanet.json`) at full screen, each ~120k of vector animation. The Swift port replaces both with SF Symbols (`globe.americas`, `circle.hexagongrid.fill`) animated via `.symbolEffect(.pulse, options: .repeating)` and a scaling stage transition.

## Why

- We don't have a Lottie runtime in `WagerproofKit` yet (this is the first surface that would require it).
- Adding Lottie is non-trivial — `lottie-ios` adds 1.5MB to the binary and pulls in a Swift Package dep that all other features now ship without.
- SwiftUI 17's `.symbolEffect` animation API is mature and gives us free dark-mode awareness + accessibility scaling.
- The status-line cycling (Hacking Vegas / Calibrating / etc.) and two-stage timing match RN exactly — only the central illustration is swapped.

## Impact

The intro is shorter visually — there's no swirling planet, just a pulsing icon. Total duration (~6s) and the copy-line cadence (~900ms) match RN.

## Acceptance criteria

Close this ticket if Lottie support lands across the app (separate batch — would also unblock the celebration confetti in #081 and the loading wave in agents/onboarding).

## Linked code

- `// FIDELITY-WAIVER #080` at the top of `AgentCreationGenerationIntroView.swift`.
- See related #081 (celebration confetti).
