# Widget Headline Summaries

The big plain-language one-liner at the top of each game-detail widget:

> **No clear favorite, but 82% of the prediction market is on the under.**

One sentence, rendered large and bold above the widget body. A user who reads only
that line should get the point of the card. This is the literal enforcement of
`src/features/games/detail/WIDGET_DESIGN.md`'s "one card = one question,
recommendation first".

**Status:** shipped for **MLB only** (web). See "Adding a sport" below — the other
four sports were out of season when this was built and could not be verified
against real data.

---

## How it works

```
Trigger.dev  daily-widget-summaries  (07:00 ET)
   └─ loadSlate(sport, date)              agents-v3/src/summaries/slateSource.ts
   └─ per game × widget:
        buildWidgetPayload()              agents-v3/src/summaries/widgetPayloads.ts
        ├─ writer  LLM  -> headline       agents-v3/src/summaries/generateHeadline.ts
        ├─ deterministic gate             (numbers cited, teams named, length)
        └─ judge   LLM  -> pass/corrected/fail
   └─ upsert ai_completions (game_id, sport_type, widget_type)

Web  useAiCompletions -> getGameHeadlines -> WidgetCard headline=
```

### Why two checks

Deterministic code catches what is cheap and certain: a number that appears
nowhere in the payload, a team that isn't in this game, a sentence that runs long,
stray markdown. It runs first, so obviously-broken drafts never reach the
expensive call.

The judge catches the one thing code cannot — a sentence whose every number is
real but whose *claim* is wrong. In testing it rejected
*"prediction market gives Rangers 62% to cover, above Vegas line"* because no
Vegas cover probability was supplied to compare against. That is the failure mode
this exists for.

This is the repo's first LLM-as-judge. Every other validator (`submitPicks.ts`,
the Zod schemas, `loopGuards.ts`) is deterministic.

### QC gating is load-bearing

`qc_status` is not telemetry. `getGameHeadlines()` only returns rows with
`qc_status IN ('pass','corrected')`, so a failed headline is **withheld** — the
card renders as it always did. A confidently-worded wrong sentence at the top of a
card is worse than no sentence. Failed rows are still persisted (with
`headline_text` NULL) so a bad run stays auditable.

---

## Widget types are keyed to the QUESTION, not the component

Web and the native apps render different component trees for the same question —
web's NFL detail has a Spread card, iOS renders pick-groups off `nfl_dryrun_picks`.
Keying to the betting question means one generated row serves every surface.

| widget_type | Sports | Web component |
|---|---|---|
| `market_odds` | all 5 | `sections/MarketOddsSection.tsx` (the Polymarket widget) |
| `spread_prediction` | nfl, cfb, nba, ncaab | NFL/NBA prediction sections, `CollegeModelCards` |
| `ou_prediction` | all 5 | same, plus `MlbTotalSection` |
| `moneyline_prediction` | mlb | `MlbMoneylineSection` |

`WIDGETS_BY_SPORT` in `widgetPayloads.ts` is the spend control — generating for a
widget the app never renders is pure cost.

---

## The game_id join is the fragile part

`ai_completions.game_id` must equal the id the **web feed** uses, or the headline
silently never renders. The feed adapters key each sport differently:

| Sport | Web feed id (`src/features/games/api/`) |
|---|---|
| NFL | `home_away_unique` (documented as `= training_key`) |
| CFB | `String(row.id)` from `cfb_live_weekly_inputs` — **not** `training_key` |
| NBA / NCAAB | `String(game.game_id)` |
| MLB | `String(game_pk)` |

`resolveGameId()` mirrors these off the **raw** row. Do not "simplify" it to the
agent formatter's `game_id`: `formatCFBGame` keys on `training_key`, a column
`cfb_live_weekly_inputs` does not have, so CFB would write rows no client reads.

## Why this doesn't reuse `fetchGamesForSport`

`agents-v3`'s existing loader is built for the pick agent and reads prediction
tables directly. `nfl_predictions_epa` has no moneylines, no total, and none of
the model-vs-market deltas — the numbers these widgets are *about*. `slateSource.ts`
mirrors the web feed adapters instead.

---

## Adding a sport

Implement a `load<Sport>` in `slateSource.ts` and add it to `SUPPORTED_SPORTS`.
Each needs the same merge the web adapter does:

| Sport | Tables | Notes |
|---|---|---|
| NFL | `v_input_values_with_epa` + `nfl_predictions_epa` + `nfl_betting_lines` + `production_weather` | lines/splits come from `nfl_betting_lines` |
| CFB | `cfb_live_weekly_inputs` + `cfb_api_predictions` | join on `id` |
| NBA | `nba_input_values_view` + `nba_predictions` | **edges are derived**, see below |
| NCAAB | `v_cbb_input_values` + `ncaab_predictions` | **edges are derived** |
| MLB | `mlb_games_today` | self-contained — lines, model, pitchers, weather |

**NBA/NCAAB caveat:** `home_spread_diff`, `over_line_diff`, `pred_spread` and
`pred_over_line` do not exist in the predictions tables — `nbaGames.ts` computes
them client-side, and the spread-cover probability is a **heuristic** (5% per
point of model-vs-Vegas gap), not model output. A headline must not present that
number as the model's own confidence.

Then seed `ai_completion_configs` rows for the new `(widget_type, sport_type)`
pairs; a widget with no enabled config is skipped.

---

## Operating it

```bash
# dry run against real data, no writes, 3 games
cd agents-v3 && npx tsx scripts/smoke-widget-summaries.mjs

# point at a different provider when OPENAI_API_KEY has no credit
SUMMARY_MODEL=deepseek-v4-flash npx tsx scripts/smoke-widget-summaries.mjs

npm run deploy   # ships the schedule; enable it for prod in the dashboard
```

Prompts are per `(widget_type, sport_type)` in `ai_completion_configs` and are
admin-editable at `/admin/ai-settings` — tuning tone needs no deploy.

The task shares the V3 daily spend cap (`isOverDailySpendCap`); headlines are a
nice-to-have and must never starve pick generation. It logs an error when more
than 30% of a run fails QC, which usually means prompts or payloads have drifted.

## Files

| Path | Role |
|---|---|
| `agents-v3/trigger/dailyWidgetSummaries.ts` | the schedule |
| `agents-v3/src/summaries/runDailySummaries.ts` | orchestration + upsert |
| `agents-v3/src/summaries/slateSource.ts` | per-sport slate, mirrors web feed |
| `agents-v3/src/summaries/widgetPayloads.ts` | per-widget payload + id resolution |
| `agents-v3/src/summaries/generateHeadline.ts` | writer, deterministic gate, judge |
| `supabase/migrations/20260726120000_widget_headline_summaries.sql` | columns, MLB, prompts |
| `src/components/ios/WidgetCard.tsx` | renders `headline` |
| `src/services/aiCompletionService.ts` | `getGameHeadlines()` (QC-gated read) |
| `src/features/games/hooks/useAiCompletions.ts` | fetches bodies + headlines |
