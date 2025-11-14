# NBA/NCAAB Table Schemas

## Summary

All basketball tables are located in the **CFB Supabase project** (`https://jpxnjuwglavsjbgbasnl.supabase.co`), same as College Football data.

## Table Locations

| Table | Location | Status | Row Count |
|-------|----------|--------|-----------|
| `nba_input_values_view` | CFB Supabase | ✅ Has data | Multiple rows |
| `nba_predictions` | CFB Supabase | ⚠️ Empty | 0 rows |
| `v_cbb_input_values` | CFB Supabase | ✅ Has data | Multiple rows |
| `ncaab_predictions` | CFB Supabase | ✅ Has data | Multiple rows |

## Schema Details

### 1. `nba_input_values_view` (86 columns)

**Primary Key:** `game_id` (number)

**Key Fields:**
- **Identifiers:** `game_id`, `season`, `game_date`, `game_type`
- **Teams:** `home_team`, `away_team`, `home_abbr`, `away_abbr`, `home_team_id`, `away_team_id`
- **Betting Lines:** `home_moneyline`, `home_spread`, `total_line`
- **Date/Time:** `game_date` (YYYY-MM-DD), `tipoff_time_et` (ISO timestamp)
- **Advanced Stats:** Many `home_adj_*` and `away_adj_*` fields for offense/defense ratings, pace, trends
- **Streaks:** `home_ats_pct`, `away_ats_pct`, `home_over_pct`, `away_over_pct`, `home_win_streak`, `away_win_streak`

**Missing:**
- ❌ Public betting splits (no `*_splits_label` columns)
- ❌ Weather data (no temperature, wind, precipitation fields)
- ❌ Away moneyline (only `home_moneyline` present)

**Join Key:** `game_id` → `nba_predictions.game_id`

---

### 2. `nba_predictions` (Empty table)

**Primary Key:** `game_id` (number), likely also has `run_id` like NCAAB

**Status:** Table exists but has no data rows yet.

**Expected Structure:** Similar to `ncaab_predictions` with:
- `run_id` (UUID)
- `game_id` (number)
- Prediction probabilities
- Model outputs

---

### 3. `v_cbb_input_values` (51 columns)

**Primary Key:** `game_id` (number)

**Key Fields:**
- **Identifiers:** `game_id`, `season`, `season_type`
- **Teams:** `home_team`, `away_team`, `home_team_id`, `away_team_id`
- **Betting Lines:** `spread`, `over_under`, `homeMoneyline`, `awayMoneyline`
- **Date/Time:** `start_utc` (ISO timestamp), `start_et_local`, `game_date_et` (YYYY-MM-DD), `tipoff_time_et` (HH:MM)
- **Advanced Stats:** `home_adj_offense`, `home_adj_defense`, `home_adj_pace`, `away_adj_offense`, `away_adj_defense`, `away_adj_pace`
- **Trends:** `home_adj_offense_trend_l3`, `home_adj_defense_trend_l3`, `home_adj_pace_trend_l3` (and away equivalents)
- **Context:** `conference_game`, `neutral_site`, `home_seed`, `away_seed`, `home_ranking`, `away_ranking`

**Missing:**
- ❌ Public betting splits (no `*_splits_label` columns)
- ❌ Weather data (no temperature, wind, precipitation fields)

**Join Key:** `game_id` → `ncaab_predictions.game_id`

---

### 4. `ncaab_predictions` (32 columns)

**Primary Key:** `game_id` (number), `run_id` (UUID string)

**Key Fields:**
- **Identifiers:** `run_id` (UUID), `game_id`, `season`, `season_type`
- **Teams:** `home_team`, `away_team`, `home_team_id`, `away_team_id`
- **Vegas Lines:** `vegas_home_spread`, `vegas_total`, `vegas_home_moneyline`, `vegas_away_moneyline`
- **Predictions:**
  - `pred_home_margin` - Predicted margin for home team
  - `pred_total_points` - Predicted total points
  - `home_win_prob` - Home team win probability (0-1)
  - `away_win_prob` - Away team win probability (0-1)
  - `home_score_pred` - Predicted home team score
  - `away_score_pred` - Predicted away team score
- **Model Fair Values:**
  - `model_fair_home_spread` - Model's fair spread for home
  - `model_fair_away_spread` - Model's fair spread for away
  - `model_fair_home_moneyline` - Model's fair moneyline for home
  - `model_fair_away_moneyline` - Model's fair moneyline for away
- **Date/Time:** `start_utc`, `start_et_local`, `game_date_et`, `tipoff_time_et`
- **Metadata:** `model_version`, `as_of_ts_utc`

**Join Key:** `game_id` → `v_cbb_input_values.game_id`

---

## Data Mapping Strategy

### NBA Data Flow

```
nba_input_values_view (game_id)
    ↓
nba_predictions (game_id) [when data exists]
```

**Join Logic:**
- Use `game_id` as the primary join key
- Similar to NFL's `home_away_unique` = `training_key` pattern
- For now, `nba_predictions` is empty, so we'll only show input values

**Field Mappings:**
- `game_id` → Use as `unique_id` / `training_key` equivalent
- `home_team` / `away_team` → Direct mapping
- `home_spread` → Maps to `home_spread` (negative = home favored)
- `total_line` → Maps to `over_line` / `total_line`
- `home_moneyline` → Maps to `home_ml`
- Need to calculate `away_ml` from `home_ml` (inverse)
- `game_date` → Maps to `game_date`
- `tipoff_time_et` → Maps to `game_time`

### NCAAB Data Flow

```
v_cbb_input_values (game_id)
    ↓
ncaab_predictions (game_id, run_id)
```

**Join Logic:**
- Use `game_id` as the primary join key
- Similar to CFB's `id` join pattern
- Filter predictions by latest `run_id` (like NFL's `run_id` pattern)

**Field Mappings:**
- `game_id` → Use as `unique_id` / `training_key` equivalent
- `home_team` / `away_team` → Direct mapping
- `spread` → Maps to `home_spread` (negative = home favored)
- `over_under` → Maps to `total_line` / `api_over_line`
- `homeMoneyline` → Maps to `home_ml`
- `awayMoneyline` → Maps to `away_ml`
- `start_utc` / `start_et_local` → Maps to `game_time` / `start_time`
- `game_date_et` → Maps to `game_date`
- `home_win_prob` → Maps to `pred_ml_proba` (probability for home team)
- `pred_total_points` → Can derive over/under probability
- `pred_home_margin` → Can derive spread cover probability

---

## Missing Data Sources

### Public Betting Splits
- ❌ Not present in any basketball tables
- **Action:** May need to add separate table or API integration
- **Workaround:** Can show games without betting splits initially

### Weather Data
- ❌ Not present in any basketball tables
- **Action:** Basketball is indoor, so weather is less critical
- **Workaround:** Can omit weather widgets for basketball

### Team Logos/Mappings
- ❓ Need to check if `nba_team_mapping` or `ncaab_team_mapping` tables exist
- **Action:** Query for team mapping tables
- **Workaround:** Can use team abbreviations or generate logos from team names

---

## Implementation Notes

1. **Use CFB Supabase Client:** All basketball data is in the same project as CFB, so we can reuse `collegeFootballSupabase` client or create a shared client.

2. **ID Format:** 
   - NBA: `game_id` is a number (e.g., 18446993)
   - NCAAB: `game_id` is a number (e.g., 215343)
   - Use `game_id` as the `unique_id` / `training_key` equivalent

3. **Date/Time Handling:**
   - NBA: `game_date` (YYYY-MM-DD) + `tipoff_time_et` (ISO timestamp)
   - NCAAB: `game_date_et` (YYYY-MM-DD) + `start_utc` (ISO timestamp) or `tipoff_time_et` (HH:MM)

4. **Predictions:**
   - NBA: Table exists but empty - will need to handle gracefully
   - NCAAB: Has data with `run_id` - filter by latest `run_id` like NFL

5. **Moneyline:**
   - NBA: Only `home_moneyline` present, need to calculate `away_ml`
   - NCAAB: Both `homeMoneyline` and `awayMoneyline` present

6. **Spread:**
   - Both use negative spread = home favored (same as NFL/CFB)

7. **Total/Over-Under:**
   - NBA: `total_line`
   - NCAAB: `over_under` or `vegas_total` in predictions

---

## Next Steps

1. ✅ Query schemas - **COMPLETE**
2. ⏳ Create basketball Supabase client (or reuse CFB client)
3. ⏳ Create data fetching services for NBA/NCAAB
4. ⏳ Map fields to match NFL/CFB interface patterns
5. ⏳ Handle missing predictions gracefully (NBA)
6. ⏳ Check for team mapping tables
7. ⏳ Implement NBA/NCAAB page components

