# Ticket #234 — Outliers hub sections render CTA-only (no preview cards)

**Status:** open
**Filed by:** B-Outliers-Detail implementer
**Filed:** 2026-05-24
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx` → `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift`

## What we couldn't ship in scope

The Outliers hub's 5 trend / accuracy / regression sections render a single CTA card per section instead of a horizontal scroll of preview matchup cards. In RN the hub renders up to 4 real preview cards per section (NBA trends, NCAAB trends, MLB trends, NBA accuracy, NCAAB accuracy, MLB regression).

## Why

The hub renders 6 sections (value, fade are already real; the other 5+ would need 5 different per-sport stores hydrated on cold-start). Pre-fetching every per-sport store would explode cold-start cost (6 different Supabase RPCs fanning out). Better tradeoff: lazy-hydrate the per-sport store inside the detail view (on first push) so the hub stays fast and the user only pays for the data they're looking at.

## Impact

The hub looks slightly different from RN — instead of horizontal-scrolling preview cards under each header, the user sees a single accent-colored CTA card describing the section. The push-to-detail interaction is identical and full-fidelity once the user taps in.

## Acceptance criteria

- One of:
  - A) Each `deferredSection(...)` call wires the matching per-sport store as a hub-scoped instance, hydrates it lazily on first appear, and renders `prefix(4)` preview cards via `LazyHStack`.
  - B) Product-side decides the CTA-only hub is the desired shape (in which case this ticket flips to `wontfix` with that note).

## Linked code

- `// FIDELITY-WAIVER #234: ...` in `wagerproof_ios_native/Wagerproof/Features/Outliers/OutliersView.swift` (above `deferredSection`)

## Notes

The detail views (`NBABettingTrendsView`, `MLBBettingTrendsView`, etc.) are full-fidelity ports of the RN list screens. The waiver only covers the hub-row preview cards.
