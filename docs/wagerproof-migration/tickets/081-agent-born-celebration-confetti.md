# Ticket #081 — Agent Born celebration uses SF Symbol bounce instead of Lottie confetti

**Status:** open
**Filed by:** B14 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects file:** `wagerproof_ios_native/Wagerproof/Features/Agents/Creation/AgentBornCelebrationView.swift`

## What we couldn't ship in scope

The RN `AgentBornCreationCelebration.tsx` plays three Lottie scenes:
1. `WaveLinesAnimation.json` background wash
2. `FullscreenGreen.json` reveal flash
3. `confetti.json` celebration burst on completion

The Swift port keeps the brand-green reveal flash (solid color + opacity animation) and a sparkle SF Symbol with `.symbolEffect(.bounce)`. The wave-lines background and the confetti burst are dropped.

## Why

Same as #080 — no Lottie runtime in `WagerproofKit` yet. Adding one for two pleasant-but-non-functional moments would balloon the binary and pull in a dep that no other surface needs.

## Impact

- The reveal still flashes brand green and fades to reveal the agent card — that's the core moment.
- The "yay you made an agent" sparkle is muted (single icon bounce vs. confetti burst).
- The wave-lines ambient background is missing — the celebration screen is plain black/green instead.

Users still get a clear success-state screen with the autopilot status and a CTA to view the agent.

## Acceptance criteria

Close this ticket if Lottie support lands. The three RN JSON files (`WaveLinesAnimation.json`, `FullscreenGreen.json`, `confetti.json`) already exist in `wagerproof-mobile/assets/` — bundle them into `WagerproofDesign/Resources/` when Lottie ships.

## Linked code

- `// FIDELITY-WAIVER #081` at the top of `AgentBornCelebrationView.swift`.
- See related #080 (generation intro Lottie).
