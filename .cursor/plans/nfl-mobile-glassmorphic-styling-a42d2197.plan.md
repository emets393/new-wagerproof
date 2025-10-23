<!-- a42d2197-a2cb-49a6-9024-50e27f7df301 9b5da264-b426-4838-93f7-01f2fc87815d -->
# NFL Card Layout Refinements

## Changes to `wagerproof-mobile/components/NFLGameCard.tsx`

### 1. Enlarge @ Symbol and Add O/U Line Pill Below

**Current:** `atSymbol` fontSize is 18

**Change:** Increase to 32-46

**Add O/U Line Pill** under @ symbol:

- Simple pill with no icon
- Text: "O/U: {over_line}" (e.g., "O/U: 45.5")
- Neutral styling (gray background)
- Position: Centered below @ symbol in `centerColumn`
```tsx
<View style={styles.centerColumn}>
  <Text style={[styles.atSymbol, { color: theme.colors.outlineVariant }]}>@</Text>
  {game.over_line && (
    <View style={styles.ouLinePill}>
      <Text>O/U: {roundToNearestHalf(game.over_line)}</Text>
    </View>
  )}
</View>
```


### 2. Show Actual Lines Under Each Team

Add spread and ML values as small text directly under each team's nickname:

```tsx
<View style={styles.teamColumn}>
  {/* ...existing team circle and names... */}
  <View style={styles.teamLinesRow}>
    {game.away_spread && <Text style={styles.lineText}>{formatSpread(game.away_spread)}</Text>}
    {game.away_ml && <Text style={styles.lineText}>{formatMoneyline(game.away_ml)}</Text>}
  </View>
</View>
```

Same for home team.

### 3. Update O/U Pill to Show Model Prediction

**Current:** O/U pill shows the line (e.g., "45.5")

**Change:** Show model prediction with arrow

- Use `ou_result_prob` field
- If `ou_result_prob > 0.5`: Show "Over ↑" 
- If `ou_result_prob <= 0.5`: Show "Under ↓"
- Keep orange theme color
- Replace icon with arrow in text
```tsx
{game.ou_result_prob && (
  <View style={[styles.bettingPill, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
    <View style={styles.pillContent}>
      <Text style={styles.pillLabel}>O/U Model</Text>
      <Text style={styles.pillValue}>
        {game.ou_result_prob > 0.5 ? 'Over ↑' : 'Under ↓'}
      </Text>
    </View>
  </View>
)}
```


### 4. Debug and Restore Public Betting Pills

**Issue:** Public betting pills are not showing (lines 191-238)

**Debug steps:**

- Check if `mlSplit`, `spreadSplit`, `totalSplit` are being parsed correctly
- Verify `game.ml_splits_label`, `game.spread_splits_label`, `game.total_splits_label` have data
- Console log the values to confirm data is present
- Check if conditional `{(mlSplit || spreadSplit || totalSplit) && (...)}` is evaluating correctly

**Expected:** Pills showing "ML: Team Name", "Spread: Team Name", "Total: Over/Under"

The pills are already implemented (lines 190-238), so likely a data issue. Will verify the data is flowing correctly from `index.tsx`.

##

### To-dos

- [ ] Restyle Spread prediction widget with glassmorphic styling (borderRadius: 12, rgba backgrounds, proper spacing)
- [ ] Restyle Over/Under prediction widget with glassmorphic styling matching the pattern
- [ ] Add Weather Conditions widget in expanded state with glassmorphic styling showing temperature, wind, precipitation
- [ ] Update Public Betting widget to use glassmorphic styling instead of theme colors
- [ ] Update all StyleSheet definitions to match glassmorphic design pattern