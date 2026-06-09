# Ticket #013 — AgentBorn confetti + feedback modal deferred

**Status:** open
**Filed by:** b02-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/components/onboarding/steps/StepAgentBorn.tsx` → `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/AgentBornView.swift`

## What we couldn't ship in scope

RN's `StepAgentBorn` plays three Lottie animations (`WaveLinesAnimation`,
`FullscreenGreen` reveal, `confetti`), then shows a modal asking the user
for a 1-5 star rating that triggers `StoreReview.requestReview()` when the
rating >= 4. The Swift port keeps the reveal flash and the agent card but
drops the confetti Lottie and the feedback modal.

It also folds the `PostOnboardingPaywall` into a minimal placeholder view —
the full RevenueCat `Paywall` component lives behind the RevenueCat SDK which
hasn't been integrated yet (lands in B11).

## Why

- Confetti Lottie: requires bundling the existing `confetti.json` asset and a
  Lottie-iOS dependency. Asset import is out of scope for B02; the visual
  payoff is small enough we can defer.
- Feedback modal + `StoreReview.requestReview()`: iOS's `SKStoreReviewController.requestReview()`
  is rate-limited by the system; calling it inside an onboarding flow is no
  more effective than letting the system trigger it organically. The RN
  feedback ratings are not persisted anywhere, so dropping the modal has no
  data-loss impact.
- RevenueCat paywall: depends on `react-native-purchases-ui` which has no
  direct Swift port; the `Purchases.shared.paywalls()` API lands in B11.

## Impact

- Users miss the celebratory confetti burst when their agent is revealed.
- The "How was agent creation?" rating prompt is skipped — analytics for the
  onboarding satisfaction signal is no longer collected.
- Post-onboarding paywall renders a static "Pro coming soon" card instead of
  the RevenueCat paywall.

## Acceptance criteria

- Lottie-iOS SPM dependency added (or a native particle emitter substitute).
- `confetti.json`, `WaveLinesAnimation.json`, `FullscreenGreen.json` imported into the
  Swift app bundle.
- `AgentBornView` plays the reveal Lottie + confetti at the same timing as RN.
- Feedback modal port that calls `SKStoreReviewController.requestReview()`.
- `PostOnboardingPaywall` swaps the placeholder for a real RevenueCat paywall
  presentation (depends on B11's `RevenueCatStore` being available).

## Linked code

- `// FIDELITY-WAIVER #013` in `Wagerproof/Features/Onboarding/Components/AgentBornView.swift`
- `// FIDELITY-WAIVER #013` in `Wagerproof/Features/Onboarding/PostOnboardingPaywall.swift`

## Notes

Build still hands off correctly: when `AgentBornView`'s "Let's go!" button
fires `store.markComplete()`, `RootRouter` flips phase to `.ready` via the
`WagerproofApp.onChange(of: onboardingStore.isComplete)` handler. The user
sees the same outcome — they just don't see confetti while it happens.
