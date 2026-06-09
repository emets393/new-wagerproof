# Ticket #071 — Animated agent glow effects replaced with static gradients

**Status:** open
**Filed by:** B13 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/components/agents/GlowAccentBar.tsx`, `wagerproof-mobile/components/agents/GlowingCardWrapper.tsx` → `wagerproof_ios_native/Wagerproof/Features/Agents/Components/GlowAccentBar.swift` + `GlowingCardWrapper.swift`

## What we couldn't ship in scope

The RN agent surfaces use `react-native-animated-glow` to render a continuously cycling 5-color halo around top-3 leaderboard avatars and a glowing accent bar above each AgentIdCard. The Swift ports render the same brand-tinted gradient + blur ring statically — no color-cycle animation.

## Why

The animated glow uses a per-frame shader with HSL color rotation. A native SwiftUI equivalent would require a `TimelineView(.animation)` driving a `Canvas` with a custom shader or `Metal` view — a real implementation, but a big enough rendering effort that it didn't fit in B13's scope. The static gradient still communicates "this is a premium / top-ranked surface" without the perpetual motion.

## Impact

Visually the cards look identical at first glance; only side-by-side parity screenshots reveal the missing animation. No interactive state is affected.

## Acceptance criteria

- A `TimelineView`-driven SwiftUI implementation that cycles the gradient stops at ~1 Hz.
- Performance budget: must not drop GameSwitch FPS below 60 on iPhone 15 (the cards stack 4-8 per screen).
- Toggle to disable the animation under `Settings > Accessibility > Reduce Motion`.

## Linked code

- `// FIDELITY-WAIVER #071` in `wagerproof_ios_native/Wagerproof/Features/Agents/Components/GlowAccentBar.swift`
- `// FIDELITY-WAIVER #071` in `wagerproof_ios_native/Wagerproof/Features/Agents/Components/GlowingCardWrapper.swift`

## Notes

If the animation is dropped permanently (we may decide static gradient is on-brand for iOS), close this with `wontfix` and remove the waiver comments.
