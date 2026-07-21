# Parlay God (web engine)

Pure-TS port of the iOS Parlay God engine. Harvests every bettable selection
currently backed by a **perfect streak** (100% hit rate, sample ≥ 3) from today's
MLB slate and assembles them into themed 3–5 leg parlay tickets with per-leg odds
and a combined price. Client-side only — no server or schema changes.

Mirrors `.claude/docs/16_parlay_god.md` and the Swift sources
(`WagerproofKit/Sources/WagerproofModels/ParlayGod.swift`,
`WagerproofKit/Sources/WagerproofServices/ParlayGodEngine.swift`). **Web ships
MLB-only** this phase — the NFL prop-leg path is intentionally not ported (it's a
matchup-widget-only surface on iOS and would pollute the cross-game rails with the
dry-run slate's dates).

## What qualifies as a leg

A leg is a concrete bet (side + line + odds) whose supporting trend went N-of-N:

- **Team legs** (`teamLegs`): from the Outliers MLB bundle (`fetchMLBBundle`) —
  `mlb_team_trends` splits (overall → Team Form, home/away → Home/Away, day/night,
  fav/dog, plus F5 markets → First 5) and H2H `matchups` → Versus Opponent, joined
  to today's game context (a home-split streak only counts if the team is home
  today, etc.). Odds come off `OutliersTrendsMLBContext`. A perfect *losing* streak
  becomes a fade leg (back the opponent's ML/RL).
- **Prop legs** (`propLegs`): from the props slate (`get_mlb_player_props_l10`) —
  L10 recent form (over or under), day/night split, vs-arm-type split, and
  alternate-line current streaks (deeper gate: ≥ 7 straight).

Guards (all tunables at the top of `engine.ts`, verbatim from Swift): sample ≥ 3
(`MIN_SAMPLE`), juice floor −350 (`ODDS_FLOOR`), alternate lines need a ≥ 7 streak
(`ALT_LINE_MIN_STREAK`).

## Categories & assembly

`ParlayGodCategory` — Versus Opponent, Recent Form, Alternate Lines, Home/Away,
Team Form, Fav vs Dog, Day/Night, First 5, vs Arm Type. Each rail card is one
category. Categories that can't field `MIN_LEGS` (3) today don't render.

`assemble` is greedy best-first (streak depth → friendlier odds → id), enforcing:
unique subject, unique (game, subject, bet), max 2 legs per market per card
(`MARKET_CAP`), one leg per game on cross-game rails, and conflict rules (no
Over+Under of the same total; no same-game legs backing opposite teams).
Deterministic — same pool in → same parlay out. Combined odds = product of per-leg
decimal odds.

`slateTickets` (team legs, cross-game, one per game) feeds the **Parlay God** rail;
`propsTickets` (prop legs only) feeds the **Props Cheats** rail. `gameTickets` (same
-game, ≤ 3 cards × ≤ 4 legs) is ported for parity but unused by the Outliers page.

## Public surface (`@/features/parlayGod`)

- `types.ts` — `ParlayGodCategory`, `PARLAY_CATEGORY_ORDER`,
  `PARLAY_CATEGORY_TITLE`, `PARLAY_CATEGORY_ICON` (lucide-react icon names),
  `ParlayLeg`, `legOddsText`, `legFractionText`, `ParlayTicket`,
  `ticketIsSameGame`, `ParlayGodPropMatchup`.
- `engine.ts` — tunables + `decimalOdds`, `americanText`, `combinedOddsText`,
  `teamLegs`, `propLegs`, `assemble`, `slateTickets`, `propsTickets`, `gameTickets`,
  `buildParlayTickets`. UI-free; unit-tested in `engine.test.ts`.
- `propMatchupAdapter.ts` — `buildPropMatchups` (pure) + `LineupTeamRow`. Maps the
  existing MLB hooks' shapes into the engine's `ParlayGodPropMatchup[]`.
- `useParlayGod.ts` — `useParlayGod(enabled)` React Query hook. Reuses
  `fetchMLBBundle`, `useTodaysMatchupGames`, `useAllPlayerProps` + one batched
  `mlb_game_lineups` query; 5-min stale. Resilient: a failed bundle still yields
  prop tickets and vice-versa. Exposes **separate** `slateLoading` (bundle only)
  and `propsLoading` (per-game prop RPCs) so the two rails resolve independently
  (spec §10) — the slate rail never reverts to its skeleton while props load.
- `ProGate.tsx` — `<ProGate title minHeight>` section-level Pro gate (blur +
  tap-to-unlock → `/access-denied`). Passes through for Pro users
  (`useRevenueCat().hasProAccess`) and for admins (`useIsAdmin().isAdmin`, not
  AdminModeContext — admins shouldn't have to toggle admin mode to see the
  product unblurred).

## Data sources (all on the CFB warehouse, anon-readable)

`mlb_team_trends`, `mlb_games_today`, `mlb_odds_snapshots` (via `fetchMLBBundle`);
`get_mlb_player_props_l10` RPC (via `useAllPlayerProps`); `mlb_game_lineups`
(batched team-tint lookup in `useParlayGod`).

## Tests

`engine.test.ts` (vitest) — streak qualification + largest-N window, odds floor,
alternate-line ≥ 7 gate, conflict rules (totals + backed team), market cap,
deterministic ordering, MIN_LEGS gate, and odds math. Run:

```bash
npx vitest run src/features/parlayGod
```
