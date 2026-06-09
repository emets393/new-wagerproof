# Ticket #024 — Outliers per-team color gradients fall back to sport tint

**Status:** open
**Filed by:** B06 implementer
**Filed:** 2026-05-20
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/components/OutlierMatchupCard.tsx:40–49` (`getTeamColors`) + `utils/teamColors.ts` + `constants/mlbTeams.ts` → `wagerproof_ios_native/Wagerproof/Features/Outliers/Components/OutlierMatchupCard.swift:OutlierTeamPalette`

## What we couldn't ship in scope

The RN `OutlierMatchupCard` resolves each team's primary / secondary brand color via `utils/teamColors.ts` (NFL/CFB/NBA tables) + `constants/mlbTeams.ts` (MLB), producing a per-team gradient (e.g. Celtics green→Lakers purple for BOS @ LAL). The Swift port currently uses a single sport-tinted gradient (NFL navy, CFB red, NBA blue, etc.) for every card.

## Why

The full RN team-color tables together carry ~150 NFL + NBA + CFB + MLB entries with multiple color stops each. Porting them is part of the "Team module" pass that's slated for B08 (Settings + per-team UI components). Inlining them here would create a second source of truth that B08 would then need to deduplicate.

## Impact

Outlier matchup cards still get a left→right gradient, but every NBA card uses the same blue tint, every CFB card uses the same red, etc. Logos + abbreviations still render correctly, so the matchup is unambiguous; only the brand identity colour is generic per-sport.

## Acceptance criteria

- A `TeamColorPalette` (or equivalent) exists in `WagerproofKit/Sources/WagerproofModels/` exposing `.primary(team:sport:)` and `.secondary(team:sport:)` colors.
- `OutlierTeamPalette.color(for:sport:slot:)` delegates to that shared palette and the per-sport switch is removed.
- The `// FIDELITY-WAIVER #018` comment is removed.

## Linked code

- `// FIDELITY-WAIVER #018: per-team gradients fall back to a sport tint when the team table isn't ported.` in `wagerproof_ios_native/Wagerproof/Features/Outliers/Components/OutlierMatchupCard.swift` (above `OutlierTeamPalette`)

## Notes

The Editor's Picks port (B05) is hitting the same gap via waiver #008 ("Team colors / NBA logo fallback"). Both should resolve together when the Team module lands so we don't end up with two palettes.
