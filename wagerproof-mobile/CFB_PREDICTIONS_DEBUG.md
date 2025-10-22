# CFB Mobile Predictions - Debugging & Fix

## Issue Reported
CFB mobile game cards in expanded mode are missing model prediction data that appears on the website.

## Root Cause Analysis

### Data Flow Investigation

1. **Data Source**: CFB predictions come from two tables:
   - `cfb_live_weekly_inputs` - Contains game info and probabilities
   - `cfb_api_predictions` - Contains edge calculations

2. **Field Mapping** (in `index.tsx`):
   ```typescript
   home_away_ml_prob: prediction.pred_ml_proba || prediction.home_away_ml_prob
   home_away_spread_cover_prob: prediction.pred_spread_proba || prediction.home_away_spread_cover_prob
   ou_result_prob: prediction.pred_total_proba || prediction.ou_result_prob
   ```

3. **CFBGameCard Conditionals**:
   ```typescript
   const spreadPrediction = game.home_away_spread_cover_prob !== null && 
                           game.home_away_spread_cover_prob !== undefined ? {...} : null
   
   const ouPrediction = game.ou_result_prob !== null && 
                       game.ou_result_prob !== undefined ? {...} : null
   ```

## Changes Made

### 1. **Added Debug Logging** ✅

Added comprehensive console logging when cards are expanded (development mode only):

```typescript
if (expanded && __DEV__) {
  console.log('CFB Game Data:', {
    gameId: game.id,
    away: game.away_team,
    home: game.home_team,
    spread_prob: game.home_away_spread_cover_prob,
    ou_prob: game.ou_result_prob,
    ml_prob: game.home_away_ml_prob,
    home_spread_diff: game.home_spread_diff,
    over_line_diff: game.over_line_diff,
    pred_away_score: game.pred_away_score,
    pred_home_score: game.pred_home_score,
    hasSpreadPred: !!spreadPrediction,
    hasOuPred: !!ouPrediction
  });
}
```

This will show in the console:
- What data is actually being received
- Whether predictions are null/undefined
- Whether prediction objects are being created

### 2. **Added "No Predictions" Message** ✅

When model data isn't available, users now see a clear message instead of an empty section:

```
ℹ️ Model predictions are not yet available for this game.
```

This appears when:
- `spreadPrediction` is null/undefined
- `ouPrediction` is null/undefined  
- No edge data exists (`home_spread_diff`, `over_line_diff`)

### 3. **Improved Conditional Rendering** ✅

Model Predictions header now only shows when there's actually data to display:

```typescript
{(spreadPrediction || ouPrediction || game.home_spread_diff || game.over_line_diff) && (
  <View style={styles.sectionHeader}>
    <Text>Model Predictions</Text>
  </View>
)}
```

## How to Diagnose the Issue

### Step 1: Check Console Logs
When you expand a CFB game card, check the console for:

```
CFB Game Data: {
  gameId: "123",
  away: "Alabama",
  home: "Georgia",
  spread_prob: 0.65,  // <-- Should see a number, not null
  ou_prob: 0.58,      // <-- Should see a number, not null
  ...
}
```

### Step 2: Possible Scenarios

#### Scenario A: Data is NULL
**Console shows:**
```
spread_prob: null
ou_prob: null
```

**Cause**: Database tables (`cfb_live_weekly_inputs` or `cfb_api_predictions`) don't have prediction data yet.

**Solution**: 
- Check if predictions have been generated for CFB games
- Verify database query in `fetchCFBData()` is pulling correct columns
- Check that `pred_ml_proba`, `pred_spread_proba`, `pred_total_proba` exist in the table

#### Scenario B: Data is UNDEFINED
**Console shows:**
```
spread_prob: undefined
ou_prob: undefined
```

**Cause**: Field names might not match between database columns and code expectations.

**Solution**:
- Verify column names in `cfb_live_weekly_inputs` table
- Check that mapping in `index.tsx` lines 176-178 is correct
- Ensure `select('*')` is pulling all columns

#### Scenario C: Data EXISTS but not rendering
**Console shows:**
```
spread_prob: 0.65
ou_prob: 0.58
hasSpreadPred: false  // <-- This shouldn't happen!
hasOuPred: false
```

**Cause**: Logic error in conditional checks.

**Solution**: This would be a code bug - the conditionals would need adjustment.

#### Scenario D: Data is Zero
**Console shows:**
```
spread_prob: 0
ou_prob: 0
```

**Cause**: Model is returning 0 confidence (edge case).

**Solution**: Update conditionals to check for `!== null && !== undefined` instead of truthy checks.

## Database Verification Query

Run this to check if CFB prediction data exists:

```sql
-- Check for prediction probabilities
SELECT 
  id,
  away_team,
  home_team,
  pred_ml_proba,
  pred_spread_proba,
  pred_total_proba,
  pred_away_score,
  pred_home_score
FROM cfb_live_weekly_inputs
WHERE pred_spread_proba IS NOT NULL
LIMIT 5;

-- Check for edge calculations
SELECT 
  id,
  home_spread_diff,
  over_line_diff,
  pred_spread,
  pred_total
FROM cfb_api_predictions
WHERE home_spread_diff IS NOT NULL
LIMIT 5;
```

## Expected Behavior

### When Predictions ARE Available:
1. Predicted Scores section shows (if `pred_away_score` and `pred_home_score` exist)
2. Model Predictions header appears
3. Spread prediction shows with:
   - Team circle and name
   - Confidence percentage
   - "What This Means" explanation
   - Edge badge (if `home_spread_diff` exists)
4. O/U prediction shows with:
   - Direction arrow (▲ Over or ▼ Under)
   - Confidence percentage
   - "What This Means" explanation
   - Edge badge (if `over_line_diff` exists)

### When Predictions NOT Available:
1. Predicted Scores section hidden
2. "Model predictions are not yet available" message shows
3. No Model Predictions header
4. No prediction boxes

## Files Modified

- **`/wagerproof-mobile/components/CFBGameCard.tsx`**
  - Added debug logging (lines 44-60)
  - Added conditional Model Predictions header (lines 199-207)
  - Added "No Predictions" message (lines 209-217)
  - Added styles: `noPredictionsBox`, `noPredictionsText`

## Testing Steps

1. **Open mobile app in development mode**
2. **Navigate to Feed tab**
3. **Switch to CFB using sport pills**
4. **Tap any CFB game card to expand**
5. **Check console output** for the debug log
6. **Look at card UI**:
   - Should see either predictions OR "not available" message
   - Should NOT see empty space where predictions should be

## Next Steps

Based on console output:
- **If data is null**: Check database/prediction generation
- **If data exists but not rendering**: Check logic (likely fixed now)
- **If data is undefined**: Check field name mapping
- **If showing "not available"**: This is expected until predictions are generated

## Comparison with NFL

NFL cards work because:
- `nfl_predictions_epa` table has data
- Field names match expectations
- Probability fields are populated

CFB should work the same way once:
- `cfb_live_weekly_inputs` has `pred_*_proba` fields populated
- `cfb_api_predictions` has edge calculations populated

