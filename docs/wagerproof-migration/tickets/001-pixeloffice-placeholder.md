# Ticket #001 — PixelOffice carousel slide placeholder

**Status:** open
**Filed by:** B01 implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(auth)/login.tsx` → `wagerproof_ios_native/Wagerproof/Features/Auth/Components/OnboardingSlide.swift`

## What we couldn't ship in scope

Slide 2 of the login carousel ("Create Bots") in the RN app embeds the `PixelOffice` component — a fully animated 3D-isometric agent-office scene driven by `@/components/agents/PixelOffice.tsx`. B01 ships a static SF-symbol bot trio placeholder (`CreateBotsPlaceholder` in `OnboardingSlide.swift`) instead.

## Why

PixelOffice is a multi-file feature (PixelOffice + agents store wiring + isometric tilesets + animation timeline). Porting it inside B01 violates the auth-foundation scope. It belongs to the Phase 4 Agents batch.

## Impact

The "Create Bots" slide visually loses the animated 3D office scene and shows a static row of three SF-symbol bots labelled "Sharp Edge · Taco King · Data Bot" — the slide copy and CTA buttons remain identical. Marketing message preserved; demo visual fidelity reduced.

## Acceptance criteria

- Phase 4 batch B-Agents ships `PixelOfficeView` in `Wagerproof/Features/Agents/Components/`.
- `OnboardingSlide.createBots` switches from `CreateBotsPlaceholder` to `PixelOfficeView(agents: DemoAgents.all, hideControls: true)`.
- Visual parity confirmed against RN screenshot of slide 2.

## Linked code

- `// FIDELITY-WAIVER #001` in `Wagerproof/Features/Auth/Components/OnboardingSlide.swift`

## Notes

The 100ms `setTimeout` deferred-mount trick from RN is also dropped — once PixelOffice ships natively as a SwiftUI view, the deferred mount can be implemented with `.task { try? await Task.sleep(for: .milliseconds(100)); ready = true }` per `08-screen-native-spec.md`.
