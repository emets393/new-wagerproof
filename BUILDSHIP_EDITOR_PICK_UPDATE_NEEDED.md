# BuildShip Workflow Update Required

## Issue
The current Discord webhook for Editor Picks is showing the bet type (e.g., "spread") instead of the actual pick value (e.g., "Giants +3.5").

## Current Behavior
The workflow uses `formatBetType()` to display picks, which formats based on `selectedBetTypes` array:
```javascript
const formattedBets = pickData.selectedBetTypes
  .map(bet => formatBetType(bet, gameData))
  .join('\n');
```

This displays: "🎯 Spread: **New England** +3.5"

## Desired Behavior
When `pickData.pickValue` is present, show that instead of the formatted bet type.

## Required BuildShip Workflow Update

In the `discord-editor-pick-post` workflow, update the Pick(s) field logic:

```javascript
// OLD CODE (lines 115-118):
const formattedBets = pickData.selectedBetTypes
  .map(bet => formatBetType(bet, gameData))
  .join('\n');

// NEW CODE:
const formattedBets = pickData.pickValue 
  ? `🎯 **${pickData.pickValue}**${pickData.bestPrice ? ` @ ${pickData.bestPrice}` : ''}${pickData.sportsbook ? ` (${pickData.sportsbook})` : ''}${pickData.units ? ` - ${pickData.units} unit${pickData.units !== 1 ? 's' : ''}` : ''}`
  : pickData.selectedBetTypes
      .map(bet => formatBetType(bet, gameData))
      .join('\n');
```

## Example Output

### With pickValue:
```
🎲 Pick(s)
🎯 **Giants +3.5** @ -110 (FanDuel) - 2 units
```

### Without pickValue (fallback to old behavior):
```
🎲 Pick(s)
🎯 Spread: **New England** +3.5
```

## Payload Being Sent
The app is now sending these fields in `pickData`:
- `pickValue`: "Giants +3.5"
- `bestPrice`: "-110"
- `sportsbook`: "FanDuel"
- `units`: 2
- `selectedBetTypes`: ["spread"] (for fallback compatibility)

## BuildShip Workflow Location
- Workflow: `discord-editor-pick-post`
- URL: `https://xna68l.buildship.run/discord-editor-pick-post`
- File: Lines 115-118 need updating

