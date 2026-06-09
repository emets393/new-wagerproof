# Ticket #018 — FeatureSpotlight scan tutorial collapsed to static spotlight

**Status:** open
**Filed by:** b02-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/components/onboarding/steps/Step6_FeatureSpotlight.tsx` → `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingFeatureSpotlightView.swift`

## What we couldn't ship in scope

RN's `Step6_FeatureSpotlight` is a 4-phase interactive tutorial:

1. `intro-scan` — pulse on the "Scan this page" Dynamic-Island pill
2. `scanning` — wave animation sweeps across two dummy NFLGameCards
3. `highlight-card` — first card glows, user tapped instruction
4. `sheet-demo` — `DemoGameBottomSheet` opens with pro-data preview

The Swift port renders only a static spotlight card with the message
"Tap any matchup for pro-grade data" + an SF Symbol pulse.

## Why

The tutorial depends on:

- `NFLGameCard` — full port owned by B14 (`Features/NFL/Components/NFLGameCard.swift` is a stub).
- `DemoGameBottomSheet` — RN component with bespoke layout that overlaps
  `NFLGameBottomSheet`.
- `DemoScanWaveAnimation` — bespoke reanimated wave that depends on Lottie /
  reanimated which the Swift port doesn't carry.
- `GlowingCardWrapper` — agent-themed glow halo (Phase 4 / B14).

Building all four inside B02 would duplicate work owned by other batches.

## Impact

New users miss the demo of the Dynamic-Island scan + the demo bottom-sheet
preview. The functional message ("we surface pro-grade data per game") is
preserved.

## Acceptance criteria

- B14 lands `NFLGameCard` + `NFLGameBottomSheet`.
- Reimplement `OnboardingFeatureSpotlightView` to drive the four phases using
  ported components.
- Capture parity screenshot showing the highlight-card phase active.

## Linked code

- `// FIDELITY-WAIVER #018` in `Wagerproof/Features/Onboarding/Components/OnboardingFeatureSpotlightView.swift`
