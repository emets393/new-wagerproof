# BuildShip Discord Editor's Pick - Logo Display Guide

## Logo Display Logic

The Discord embed uses two image fields:
- **`thumbnail`**: Small image in top-right corner
- **`image`**: Large image at bottom of embed

### Display Rules Based on Bet Type

```
┌─────────────────────────────────────────────────┐
│  BET TYPE        │  SMALL (thumbnail)  │  LARGE (image)    │
├─────────────────────────────────────────────────┤
│  spread_away     │  Home Team Logo     │  Away Team Logo   │
│  ml_away         │  Home Team Logo     │  Away Team Logo   │
├─────────────────────────────────────────────────┤
│  spread_home     │  Away Team Logo     │  Home Team Logo   │
│  ml_home         │  Away Team Logo     │  Home Team Logo   │
├─────────────────────────────────────────────────┤
│  over            │  Away Team Logo     │  Home Team Logo   │
│  under           │  Away Team Logo     │  Home Team Logo   │
└─────────────────────────────────────────────────┘
```

## Visual Examples

### Example 1: Away Team Spread Pick
```
🏀 NEW EDITOR'S PICK                    [🔵 Small: Home Logo]

Warriors @ Lakers
Sat, Nov 16 at 7:00 PM EST

🎲 Pick(s)
🎯 Spread: Warriors +5.5

📊 Analysis
Warriors have been strong on the road...

                [🟡 LARGE: WARRIORS LOGO]

WagerBot • Editor's Pick • NBA
```

### Example 2: Home Team Moneyline Pick
```
🏈 NEW EDITOR'S PICK                    [⚪ Small: Away Logo]

Chiefs @ Raiders
Sun, Nov 17 at 4:25 PM EST

🎲 Pick(s)
💰 Moneyline: Raiders +280

📊 Analysis
Raiders defense stepping up at home...

                [⚫ LARGE: RAIDERS LOGO]

WagerBot • Editor's Pick • NFL
```

### Example 3: Over/Under Pick
```
🏀 NEW EDITOR'S PICK                    [🟡 Small: Away Logo]

Duke @ North Carolina
Sat, Nov 16 at 8:00 PM EST

🎲 Pick(s)
📉 Under 145.5

📊 Analysis
Both teams have strong defense...

                [🔵 LARGE: HOME LOGO]

WagerBot • Editor's Pick • College Basketball
```

## Why This Approach?

**Before:** Always showed away team small, home team large
- ❌ Didn't emphasize the team being picked
- ❌ Made it harder to quickly identify the pick

**After:** Shows picked team large
- ✅ **Picked team is prominent** - Users instantly see which team is favored
- ✅ **Visual hierarchy** - The big logo draws attention to the pick
- ✅ **Over/under shows both** - Since it's not team-specific, both logos visible

## Sport-Specific Branding

Each sport gets its own branding:

### Football (NFL & CFB)
```
🏈 NEW EDITOR'S PICK
Footer: WagerBot • Editor's Pick • NFL
        WagerBot • Editor's Pick • College Football
```

### Basketball (NBA & NCAAB)
```
🏀 NEW EDITOR'S PICK
Footer: WagerBot • Editor's Pick • NBA
        WagerBot • Editor's Pick • College Basketball
```

## Implementation in BuildShip

The `getLogoConfig()` function handles all the logic:

```javascript
const getLogoConfig = (selectedBetTypes, gameData) => {
  const firstBet = selectedBetTypes[0];
  
  // Away team picks
  if (firstBet === 'spread_away' || firstBet === 'ml_away') {
    return {
      thumbnail: { url: gameData.homeLogo },  // Small
      image: { url: gameData.awayLogo }       // Large ✨
    };
  }
  
  // Home team picks
  if (firstBet === 'spread_home' || firstBet === 'ml_home') {
    return {
      thumbnail: { url: gameData.awayLogo },  // Small
      image: { url: gameData.homeLogo }       // Large ✨
    };
  }
  
  // Over/under picks (neutral)
  if (firstBet === 'over' || firstBet === 'under') {
    return {
      thumbnail: { url: gameData.awayLogo },  // Small
      image: { url: gameData.homeLogo }       // Large (equal)
    };
  }
};
```

## Testing Checklist

When testing the updated function, verify:

- [ ] **Away spread pick** → Away logo is LARGE
- [ ] **Home spread pick** → Home logo is LARGE
- [ ] **Away ML pick** → Away logo is LARGE
- [ ] **Home ML pick** → Home logo is LARGE
- [ ] **Over pick** → Both logos shown
- [ ] **Under pick** → Both logos shown
- [ ] **NBA picks** → Show 🏀 emoji
- [ ] **NCAAB picks** → Show 🏀 emoji and "College Basketball" label
- [ ] **NFL picks** → Show 🏈 emoji and "NFL" label
- [ ] **CFB picks** → Show 🏈 emoji and "College Football" label

## Benefits

1. **Better User Experience**
   - Users can instantly identify the pick
   - Visual emphasis matches the bet

2. **Clearer Intent**
   - Large logo = picked team
   - Small logo = opponent context

3. **Neutral for Totals**
   - Over/under shows both teams equally
   - No bias toward either team

4. **Sport Recognition**
   - Emojis help users quickly categorize picks
   - Labels provide clarity

---

**Ready to Deploy:** Copy code from `BUILDSHIP_DISCORD_MESSAGE_SEND_EDITORS_PICK` to your BuildShip workflow!

