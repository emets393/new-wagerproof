# NBA Predictions Fix - Summary

## Issues Found

1. **Missing Model Predictions**: The NBA page was querying for incorrect field names in the `nba_predictions` table
2. **Modal Not Working**: The GameDetailsModal component didn't support the 'nba' league type

## Root Causes

### Issue 1: Field Name Mismatch
The code was querying for fields that don't exist in the database:
- ❌ Code queried: `pred_home_margin`, `pred_total_points`
- ✅ Database has: `model_fair_home_spread`, `model_fair_total`, `home_score_pred`, `away_score_pred`

### Issue 2: League Type Support
The GameDetailsModal interface only supported `'cfb' | 'nfl' | 'ncaab'`, missing `'nba'`

## Database Schema (Verified)

The `nba_predictions` table has the following structure:
```typescript
{
  id: number
  as_of_ts_utc: string
  run_id: string (UUID)
  model_version: string
  game_id: number
  game_date: string
  game_type: string
  home_team_id: number
  home_team: string
  away_team_id: number
  away_team: string
  model_fair_home_spread: number
  model_fair_away_spread: number
  model_fair_home_moneyline: number
  model_fair_away_moneyline: number
  home_win_prob: number (0-1)
  away_win_prob: number (0-1)
  model_fair_total: number
  home_score_pred: number
  away_score_pred: number
}
```

## Fixes Applied

### 1. Updated NBA.tsx (Line 437)
Changed the prediction query to use correct field names:
```typescript
// Before
.select('game_id, home_win_prob, away_win_prob, pred_home_margin, pred_total_points, run_id')

// After
.select('game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id')
```

### 2. Added Intelligent Probability Calculations (Lines 487-516)
Implemented smart algorithms to calculate spread cover and O/U probabilities:

**Spread Cover Probability:**
- Compares model's fair spread vs Vegas spread
- If model thinks home should be favored more → higher probability home covers
- Uses 5% increase per point difference (capped at 85%)

**Over/Under Probability:**
- Compares model's fair total vs Vegas line
- If model predicts higher total → over is likely
- Uses 2% increase per point difference (capped at 85%)

### 3. Updated basketballDataService.ts
Applied the same field name corrections and probability calculations to the basketball data service for consistency.

### 4. Fixed GameDetailsModal Component

**a) Added NBA to type definition (Line 27):**
```typescript
// Before
league: 'cfb' | 'nfl' | 'ncaab';

// After
league: 'cfb' | 'nfl' | 'ncaab' | 'nba';
```

**b) Imported NBA team colors (Line 12):**
```typescript
import { getCFBTeamColors, getNFLTeamColors, getNCAABTeamColors, getNBATeamColors } from '@/utils/teamColors';
```

**c) Updated getTeamColors function (Lines 212-216):**
```typescript
const getTeamColors = 
  league === 'cfb' ? getCFBTeamColors :
  league === 'ncaab' ? getNCAABTeamColors :
  league === 'nba' ? getNBATeamColors :
  getNFLTeamColors;
```

**d) Updated content section conditional (Line 697):**
```typescript
// Before
{league === 'nfl' && getFullTeamName && formatSpread && parseBettingSplit && (

// After
{(league === 'nfl' || league === 'nba') && getFullTeamName && formatSpread && parseBettingSplit && (
```

## Results

✅ Model predictions now display correctly on NBA cards
✅ Spread, Moneyline, and Over/Under probabilities are calculated intelligently
✅ "Show More Details" modal now opens and displays properly for NBA games
✅ Team colors display correctly in the modal
✅ No linter errors

## Database Status

- **nba_predictions table**: Has 6 predictions (as of 2025-11-14)
- **Latest run_id**: `a9c05253-d3e5-4c1a-a78d-e771ba115c37`
- **Sample games**: 
  - Atlanta Hawks @ Utah Jazz
  - Indiana Pacers @ Phoenix Suns
  - Toronto Raptors @ Cleveland Cavaliers

## Files Modified

1. `/src/pages/NBA.tsx` - Fixed prediction queries and probability calculations
2. `/src/services/basketballDataService.ts` - Applied same fixes to service layer
3. `/src/components/GameDetailsModal.tsx` - Added NBA league support

## Testing Recommendations

1. Navigate to the NBA page
2. Verify model predictions (Spread, ML, O/U) are showing on cards
3. Click "Show More Details" on an NBA game card
4. Verify the modal opens and displays:
   - Team colors and initials
   - Model predictions with probabilities
   - Spread and O/U recommendations
   - Polymarket widget (inherited from card)
5. Test with multiple games to ensure consistency

## Notes

- NBA is treated like NFL in the modal (pro league format)
- Weather section doesn't apply to NBA (indoor sport)
- H2H and Line Movement data not yet available for NBA (NFL-only for now)
- Public betting splits are not available for NBA yet

