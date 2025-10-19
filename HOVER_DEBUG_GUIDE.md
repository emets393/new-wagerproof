# Hover Card Debug Guide

## What I Just Fixed

1. **Added `cursor-pointer`** to the card to indicate it's interactive
2. **Added `!overflow-visible`** to the Marquee component (the `!` forces it to override)
3. **Added a small ⭐ star icon** on cards that have predictions (so you can see which ones should be hoverable)
4. **Set z-index to 100** on the HoverCard content
5. **Killed the old dev server** and started fresh with all changes

## How to Test Now

1. **Open your browser** to `http://localhost:8080`
2. **Hard refresh** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) to clear cache
3. **Look at the live score ticker** at the top (if there are live games)
4. **Check for ⭐ stars** - cards with a tiny star have predictions and should be hoverable

## What to Look For

### In the Browser Console:
```
🏈 Live Score Ticker: X games, Y with predictions, Z with hitting predictions
Fetched X NFL predictions with lines
✅ Matched NFL game: [teams]
📊 Prediction status: {...}
```

### Visual Indicators:
- **Green pulsing border** = predictions are currently hitting
- **Tiny ⭐ star** = has predictions (should show hover card)
- **Normal border** = no predictions or not hitting

### When You Hover:
- **Cursor should change to pointer** when over a card with predictions
- **Card should expand below** showing detailed prediction info
- **Should see team circles, scores, and bet types** with checkmarks/X marks

## If Hover Still Doesn't Work

### Try These Tests:

1. **Check if HoverCard renders at all:**
   - Right-click on a card with a star → Inspect
   - Look for `[data-radix-hover-card-trigger]` attribute
   - If not there, the HoverCard isn't rendering

2. **Check for overflow clipping:**
   - Inspect the parent elements
   - Look for `overflow: hidden` in the computed styles
   - Should be `overflow: visible` on ticker and marquee

3. **Check z-index stacking:**
   - When you hover, look in Elements inspector
   - Search for "hover-card" or "popover"
   - Check if it's being created but hidden behind something

4. **Test with a simple hover:**
   - Try changing `openDelay` from 200 to 0
   - Try hovering and holding for 2+ seconds
   - Move mouse slowly onto the card

## Manual Testing Code

If needed, add this to LiveScoreCard.tsx temporarily:

```tsx
// Add after line 26 (after hasPredictions definition):
console.log('Card render:', {
  gameId: game.id,
  teams: `${game.away_abbr} @ ${game.home_abbr}`,
  hasPredictions,
  hasHitting: hasHittingPredictions
});
```

## Alternative: Try Popover Instead

If HoverCard continues to have issues, we can switch to a Popover with hover trigger. Let me know and I can make that change.

## Common Radix Issues

- **Portal rendering**: HoverCard might render in a portal, check document.body for `[data-radix-portal]`
- **Focus issues**: If the marquee animation interferes, we can add `pauseOnHover` behavior
- **Pointer events**: Make sure no parent has `pointer-events: none`

