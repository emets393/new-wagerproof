# Parlay God (iOS)

Pro-gated feature that harvests every bettable selection currently backed by a
**perfect streak** (100% hit rate, sample ≥ 3) and assembles them into themed
3–5 leg parlay cards with per-leg odds and a combined price. One engine, four
surfaces. All client-side — no server or schema changes.

## What qualifies as a leg

A leg is a concrete bet (side + line + odds) whose supporting trend went N-of-N:

- **Team legs** (MLB): from the Outliers MLB bundle — `mlb_team_trends` splits
  (overall / home-away / fav-dog / day-night, plus F5 markets) and H2H
  `matchups`, joined to today's context (a home-split streak only counts if the
  team is home today, etc.). Odds come from `mlb_games_today` +
  `mlb_odds_snapshots` via `OutliersTrendsMLBContext`. A perfect *losing*
  streak becomes a fade leg (back the opponent's ML/RL).
- **Team legs** (NFL): from the Outliers NFL bundle — `nfl_team_trends` splits
  (overall / home-away / fav-dog; markets moneyline / spread / total, plus
  h1_spread / h1_total → the First Half category) and H2H `matchups`, same
  join-to-today rules. Odds come from `nfl_dryrun_games` via
  `OutliersTrendsNFLContext`: real ML closes and fully-priced H1 markets; FG
  spread/total juice isn't stored there so those legs price at the standard
  −110 (`nflDefaultJuice`).
- **Prop legs** (MLB): from the props slate (`get_mlb_player_props_l10` RPC) —
  L10 recent form (over or under), day/night split, vs-arm-type split, and
  alternate-line current streaks (deeper gate: ≥ 7 straight).
- **Prop legs** (NFL): from `nfl_dryrun_props` via PropsStore — L10 recent form
  and vs-opponent, at the close line with consensus prices. Built per-game only
  (dry-run slate dates would pollute the live rails).

Guards: sample ≥ 3 (`minSample`), juice floor −350 (`oddsFloor`), alternate
lines need a ≥ 7 streak (`altLineMinStreak`). All tunables sit at the top of
`ParlayGodEngine`.

## Categories

`ParlayGodCategory` — each rail card is one category; every leg on it is
perfect in that dimension: Versus Opponent, Recent Form, Alternate Lines,
Home/Away, Team Form, Fav vs Dog, Day/Night, First 5, First Half (NFL's F5
analog), vs Arm Type. Categories that can't field 3 legs today don't render
(thin days shrink the rail).

Every leg is sport-tagged (`ParlaySport`); tickets carry a `sports` array.
Sports whose slates are concurrently **live** (any game not long started —
6h grace, `ParlayGodEngine.liveSports`) merge into ONE cross-sport card per
category — cross-sport parlays are placeable, and one deep pool beats two thin
cards. A **stale** slate (entirely past dates, e.g. the NFL dry-run) keeps its
own per-sport card after the merged one, so a merged ticket is never a
fictional bet pairing tonight's games with a months-old slate. The rail header
shows a right-aligned "Supports ⚾🏈" overlapping-icon cluster
(`ParlayGodRail.sports`, fed by `ParlayGodStore.slateSports`/`propsSports` —
sports fielding ≥ 1 ticket), and each card header carries one small sport chip
per contributing sport.

## Assembly rules (`ParlayGodEngine.assemble`)

Greedy best-first (streak depth, then friendlier odds), enforcing: unique
subject, unique (game, subject, bet) — the same fade can qualify via Team Form
AND H2H — max 2 legs per market per card, one leg per game on cross-game
rails, and conflict rules (no Over+Under of the same total; no same-game legs
backing opposite teams). Deterministic: same data in → same parlays out.
Combined odds = product of per-leg decimal odds.

## Surfaces

| Surface | Where | Tickets |
|---|---|---|
| Parlay God rail | Top of Outliers tab (`OutliersTrendsView`), above the market sections | `slateTickets` (cross-game, **game-market legs only** — mirrors the Outliers page's markets) |
| Search section | `SearchView` empty state, below Explore | same `slateTickets` |
| Props Cheats | Top of Props tab MLB feed (`PropsView`), under Best Picks | `propsTickets` (prop legs only — the props counterpart to Parlay God) |
| Matchup Parlays | `MLBGameBottomSheet` (after Player Props) and `NFLGameBottomSheet` (after predictions) as a `WidgetCollapsingSection` with a horizontal card scroller | same-game tickets, ≤ 3 cards × ≤ 4 legs |

All surfaces are Pro-gated via `ProContentSection` (blur + tap-to-unlock).
Tapping a card opens `ParlayGodDetailSheet` (expanded legs with evidence +
responsible-gambling note).

## Files

- Models: `WagerproofKit/Sources/WagerproofModels/ParlayGod.swift`
- Engine: `WagerproofKit/Sources/WagerproofServices/ParlayGodEngine.swift`
- Store: `WagerproofKit/Sources/WagerproofStores/ParlayGodStore.swift` —
  shell-hoisted in `MainTabView`, fetches the MLB + NFL trends bundles + props
  slate itself (5-min TTL), builds the leg pool off-main, memoizes per-game
  tickets. Each source tolerates the others failing (stale legs of that kind
  are kept for the TTL).
- UI: `Wagerproof/Features/Outliers/Components/ParlayGodCard.swift`
  (`ParlayGodCard`, `ParlayGodRail`, `ParlayGodCardShimmer`,
  `ParlayGodDetailSheet`)
- Tests: `WagerproofKit/Tests/WagerproofStoresTests/ParlayGodEngineTests.swift`
- Reference implementation (validated against live data before the Swift
  port): `.context/parlay_god_demo.py` (gitignored scratch)

## Known constraints

- MLB props carry no opponent-team field in their game log, so Versus Opponent
  is team-markets + NFL-props territory.
- `mlb_team_trends.through_date` lags the season (data-ops job) — team-form
  evidence reflects that snapshot date, same as the Outliers tab.
- NFL *prop* legs stay out of the cross-game rails until the in-season props
  cutover replaces the dry-run tables; NFL *team* legs are on the rails now —
  as separate tickets while the dry-run slate is stale, merging into the
  cross-sport cards automatically once the NFL slate has live dates.
- NFL FG spread/total legs price at −110 (real juice isn't in
  `nfl_dryrun_games`); ML and H1 legs use real closes.
- NFL team trends also ship `team_total` splits — not yet turned into legs.
