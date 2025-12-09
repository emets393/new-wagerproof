# CFB Mobile Card - Web Parity Update

## Summary
Updated the CFB mobile game cards' expanded state to match the exact layout and data presentation from the web version.

## Changes Made

### 1. **Three-Column Layout for Predictions**
Replaced the previous two-column grid (Team + Confidence) with a three-column layout matching the web:
- **Column 1**: Team logo (for spread) or arrow indicator (for O/U)
- **Column 2**: Edge value with label ("Edge to [Team/Over/Under]")
- **Column 3**: Model prediction with label ("Model Spread" or "Model O/U")

### 2. **Spread Prediction Section**
Now displays:
```
[Team Logo]  |  Edge to [Team]  |  Model Spread
              |      4.5        |      -1.5
```
- Shows the team with the edge (determined by `home_spread_diff`)
- Displays edge magnitude from `home_spread_diff` field
- Shows model's predicted spread from `pred_spread` field (adjusted for team)
- Calculation matches web: if edge is to away team, model spread is flipped

### 3. **Over/Under Prediction Section**
Now displays:
```
[▲/▼ Arrow]  |  Edge to [Over/Under]  |  Model O/U
   Over      |         0.5            |     49
```
- Shows up arrow (▲) for Over or down arrow (▼) for Under
- Displays edge magnitude from `over_line_diff` field
- Shows model's predicted total from `pred_over_line` field

### 4. **Updated Styling**
Added new styles to match web appearance:
- `predictionCard`: Card container with border and shadow
- `threeColumnGrid`: Flex layout for three columns
- `logoColumn`: Fixed width column for logo/arrow (60px)
- `valueColumn`: Flexible columns for edge and model values
- `valueLabel`: Small label text (10px)
- `valueLarge`: Large value text (24px, bold)
- `teamCircleMedium`: Medium-sized team circle (50px)
- `arrowContainer`, `arrowIcon`, `arrowLabel`: Arrow indicator styling

### 5. **Updated Conditional Rendering**
- Predictions now check for `home_spread_diff` and `over_line_diff` directly (not just probabilities)
- This ensures predictions display when edge data is available, matching web behavior

### 6. **Updated Explanations**
Revised "What This Means" text to match web version's explanatory style:
- **Spread**: Emphasizes the edge value and what it means relative to Vegas line
- **O/U**: Explains edge direction and magnitude with context

## Technical Details

### Data Fields Used
- `game.home_spread_diff`: Edge value for spread (positive = home edge, negative = away edge)
- `game.over_line_diff`: Edge value for O/U (positive = over, negative = under)
- `game.pred_spread`: Model's predicted spread value
- `game.pred_over_line`: Model's predicted total value

### Layout Structure
```tsx
<View style={predictionCard}>
  <View style={predictionHeader}>Icon + Label</View>
  <View style={threeColumnGrid}>
    <View style={logoColumn}>Team Circle or Arrow</View>
    <View style={valueColumn}>
      <Text style={valueLabel}>Edge to [...]</Text>
      <Text style={valueLarge}>{edgeValue}</Text>
    </View>
    <View style={valueColumn}>
      <Text style={valueLabel}>Model Spread/O/U</Text>
      <Text style={valueLarge}>{modelValue}</Text>
    </View>
  </View>
</View>
```

## Result
The mobile CFB cards now display predictions **exactly** as they appear on the web version, with:
- Team logos and arrow indicators
- Explicit edge values ("Edge to [Team/Over/Under]")
- Model spread and O/U predictions as separate, prominent numbers
- Matching layout, colors, and styling

## Files Modified
- `/wagerproof-mobile/components/CFBGameCard.tsx`
  - Updated spread prediction rendering (lines 228-297)
  - Updated O/U prediction rendering (lines 299-367)
  - Added new styles (lines 595-675)

## Date
October 22, 2025

