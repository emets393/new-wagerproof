# Deterministic widget headlines

The one-sentence verdict at the top of each `/games` detail widget. Pure
functions, no I/O.

```ts
// nba/NbaPredictionsSection.tsx
headline={nbaSpreadHeadline({ modelLine, marketLine, edgePts, pickAbbrev }) ?? undefined}
```

These replaced an LLM pipeline that kept getting **side attribution backwards** —
calling a −3.3 home edge "+3.3 for the home team", naming the favorite as the
value side, inverting over/under. A wrong sentence sitting directly above the
right numbers is the worst thing this card can do, so the sentence is now derived
from those same numbers.

Full background, inventory, and the deprecated pipeline:
`.claude/docs/17_widget_headlines.md`.

## The rules

**1. Take resolved values, never raw columns.** Every input must be something the
component has already computed *and rendered*. That is what makes it impossible
for the headline to contradict the card. If you find yourself re-deriving a sign
from a DB field, stop — the component already did it, take that instead.

**2. If the side isn't resolved, return `null`.** Do not guess a side to avoid an
empty headline. `null` renders the card exactly as it looked before headlines
existed, which is always an acceptable outcome.

**3. Return `string | null`, call with `?? undefined`.** `WidgetCard`'s prop is
optional; `null` is not a valid value for it.

**4. Guard every interpolation with `isNum()`** (`shared.ts:18`) so no template
can print `NaN` or `Infinity`.

**5. Don't name a side you can't prove.** `marketOddsHeadline` (`shared.ts:41-55`)
is the worked example: Polymarket's "away" series is not reliably the away team
and the spread/total markets are matched by text, so it names no team at all and
returns `null` for anything but moneyline. Describing *how decisive* a market is,
without claiming *who* it favors, beats a coin-flip attribution.

**6. Comment the sign logic.** Not the string — the reasoning about which
direction is which. See `nba.ts:65-70` (why a 0.0 edge names nobody) and
`nba.ts:77-78` (why lay/take keys off `marketLine`'s sign). These are the lines a
future edit will get wrong.

## Layout

| File | Scope |
|---|---|
| `shared.ts` | Market Odds + Match Simulator (all sports), and the two college model cards used by **both** CFB and NCAAB |
| `mlb.ts` `nba.ts` `nfl.ts` `cfb.ts` | per-sport |
| `headlines.test.ts` | the cases the LLM got wrong — favorite vs value side, American-odds sign, over/under orientation |

`npm test` runs them. Add a case whenever you add a formatter that resolves a
side; that is the whole point of the file.

## NFL has no model fair line — this is not a bug

`nfl_predictions_epa` is a **classifier**. It emits `home_away_spread_cover_prob`
and `ou_result_prob` and nothing else: there is no `model_fair_home_spread`, no
`pred_home_margin`, no `model_fair_total`, no projected scores. So
`home_spread_diff` / `over_line_diff` are permanently `null` for NFL, and
`nflSpreadHeadline` / `nflTotalHeadline` take `pickEdge: null` on every live row.

That is why NFL headlines read "Model expects PIT -3.5 to cover at 63%" while
every other sport quotes a model-vs-Vegas gap. **Do not "fix" it by widening the
`.select()` in `api/nflGames.ts`** — the columns do not exist. The edge branches in
those two formatters stay dormant on NFL and remain live for any future sport that
reuses the types.

## Known loose ends

- `matchSimulatorHeadline` (`shared.ts:112`) is written but **not wired** to any
  section. Every other formatter is rendered somewhere.
