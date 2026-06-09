# Ticket #012 — Onboarding agent builder ships abbreviated 2-step path

**Status:** open
**Filed by:** b02-implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/components/onboarding/steps/OnboardingAgentBuilder.tsx` → `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingAgentBuilderView.swift`

## What we couldn't ship in scope

The RN onboarding agent builder runs a 5-screen sub-flow inside step 15:
sport/archetype → identity → personality sliders → data/conditions → custom
insights. The Swift port ships only the first two screens (sport + identity);
the remaining three render a placeholder card with a Continue button.

## Why

The full builder reuses `components/agents/creation/Screen3_Personality.tsx`
(40+ tunable parameters), `Screen4_DataAndConditions.tsx`, and
`Screen5_CustomInsights.tsx`. All three are owned by Phase 4 / batch B14 —
`AgentCreateView` and friends — and depend on the AgentStore + `personalityParams`
type which haven't been ported yet. Building them here would mean either
duplicating B14's surface or shipping shallow stubs that B14 then has to
replace.

## Impact

Onboarding users can name an agent and pick its sport(s) + emoji + color but
cannot tune personality, set data thresholds, or write custom insights from
within the onboarding flow. RN parity claims "you tuned your agent during
onboarding"; the port's claim is "we'll tune it for you using defaults." All
defaults are loaded from `OnboardingStore.AgentDraft`'s zero-value initializer,
which matches the RN `INITIAL_FORM_STATE`. Users can edit any of these
parameters from the Agents tab once it ships.

## Acceptance criteria

- `AgentCreateView` (B14) is merged.
- `OnboardingAgentBuilderView` swaps the three placeholder cases for embeds
  of `Screen3_Personality`, `Screen4_DataAndConditions`, `Screen5_CustomInsights`.
- Onboarding parity screenshots cover steps 17 / 18 / 19 individually.

## Linked code

- `// FIDELITY-WAIVER #012` in `Wagerproof/Features/Onboarding/Components/OnboardingAgentBuilderView.swift`

## Notes

The abbreviated path still calls `store.markComplete()` at the end of step 19,
so the cinematic + completion handoff is identical to RN. Only the depth of
user input changes.
