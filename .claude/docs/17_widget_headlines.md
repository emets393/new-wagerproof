# Widget Headline Summaries

The big plain-language one-liner at the top of each game-detail widget:

> **Model lays points with DEN -4.5 — its own line is -8.2, a 3.7-point edge.**

One sentence, rendered large and bold above the widget body. A user who reads only
that line should get the point of the card. This is the literal enforcement of
`src/features/games/detail/WIDGET_DESIGN.md`'s "one card = one question,
recommendation first".

**Status:** headlines are **deterministic**, computed client-side in
`src/features/games/detail/headlines/`. The LLM writer → gate → judge pipeline
that originally produced them is **DEPRECATED** and **no longer read by the web
app at all** — `getGameHeadlines()` and the `headlines` prop are deleted. The
generator and its `ai_completions` columns are still on disk; see the last section.

**Web only.** Neither native app renders headlines.

---

## How it works

```
Component derives its numbers (side, edge, magnitude, pct)
   └─ passes them to a pure headline formatter
        src/features/games/detail/headlines/{shared,mlb,nba,nfl,cfb}.ts
   └─ formatter returns `string | null`
   └─ `headline={fn({...}) ?? undefined}`  ->  src/components/ios/WidgetCard.tsx
```

There is no fetch, no cache, no daily job, and no failure mode where a headline
arrives late. The sentence is a function of the same values the card is already
rendering underneath it.

### Why deterministic replaced the LLM

The LLM **repeatedly got side attribution backwards** — calling a −3.3 home edge
"+3.3 for the home team", naming the favorite as the value side, inverting
over/under. This is the one error class that matters most: a confidently-worded
sentence that contradicts the numbers directly beneath it is worse than no
sentence, and it is exactly what a language model is worst at and a template is
best at.

The two-stage QC (deterministic gate + LLM judge) caught some of it but not
reliably, and the cost of the misses was borne by the user, not the run.

The current design makes the failure structurally impossible: a formatter is a
pure function of values the component has **already resolved and rendered**,
never of a raw DB column. The headline cannot disagree with the card because it
is derived from the card.

### The extension rule

From `headlines/shared.ts:11-12`, and it is the whole discipline in one line:

> If the sign/side has not already been resolved by the component, do **NOT**
> resolve it here. Return `null` instead.

`null` means the card renders with no headline — its previous, correct
appearance. Every formatter returns `string | null` and every call site spells
`?? undefined`. A missing headline is a normal outcome, not an error.

Two guards worth copying when you add one:
- `isNum()` (`shared.ts:18`) so no template can interpolate `NaN`/`Infinity`.
- Refuse to name a side you cannot prove. `marketOddsHeadline` deliberately names
  **no team** and returns `null` for spread/total markets, because Polymarket's
  "away" series is not reliably the away team and alt lines are possible
  (`shared.ts:41-55`). Characterising *how decisive* the market is, without
  claiming *who* it favors, is the honest sentence there.

---

## Inventory

`string | null` in every case. Sections live under `src/features/games/detail/sections/`.

| Formatter | File | Rendered by |
|---|---|---|
| `marketOddsHeadline` | `shared.ts:56` | `MarketOddsChart.tsx:190` (all sports) |
| `collegeSpreadHeadline` | `shared.ts:180` | `cfb/CollegeModelCards.tsx:124` (CFB **and** NCAAB) |
| `collegeTotalHeadline` | `shared.ts:221` | `cfb/CollegeModelCards.tsx:220` |
| `matchSimulatorHeadline` | `shared.ts:112` | **unwired** — the only one |
| `mlbPitchersHeadline` | `mlb.ts:62` | `mlb/MlbPitchersSection.tsx:94` |
| `mlbProjectedScoreHeadline` | `mlb.ts:131` | `mlb/MlbProjectedScoreSection.tsx:49` |
| `mlbMoneylineHeadline` | `mlb.ts:205` | `mlb/MlbMarketSection.tsx:95` |
| `mlbTotalHeadline` | `mlb.ts:282` | `mlb/MlbMarketSection.tsx:105` |
| `mlbSignalsHeadline` | `mlb.ts:345` | `mlb/MlbSignalsSection.tsx:102` |
| `mlbRegressionHeadline` | `mlb.ts:420` | `mlb/MlbRegressionSection.tsx:56` |
| `mlbWeatherHeadline` | `mlb.ts:477` | `mlb/MlbWeatherSection.tsx:35` |
| `mlbBettingTrendsHeadline` | `mlb.ts:524` | `mlb/MlbBettingTrendsSection.tsx:226` |
| `mlbPropsCheatsHeadline` | `mlb.ts:582` | `mlb/MlbPropsCheatsSection.tsx:163` |
| `nbaSpreadHeadline` | `nba.ts:55` | `nba/NbaPredictionsSection.tsx:69` |
| `nbaTotalHeadline` | `nba.ts:110` | `nba/NbaPredictionsSection.tsx:140` |
| `nbaBettingTrendsHeadline` | `nba.ts:184` | `nba/NbaBettingTrendsSection.tsx:85` |
| `nbaTeamStatsHeadline` | `nba.ts:284` | `nba/NbaTeamStatsSection.tsx:89` |
| `nbaInjuriesHeadline` | `nba.ts:375` | `nba/NbaInjuriesSection.tsx:247` |
| `nflBettingSplitsHeadline` | `nfl.ts:203` | `nfl/NflBettingSplitsSection.tsx:221` |
| `nflSpreadHeadline` | `nfl.ts:56` | `nfl/NflPredictionsSection.tsx:60` |
| `nflTotalHeadline` | `nfl.ts:118` | `nfl/NflPredictionsSection.tsx:147` |
| `nflH2HHeadline` | `nfl.ts:266` | `nfl/NflH2HSection.tsx:126` |
| `nflLineMovementHeadline` | `nfl.ts:329` | `nfl/NflLineMovementSection.tsx:158` |
| `cfbWeatherHeadline` | `cfb.ts:64` | `cfb/CfbWeatherSection.tsx:124` |
| `cfbDryRunSummaryHeadline` | `cfb.ts:152` | `cfb/CfbDryRunSections.tsx:229` |
| `cfbDryRunPickHeadline` | `cfb.ts:254` | `cfb/CfbDryRunSections.tsx:528` |

`matchSimulatorHeadline` is the only formatter nothing renders. It is not dead
code by intent — it was written ahead of the section that will use it.

Tests: `headlines.test.ts` covers the cases the LLM got wrong (favorite vs value
side, American-odds sign, over/under orientation). `npm test`.

### NFL: no model fair line, by design

`nfl_predictions_epa` is a **classifier**. Its full column set is `id, run_id,
as_of_ts, model_version, training_key, unique_id, season, week, home_team,
away_team, home_team_id, away_team_id, home_spread, away_spread, ou_vegas_line,
game_date, game_time_et, home_away_ml_prob, home_away_ml_pred,
home_away_spread_cover_prob, home_away_spread_cover_pred, ou_result_prob,
ou_result_pred` — probabilities and Vegas lines, and **no** `model_fair_home_spread`,
`pred_home_margin`, `model_fair_total`, `pred_total_points`, or projected scores.

So `home_spread_diff` / `over_line_diff` in `api/nflGames.ts` are permanently
`null`, and `nflSpreadHeadline` / `nflTotalHeadline` receive `pickEdge: null` on
every live NFL row. That is why NFL reads

> Model expects PIT -3.5 to cover at 63%.

while NBA/CFB/MLB quote a model-vs-Vegas gap. **This is not a too-narrow
`.select()`.** Widening it changes nothing because the columns do not exist. Both
formatters handle the null explicitly and deliberately never say the model "has no
line", which would be a false claim about the model.

The LLM read is gone: `getGameHeadlines()` is deleted, `useAiCompletions` fetches
bodies only, and the `headlines` prop is off `SportSectionsProps` and every
per-sport section.

---

## DEPRECATED: the LLM generation pipeline

Retired in favour of the deterministic formatters above. **Do not build on it.**
Still on disk, and the code below is unchanged — this section documents what is
there so nobody mistakes it for the live path.

```
Trigger.dev  daily-widget-summaries  (07:00 ET)
   └─ loadSlate(sport, date)              agents-v3/src/summaries/slateSource.ts
   └─ per game × widget:
        buildWidgetPayload()              agents-v3/src/summaries/widgetPayloads.ts
        ├─ writer  LLM  -> headline       agents-v3/src/summaries/generateHeadline.ts
        ├─ deterministic gate             (numbers cited, teams named, length)
        └─ judge   LLM  -> pass/corrected/fail
   └─ upsert ai_completions (game_id, sport_type, widget_type)
```

Read side: **deleted.** `getGameHeadlines()` selected `widget_type, headline_text,
qc_status` from `ai_completions` where `headline_text IS NOT NULL AND qc_status IN
('pass','corrected')`, keyed by `(game_id, sport_type)`. Rows that failed QC were
persisted with a NULL `headline_text` so a bad run stayed auditable, and were
withheld from the UI. Nothing in `src/` reads any of it now.

Widget types were keyed to the betting QUESTION, not to a UI component, so one row
could serve web and both native apps: `market_odds` (all 5), `spread_prediction`
(nfl/cfb/nba/ncaab), `ou_prediction` (all 5), `moneyline_prediction` (mlb).
`WIDGETS_BY_SPORT` in `widgetPayloads.ts` was the spend control.

Two things to know before touching any of it:

- **The `game_id` join was always the fragile part.** `ai_completions.game_id` had
  to equal the id the web feed uses, and the five feed adapters key differently
  (NFL `home_away_unique`, CFB `String(row.id)` from `cfb_live_weekly_inputs`,
  NBA/NCAAB `String(game.game_id)`, MLB `String(game_pk)`). `resolveGameId()`
  mirrored these off the raw row. This is a large part of why the pipeline was
  never worth its upkeep.
- **The schedule may still be live.** `agents-v3/trigger/dailyWidgetSummaries.ts`
  is still registered as task `daily-widget-summaries`. Whether it is enabled in
  Trigger.dev prod is not knowable from the repo — check the dashboard before
  assuming it stopped writing rows or stopped costing money. It shared the V3
  daily spend cap (`isOverDailySpendCap`).

Also still present: the `ai_completions` headline/QC columns and the
per-`(widget_type, sport_type)` prompts in `ai_completion_configs`, admin-editable
at `/admin/ai-settings`. Migration
`supabase/migrations/20260726120000_widget_headline_summaries.sql`.

Removing the pipeline is a follow-up. The first two steps are **done** (the NFL
read is cut and `getGameHeadlines()` + the `headlines` prop are deleted). What
remains: disable the schedule → delete `agents-v3/src/summaries/` and the trigger →
drop the columns and configs.

## Files

| Path | Role |
|---|---|
| `src/features/games/detail/headlines/` | **the live path** — pure formatters + tests |
| `src/features/games/detail/headlines/README.md` | how to add one |
| `src/components/ios/WidgetCard.tsx` | renders `headline` (17px semibold, under the title) |
| `src/features/games/detail/WIDGET_DESIGN.md` | why the headline sits where it does |
| `src/features/games/hooks/useAiCompletions.ts` | fetches AI completion **bodies** only — no headline read |
| `agents-v3/src/summaries/*`, `agents-v3/trigger/dailyWidgetSummaries.ts` | deprecated generator |
