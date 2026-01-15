# Mobile App Data Fetching Patterns

This document describes how the mobile app fetches game and prediction data for each sport. Each sport has slightly different table structures and join patterns.

## Overview

The mobile app's main feed (`app/(drawer)/(tabs)/index.tsx`) fetches data for all four sports. The general pattern is:

1. **Fetch game/input data** from a view or table
2. **Fetch predictions** from a predictions table (filtered by latest `run_id`)
3. **Merge** the two datasets using a common key (usually `game_id` or `training_key`)

## NFL Data Fetching

### Tables Used
- `v_input_values_with_epa` - Game input data (teams, dates, spreads)
- `nfl_predictions_epa` - Model predictions (probabilities)
- `nfl_betting_lines` - Live betting lines and public splits
- `production_weather` - Weather data for outdoor games

### Join Key
- `home_away_unique` (from inputs) = `training_key` (in predictions/betting)

### Fetch Pattern
```typescript
// 1. Fetch ALL games from input view
const { data: nflGames } = await supabase
  .from('v_input_values_with_epa')
  .select('*');

// 2. Fetch ALL predictions, find latest run_id client-side
const { data: allPredictions } = await supabase
  .from('nfl_predictions_epa')
  .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id');

// Find latest run_id and filter
const runIds = [...new Set(allPredictions.map(p => p.run_id))].sort().reverse();
const latestRunId = runIds[0];

// 3. Fetch betting lines (get most recent per training_key client-side)
const { data: bettingLines } = await supabase
  .from('nfl_betting_lines')
  .select('training_key, home_ml, away_ml, ...');

// 4. Fetch weather
const { data: weatherData } = await supabase
  .from('production_weather')
  .select('*');

// 5. Merge using training_key
games.map(game => {
  const matchKey = game.home_away_unique;
  const prediction = predictionsMap.get(matchKey);
  const bettingLine = bettingLinesMap.get(matchKey);
  const weather = weatherMap.get(matchKey);
  // ... merge fields
});
```

### Key Fields Mapped
| Source | Field | Destination |
|--------|-------|-------------|
| predictions | `home_away_ml_prob` | `home_away_ml_prob` |
| predictions | `home_away_spread_cover_prob` | `home_away_spread_cover_prob` |
| predictions | `ou_result_prob` | `ou_result_prob` |
| betting | `home_ml`, `away_ml` | `home_ml`, `away_ml` |
| betting | `spread_splits_label` | `spread_splits_label` |
| weather | `temperature`, `wind_speed` | `temperature`, `wind_speed` |

---

## CFB (College Football) Data Fetching

### Tables Used
- `cfb_live_weekly_inputs` - Combined game + prediction data
- `cfb_api_predictions` - Additional API predictions (optional)

### Join Key
- `id` field matches between tables

### Fetch Pattern
```typescript
// 1. Fetch from combined view (already has predictions)
const { data: preds } = await supabase
  .from('cfb_live_weekly_inputs')
  .select('*');

// 2. Optionally fetch additional API predictions
const { data: apiPreds } = await supabase
  .from('cfb_api_predictions')
  .select('*');

// 3. Merge using id
games.map(prediction => {
  const apiPred = apiPreds?.find(ap => ap.id === prediction.id);
  // ... merge fields
});
```

### Key Fields Mapped
| Source | Field | Destination |
|--------|-------|-------------|
| inputs | `pred_ml_proba` | `home_away_ml_prob` |
| inputs | `pred_spread_proba` | `home_away_spread_cover_prob` |
| inputs | `pred_total_proba` | `ou_result_prob` |
| apiPreds | `pred_away_score`, `pred_home_score` | `pred_away_score`, `pred_home_score` |
| apiPreds | `home_spread_diff` | `home_spread_diff` |

**Note:** CFB uses a combined view, so predictions are already included in the input data.

---

## NBA Data Fetching

### Tables Used
- `nba_input_values_view` - Game input data
- `nba_predictions` - Model predictions

### Join Key
- `game_id` (numeric)

### Fetch Pattern
```typescript
// 1. Fetch ALL games from input view
const { data: inputValues } = await supabase
  .from('nba_input_values_view')
  .select('*');

// 2. Fetch ALL predictions, group by game_id and keep latest as_of_ts_utc
const { data: allPredictions } = await supabase
  .from('nba_predictions')
  .select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc');

// Group by game_id, keep latest
const gameIds = inputValues.map(g => g.game_id);
allPredictions.forEach(pred => {
  if (gameIds.includes(pred.game_id)) {
    const existing = predictionMap.get(pred.game_id);
    if (!existing || pred.as_of_ts_utc > existing.as_of_ts_utc) {
      predictionMap.set(pred.game_id, pred);
    }
  }
});

// 3. Merge using game_id
games.map(input => {
  const prediction = predictionMap.get(input.game_id);
  // ... merge fields
});
```

### Key Fields Mapped
| Source | Field | Destination |
|--------|-------|-------------|
| predictions | `home_win_prob` | `home_away_ml_prob` |
| predictions | `model_fair_home_spread` | Used to calculate `home_away_spread_cover_prob` |
| predictions | `model_fair_total` | Used to calculate `ou_result_prob` |
| predictions | `home_score_pred`, `away_score_pred` | `home_score_pred`, `away_score_pred` |

### Calculated Fields
- `home_away_spread_cover_prob`: Calculated from `model_fair_home_spread` vs Vegas spread
- `ou_result_prob`: Calculated from `model_fair_total` vs Vegas total

---

## NCAAB (College Basketball) Data Fetching

### Tables Used
- `v_cbb_input_values` - Game input data
- `ncaab_predictions` - Model predictions

### Join Key
- `game_id` (numeric) - **MUST convert to Number() for comparison**

### Fetch Pattern (IMPORTANT - Must filter by run_id first!)
```typescript
// 1. Fetch ALL games from input view
const { data: inputValues } = await supabase
  .from('v_cbb_input_values')
  .select('*');

// 2. Get latest run_id FIRST
const { data: latestRun } = await supabase
  .from('ncaab_predictions')
  .select('run_id')
  .order('as_of_ts_utc', { ascending: false })
  .limit(1)
  .maybeSingle();

// 3. Fetch predictions ONLY for latest run_id and matching game_ids
const gameIds = inputValues.map(g => Number(g.game_id));
const { data: predictions } = await supabase
  .from('ncaab_predictions')
  .select('*')
  .eq('run_id', latestRun.run_id)
  .in('game_id', gameIds);

// 4. Build prediction map
predictions.forEach(pred => {
  predictionMap.set(Number(pred.game_id), pred);
});

// 5. Merge using game_id (convert to Number!)
games.map(input => {
  const prediction = predictionMap.get(Number(input.game_id));
  // ... merge fields
});
```

### Key Fields Mapped
| Source | Field | Destination |
|--------|-------|-------------|
| predictions | `home_win_prob` | `home_away_ml_prob` |
| predictions | `home_win_prob` | `home_away_spread_cover_prob` (used as proxy) |
| predictions | `pred_total_points`, `vegas_total` | Used to calculate `ou_result_prob` |
| predictions | `pred_home_margin` | `pred_home_margin` |
| predictions | `pred_total_points` | `pred_total_points` |
| predictions | `vegas_home_spread` | `home_spread` (overrides input) |
| predictions | `vegas_total` | `over_line` (overrides input) |
| predictions | `vegas_home_moneyline` | `home_ml` (overrides input) |

### Calculated Fields
- `ou_result_prob`: `pred_total_points > vegas_total ? 0.6 : 0.4`

---

## Common Pitfalls

### 1. Type Mismatches
**Problem:** `game_id` might be a string in one table and number in another.
**Solution:** Always convert to `Number()` when comparing:
```typescript
const gameIds = inputValues.map(g => Number(g.game_id));
predictionMap.set(Number(pred.game_id), pred);
const prediction = predictionMap.get(Number(input.game_id));
```

### 2. Not Filtering by run_id
**Problem:** Fetching all predictions returns old data that doesn't match today's games.
**Solution:** Always get the latest `run_id` first, then filter predictions by it:
```typescript
// WRONG - fetches all historical predictions
const { data } = await supabase.from('predictions').select('*');

// CORRECT - fetches only latest predictions
const { data: latestRun } = await supabase
  .from('predictions')
  .select('run_id')
  .order('as_of_ts_utc', { ascending: false })
  .limit(1)
  .maybeSingle();

const { data } = await supabase
  .from('predictions')
  .select('*')
  .eq('run_id', latestRun.run_id);
```

### 3. Using Wrong Join Key
Each sport uses different join keys:
- **NFL:** `home_away_unique` / `training_key`
- **CFB:** `id`
- **NBA:** `game_id`
- **NCAAB:** `game_id`

### 4. Field Name Differences
Prediction field names vary by sport:
- NFL: `home_away_ml_prob`, `home_away_spread_cover_prob`, `ou_result_prob`
- CFB: `pred_ml_proba`, `pred_spread_proba`, `pred_total_proba`
- NBA: `home_win_prob`, `model_fair_home_spread`, `model_fair_total`
- NCAAB: `home_win_prob`, `pred_total_points`, `vegas_total`

---

## Web App vs Mobile App

The web app (`src/services/basketballDataService.ts`) uses the same patterns. When updating data fetching logic, ensure both are in sync:

| Sport | Mobile Location | Web Location |
|-------|----------------|--------------|
| NFL | `app/(drawer)/(tabs)/index.tsx` | `src/pages/NFL.tsx` or services |
| CFB | `app/(drawer)/(tabs)/index.tsx` | `src/pages/CFB.tsx` or services |
| NBA | `app/(drawer)/(tabs)/index.tsx` | `src/services/basketballDataService.ts` |
| NCAAB | `app/(drawer)/(tabs)/index.tsx` | `src/services/basketballDataService.ts` |

Always check the web app implementation when debugging mobile data issues.
