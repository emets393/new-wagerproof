# Game Card Data Sources Reference

## Purpose

This document serves as a comprehensive reference for understanding how the College Football and NFL pages fetch, merge, and structure data for their game cards. Use this as a guide when:

- Building AI prompts that reference game data
- Adding new sports/leagues
- Debugging data issues
- Understanding what data is available for features

## Table of Contents

1. [College Football Data Flow](#college-football-data-flow)
2. [NFL Data Flow](#nfl-data-flow)
3. [AI Payload Structure](#ai-payload-structure)
4. [Key Identifiers Reference](#key-identifiers-reference)
5. [Data Access Patterns](#data-access-patterns)
6. [Additional Data Fetches](#additional-data-fetches)

---

## College Football Data Flow

**Source File:** `src/pages/CollegeFootball.tsx`

### Database Tables & Views

#### 1. `cfb_team_mapping` (Team Logos)
```typescript
// Lines 494-496
const { data: mappings, error: mappingsError } = await collegeFootballSupabase
  .from('cfb_team_mapping')
  .select('api, logo_light');
```

**Fields:**
- `api` - Team name as used in API
- `logo_light` - URL to team logo image

**Purpose:** Provides team logo URLs for visual display

---

#### 2. `cfb_live_weekly_inputs` (Primary Game Data)
```typescript
// Lines 508-510
const { data: preds, error: predsError } = await collegeFootballSupabase
  .from('cfb_live_weekly_inputs')
  .select('*');
```

**Contains:**
- Team names (`away_team`, `home_team`)
- Betting lines (`home_ml`, `away_ml`, `home_spread`, `away_spread`, `total_line`, `api_spread`, `api_over_line`)
- Game timing (`start_time`, `start_date`, `game_datetime`, `datetime`, `generated_at`)
- Weather data (`weather_icon_text`, `weather_temp_f`, `weather_windspeed_mph`, `temperature`, `precipitation`, `wind_speed`, `icon_code`)
- Public betting splits (`ml_splits_label`, `spread_splits_label`, `total_splits_label`)
- Model probabilities (`pred_ml_proba`, `pred_spread_proba`, `pred_total_proba`)
- Identifiers (`id`, `training_key`)
- Opening lines (`spread` - mapped to `opening_spread`)

**Purpose:** Main source for all current week CFB games

---

#### 3. `cfb_api_predictions` (Prediction Model Outputs)
```typescript
// Lines 522-524
const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
  .from('cfb_api_predictions')
  .select('*');
```

**Contains:**
- Spread predictions (`pred_spread`, `home_spread_diff`, `spread_diff`, `edge`)
- Total predictions (`pred_total`, `total_diff`, `total_edge`)
- Over/Under predictions (`pred_over_line`, `over_line_diff`)
- Score predictions (`pred_away_score`, `pred_home_score`, `pred_away_points`, `pred_home_points`, `away_points`, `home_points`)

**Purpose:** Advanced model predictions and edges for betting analysis

---

### Data Merging Logic

**Join Key:** `id` field (matches between `cfb_live_weekly_inputs` and `cfb_api_predictions`)

```typescript
// Lines 536-565
const predictionsWithWeather = (preds || []).map(prediction => {
  const apiPred = apiPreds?.find(ap => ap.id === prediction.id);
  
  return {
    ...prediction,
    // Map opening spread
    opening_spread: (prediction as any)?.spread ?? null,
    
    // Map prediction data with fallback column names
    pred_spread: apiPred?.pred_spread || apiPred?.run_line_prediction || apiPred?.spread_prediction || null,
    home_spread_diff: apiPred?.home_spread_diff || apiPred?.spread_diff || apiPred?.edge || null,
    pred_total: apiPred?.pred_total || apiPred?.total_prediction || apiPred?.ou_prediction || null,
    total_diff: apiPred?.total_diff || apiPred?.total_edge || null,
    pred_over_line: apiPred?.pred_over_line ?? null,
    over_line_diff: apiPred?.over_line_diff ?? null,
    
    // Score predictions with multiple fallbacks
    pred_away_score: apiPred?.pred_away_score ?? (apiPred as any)?.away_points ?? (prediction as any)?.pred_away_score ?? null,
    pred_home_score: apiPred?.pred_home_score ?? (apiPred as any)?.home_points ?? (prediction as any)?.pred_home_score ?? null,
    pred_away_points: apiPred?.pred_away_points ?? (apiPred as any)?.away_points ?? null,
    pred_home_points: apiPred?.pred_home_points ?? (apiPred as any)?.home_points ?? null
  };
});
```

**Key Features:**
- Multiple fallback column names (handles schema variations)
- Preserves all fields from base table
- Adds prediction fields as nullable extras

---

### CFBPrediction Interface

**Full Type Definition** (lines 32-84):

```typescript
interface CFBPrediction {
  // Identifiers
  id: string;
  training_key?: string;
  
  // Team Information
  away_team: string;
  home_team: string;
  
  // Basic Betting Lines
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  
  // Public Betting Splits
  ml_splits_label: string | null;
  spread_splits_label: string | null;
  total_splits_label: string | null;
  
  // Game Timing (multiple possible fields)
  game_date?: string;
  game_time?: string;
  start_time?: string;
  start_date?: string;
  game_datetime?: string;
  datetime?: string;
  generated_at?: string;
  
  // Alternative Line Names
  away_moneyline?: number | null;
  home_moneyline?: number | null;
  api_spread?: number | null;
  api_over_line?: number | null;
  
  // Weather Data (Direct from cfb_live_weekly_inputs)
  weather_icon_text?: string | null;
  weather_temp_f?: number | null;
  weather_windspeed_mph?: number | null;
  temperature?: number | null;
  precipitation?: number | null;
  wind_speed?: number | null;
  icon_code?: string | null;
  
  // Model Probabilities
  pred_ml_proba?: number | null;
  pred_spread_proba?: number | null;
  pred_total_proba?: number | null;
  
  // Predicted Scores
  pred_away_score?: number | null;
  pred_home_score?: number | null;
  pred_away_points?: number | null;
  pred_home_points?: number | null;
  
  // Prediction Analysis (from cfb_api_predictions)
  pred_spread?: number | null;
  home_spread_diff?: number | null;
  pred_total?: number | null;
  total_diff?: number | null;
  pred_over_line?: number | null;
  over_line_diff?: number | null;
  
  // Opening Lines
  opening_spread?: number | null;
}
```

---

## NFL Data Flow

**Source File:** `src/pages/NFL.tsx`

### Database Tables & Views

#### 1. `v_input_values_with_epa` (Primary Game Data View)
```typescript
// Lines 413-417
const { data: nflGames, error: gamesError } = await collegeFootballSupabase
  .from('v_input_values_with_epa')
  .select('*')
  .order('game_date', { ascending: true })
  .order('game_time', { ascending: true });
```

**Contains:**
- Team names (`away_team`, `home_team`)
- Basic lines (`home_spread`, `away_spread`, `ou_vegas_line`)
- Game timing (`game_date`, `game_time`)
- Key identifier (`home_away_unique` - used as `training_key`)
- Weather fields (some, with fallbacks to other tables)

**Purpose:** View that automatically updates for current week games

---

#### 2. `nfl_predictions_epa` (EPA Model Predictions)
```typescript
// Lines 430-444
// First, get latest run_id
const { data: latestRun, error: runError } = await collegeFootballSupabase
  .from('nfl_predictions_epa')
  .select('run_id')
  .order('run_id', { ascending: false })
  .limit(1)
  .single();

// Then fetch predictions for that run
const { data: predictions, error: predsError } = await collegeFootballSupabase
  .from('nfl_predictions_epa')
  .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id')
  .eq('run_id', latestRun.run_id);
```

**Fields:**
- `training_key` - Join key (matches `home_away_unique` from view)
- `home_away_ml_prob` - Probability for moneyline prediction
- `home_away_spread_cover_prob` - Probability for spread prediction
- `ou_result_prob` - Probability for over/under prediction
- `run_id` - Prediction batch identifier

**Purpose:** EPA-based model predictions for NFL games

---

#### 3. `nfl_betting_lines` (Moneylines & Public Splits)
```typescript
// Lines 460-463
const { data: bettingLines, error: bettingError } = await collegeFootballSupabase
  .from('nfl_betting_lines')
  .select('training_key, home_ml, away_ml, over_line, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts')
  .order('as_of_ts', { ascending: false });
```

**Fields:**
- `training_key` - Join key
- `home_ml`, `away_ml` - Moneyline odds
- `over_line` - Total line
- `spread_splits_label` - Public betting on spread (formatted text)
- `ml_splits_label` - Public betting on moneyline (formatted text)
- `total_splits_label` - Public betting on total (formatted text)
- `as_of_ts` - Timestamp for line

**Logic:** Gets most recent line per `training_key` using Map

---

#### 4. `nfl_team_mapping` (Team Information)
```typescript
// Lines 481-489
const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
  .from('nfl_team_mapping')
  .select('city_and_name, team_name');
```

**Fields:**
- `city_and_name` - Full team name
- `team_name` - Team city (e.g., "Dallas", "Buffalo")
- `logo_url` - Generated via `getNFLTeamLogo()` function

---

#### 5. `production_weather` (Weather Fallback)
```typescript
// Lines 499-515
const { data: weatherData, error: weatherError } = await collegeFootballSupabase
  .from('production_weather')
  .select('*');
```

**Fields:**
- `training_key` - Join key
- `temperature` - Temperature in Fahrenheit
- `precipitation_pct` - Precipitation percentage
- `wind_speed` - Wind speed in mph
- `icon` - Weather icon code

**Purpose:** Fallback weather source if not in main view

---

### Data Merging Logic

**Join Key:** `home_away_unique` from `v_input_values_with_epa` = `training_key` in all other tables

```typescript
// Lines 519-548
// Create Maps for efficient lookup
const predictionsMap = new Map();
predictions.forEach(pred => {
  predictionsMap.set(pred.training_key, pred);
});

const bettingLinesMap = new Map();
bettingLines.forEach(line => {
  if (!bettingLinesMap.has(line.training_key)) {
    bettingLinesMap.set(line.training_key, line);
  }
});

const weatherMap = new Map();
weatherData.forEach(weather => {
  if (weather.training_key) {
    weatherMap.set(weather.training_key, weather);
  }
});

// Merge all data
const predictionsWithData = (nflGames || []).map((game) => {
  const prediction = predictionsMap.get(game.home_away_unique);
  const bettingLine = bettingLinesMap.get(game.home_away_unique);
  const weather = weatherMap.get(game.home_away_unique);
  
  return {
    ...game,
    id: game.home_away_unique || `${game.home_team}_${game.away_team}_${game.game_date}`,
    training_key: game.home_away_unique,
    unique_id: game.home_away_unique,
    
    // Add prediction probabilities
    home_away_ml_prob: prediction?.home_away_ml_prob || null,
    home_away_spread_cover_prob: prediction?.home_away_spread_cover_prob || null,
    ou_result_prob: prediction?.ou_result_prob || null,
    run_id: prediction?.run_id || null,
    
    // Add Vegas lines from betting_lines
    home_ml: bettingLine?.home_ml || null,
    away_ml: bettingLine?.away_ml || null,
    over_line: bettingLine?.over_line || game.ou_vegas_line || null,
    
    // Add public betting splits
    spread_splits_label: bettingLine?.spread_splits_label || null,
    ml_splits_label: bettingLine?.ml_splits_label || null,
    total_splits_label: bettingLine?.total_splits_label || null,
    
    // Add weather with fallback priority
    temperature: game.temperature || game.weather_temp || weather?.temperature || null,
    precipitation: game.precipitation_pct || weather?.precipitation_pct || null,
    wind_speed: game.wind_speed || game.weather_wind || weather?.wind_speed || null,
    icon: game.icon || game.weather_icon || weather?.icon || null,
  };
});
```

**Key Features:**
- Uses Map for O(1) lookup performance
- Takes most recent betting line per game
- Fallback chain for weather data (view → production_weather table)
- All games shown even without predictions

---

### NFLPrediction Interface

**Full Type Definition** (lines 38-65):

```typescript
interface NFLPrediction {
  // Identifiers
  id: string;
  training_key: string;
  unique_id: string;
  
  // Team Information
  away_team: string;
  home_team: string;
  
  // Betting Lines
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  
  // Game Timing
  game_date: string;
  game_time: string;
  
  // Model Predictions (EPA Model)
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  
  // Weather Data
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  icon: string | null;
  
  // Public Betting Splits
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
}
```

---

## AI Payload Structure

**Source File:** `src/components/AIPayloadViewer.tsx`

### How Payloads Are Built

```typescript
// Lines 98-99
const spreadPayload = buildGameDataPayload(game, sportType, 'spread_prediction', polymarketData);
const ouPayload = buildGameDataPayload(game, sportType, 'ou_prediction', polymarketData);
```

**Function:** `buildGameDataPayload()` from `src/services/aiCompletionService.ts`

### Payload Components

The payload sent to GPT includes:

1. **Game Basic Info**
   - Teams (away_team, home_team)
   - Date/Time
   - Identifiers (training_key, id)

2. **Betting Lines**
   - Moneylines (home_ml, away_ml)
   - Spreads (home_spread, away_spread, opening_spread for CFB)
   - Totals (over_line, total_line)

3. **Model Predictions**
   - **CFB:** pred_ml_proba, pred_spread_proba, pred_total_proba, pred_away_score, pred_home_score, home_spread_diff, over_line_diff
   - **NFL:** home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob

4. **Weather Data**
   - Temperature, wind speed, precipitation
   - Weather icon/description

5. **Public Betting Splits**
   - ml_splits_label
   - spread_splits_label
   - total_splits_label

6. **Polymarket Data** (if available)
   - Market odds from prediction market
   - Volume and liquidity info
   - Fetched via `getAllMarketsData()` from `src/services/polymarketService.ts`

### Widget Types

- `spread_prediction` - Focus on spread analysis
- `ou_prediction` - Focus on over/under analysis

Both use the same game data but different system prompts for context.

---

## Key Identifiers Reference

Understanding which fields join data across tables:

| Sport | Context | Field Name | Source | Used For |
|-------|---------|-----------|---------|----------|
| CFB | Primary key | `id` | cfb_live_weekly_inputs | Joining predictions to games |
| CFB | Game identifier | `training_key` | cfb_live_weekly_inputs | AI completions, Value Finds, game tracking |
| NFL | Primary key | `home_away_unique` | v_input_values_with_epa | Joining all data (becomes training_key) |
| NFL | Game identifier | `training_key` | Derived from home_away_unique | AI completions, betting lines, weather |
| NFL | Alternative ID | `unique_id` | Copy of training_key | Fallback identifier |

### Usage Examples

**CFB - Finding AI completion:**
```typescript
const gameId = prediction.training_key || prediction.id;
const completions = await getGameCompletions(gameId, 'cfb');
```

**NFL - Fetching game tail data:**
```typescript
const gameId = prediction.training_key || prediction.unique_id;
// Use gameId for database queries
```

---

## Data Access Patterns

### 1. Weather Data (Fallback Pattern)

**CFB - Direct from main table:**
```typescript
// Lines 1460-1467 in CollegeFootball.tsx
{(prediction.weather_icon_text || prediction.temperature !== null || prediction.wind_speed !== null || prediction.icon_code) && (
  <WeatherPill 
    iconText={(prediction as any).weather_icon_text}
    tempF={(prediction as any).weather_temp_f ?? prediction.temperature}
    windMph={(prediction as any).weather_windspeed_mph ?? prediction.wind_speed}
    fallbackIcon={prediction.icon_code}
  />
)}
```

**NFL - Cascading fallbacks:**
```typescript
// Lines 543-546 in NFL.tsx
temperature: game.temperature || game.weather_temp || weather?.temperature || null,
precipitation: game.precipitation_pct || weather?.precipitation_pct || null,
wind_speed: game.wind_speed || game.weather_wind || weather?.wind_speed || null,
icon: game.icon || game.weather_icon || weather?.icon || null,
```

### 2. Prediction Probabilities Display

NFL uses a "max of p or 1-p" pattern for display:

```typescript
// Lines 171-182 in NFL.tsx
const getDisplayedMlProb = (p: number | null): number | null => {
  if (p === null || p === undefined) return null;
  return p >= 0.5 ? p : 1 - p;
};

const getDisplayedSpreadProb = (p: number | null): number | null => {
  if (p === null || p === undefined) return null;
  return p >= 0.5 ? p : 1 - p;
};

const getDisplayedOuProb = (p: number | null): number | null => {
  if (p === null || p === undefined) return null;
  return p >= 0.5 ? p : 1 - p;
};
```

**Why:** Always shows the higher confidence side (e.g., 65% instead of 35%)

### 3. Team Colors Mapping

**CFB - Hardcoded color maps:**
```typescript
// Lines 685-832 in CollegeFootball.tsx
const getCFBTeamColors = (teamName: string): { primary: string; secondary: string } => {
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    'Alabama': { primary: '#9E1B32', secondary: '#FFFFFF' },
    'Auburn': { primary: '#0C2340', secondary: '#E87722' },
    // ... 100+ teams
  };
  return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
};
```

**NFL - Hardcoded color maps:**
```typescript
// Lines 701-739 in NFL.tsx
const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } => {
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    'Arizona': { primary: '#97233F', secondary: '#000000' },
    'Atlanta': { primary: '#A71930', secondary: '#000000' },
    // ... 32 teams
  };
  return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
};
```

**Pattern:** Both use team name (not city) as key, with gray fallback

### 4. Betting Splits Parsing

NFL has a utility function to parse split labels:

```typescript
// Lines 357-396 in NFL.tsx
const parseBettingSplit = (label: string | null): { 
  team: string; 
  percentage: number; 
  isSharp: boolean; 
  isPublic: boolean;
  direction?: string; // For totals: "over" or "under"
} | null => {
  if (!label) return null;
  
  const lowerLabel = label.toLowerCase();
  
  // Extract percentage
  const percentMatch = label.match(/(\d+)%/);
  const percentage = percentMatch ? parseInt(percentMatch[1]) : 50;
  
  // Determine if sharp or public
  const isSharp = lowerLabel.includes('sharp');
  const isPublic = lowerLabel.includes('public');
  
  // Extract team name or direction
  let team = '';
  let direction = undefined;
  
  if (lowerLabel.includes('over')) {
    direction = 'over';
    team = 'Over';
  } else if (lowerLabel.includes('under')) {
    direction = 'under';
    team = 'Under';
  } else {
    const teamMatch = label.match(/on\s+([A-Za-z\s]+?)(?:\s*\(|$)/);
    if (teamMatch) {
      team = teamMatch[1].trim();
    }
  }
  
  return { team, percentage, isSharp, isPublic, direction };
};
```

**Input Examples:**
- `"65% sharp money on Cowboys"`
- `"78% public bets on Over"`
- `"52% consensus on Patriots spread"`

---

## Additional Data Fetches

Beyond game card data, these pages fetch additional information:

### 1. AI Completions

**Service:** `getGameCompletions()` from `src/services/aiCompletionService.ts`

**CFB Implementation (lines 583-608):**
```typescript
const fetchAICompletions = async (games: CFBPrediction[]) => {
  // Check if completions are enabled
  if (!areCompletionsEnabled('cfb')) {
    setAiCompletions({});
    return;
  }
  
  const completionsMap: Record<string, Record<string, string>> = {};
  
  for (const game of games) {
    const gameId = game.training_key || game.id || `${game.away_team}_${game.home_team}`;
    try {
      const completions = await getGameCompletions(gameId, 'cfb');
      if (Object.keys(completions).length > 0) {
        completionsMap[gameId] = completions;
      }
    } catch (error) {
      debug.error(`Error fetching completions for ${gameId}:`, error);
    }
  }
  
  setAiCompletions(completionsMap);
};
```

**NFL Implementation (lines 562-588):**
```typescript
const fetchAICompletions = async (games: NFLPrediction[]) => {
  if (!areCompletionsEnabled('nfl')) {
    setAiCompletions({});
    return;
  }
  
  const completionsMap: Record<string, Record<string, string>> = {};
  
  for (const game of games) {
    const gameId = game.training_key || game.unique_id;
    try {
      const completions = await getGameCompletions(gameId, 'nfl');
      if (Object.keys(completions).length > 0) {
        completionsMap[gameId] = completions;
      }
    } catch (error) {
      debug.error(`Error fetching completions for ${gameId}:`, error);
    }
  }
  
  setAiCompletions(completionsMap);
};
```

**Returns:** Object with widget types as keys (e.g., `{ spread_prediction: "text", ou_prediction: "text" }`)

### 2. High Value Badges

**Service:** `getHighValueBadges()` from `src/services/aiCompletionService.ts`

**CFB Implementation (lines 648-675):**
```typescript
const fetchValueFinds = async () => {
  try {
    const [badges, headerData] = await Promise.all([
      getHighValueBadges('cfb'),
      getPageHeaderData('cfb', adminModeEnabled),
    ]);

    // Convert badges array to Map for easy lookup
    const badgesMap = new Map();
    badges.forEach(badge => {
      badgesMap.set(badge.game_id, badge);
    });
    
    setHighValueBadges(badgesMap);
    // ... more code
  } catch (error) {
    debug.error('Error fetching value finds:', error);
  }
};
```

**NFL Implementation (lines 141-168):**
```typescript
const fetchValueFinds = async () => {
  try {
    const [badges, headerData] = await Promise.all([
      getHighValueBadges('nfl'),
      getPageHeaderData('nfl', adminModeEnabled),
    ]);

    const badgesMap = new Map();
    badges.forEach(badge => {
      badgesMap.set(badge.game_id, badge);
    });
    
    setHighValueBadges(badgesMap);
    // ... more code
  } catch (error) {
    debug.error('Error fetching value finds:', error);
  }
};
```

**Badge Structure:**
```typescript
{
  game_id: string;
  recommended_pick: string;  // e.g., "Alabama -7"
  confidence: "high" | "medium" | "low";
  tooltip_text: string;      // Explanation
}
```

### 3. Page Header Data (Value Finds Summary)

**Service:** `getPageHeaderData()` from `src/services/aiCompletionService.ts`

**Returns:**
```typescript
{
  data: {
    summary_text: string;        // e.g., "3 high-value opportunities this week"
    compact_picks: Array<{       // Quick picks for header display
      game: string;
      pick: string;
      confidence: string;
    }>;
  };
  id: string;                    // Value find record ID
  published: boolean;            // Publication status
}
```

**Refresh Pattern:** Both pages refresh value finds every 30 seconds + on tab visibility change

### 4. Polymarket Data

**Source:** `AIPayloadViewer.tsx` (lines 57-69)

```typescript
const fetchPolymarketData = async () => {
  setLoadingPolymarket(true);
  try {
    const data = await getAllMarketsData(game.away_team, game.home_team, sportType);
    setPolymarketData(data);
  } catch (error) {
    debug.error('Error fetching Polymarket data:', error);
    setPolymarketData(null);
  } finally {
    setLoadingPolymarket(false);
  }
};
```

**Service:** `getAllMarketsData()` from `src/services/polymarketService.ts`

**Purpose:** Fetches prediction market data to include in AI payloads for comparison with traditional sportsbook odds

---

## Summary

### CFB Data Flow
1. Fetch team mappings
2. Fetch all games from `cfb_live_weekly_inputs`
3. Fetch predictions from `cfb_api_predictions`
4. Join on `id` field
5. Map multiple column name variations
6. Fetch AI completions and value finds separately

### NFL Data Flow
1. Fetch all current week games from `v_input_values_with_epa`
2. Fetch latest predictions from `nfl_predictions_epa`
3. Fetch betting lines from `nfl_betting_lines`
4. Fetch weather from `production_weather`
5. Join all data on `home_away_unique`/`training_key`
6. Apply fallback logic for weather fields
7. Fetch AI completions and value finds separately

### Key Differences
- **CFB:** Simple join on `id`, all data in 2 main tables
- **NFL:** Complex multi-table merge on `training_key`, uses database view
- **CFB:** More prediction detail (scores, edges)
- **NFL:** Focus on probabilities from EPA model

### For AI Prompts
When referencing game data in prompts, you can assume access to:
- All betting lines (ML, spread, total)
- Model predictions (probabilities or edges depending on sport)
- Weather conditions
- Public betting splits
- Team information
- Polymarket comparison data (when explicitly fetched)

This structure ensures consistent, comprehensive data for analysis and recommendations.

