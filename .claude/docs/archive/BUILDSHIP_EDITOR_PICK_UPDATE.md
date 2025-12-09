# BuildShip Editor's Pick Discord Integration - Update Summary

## Changes Made

### 1. ✅ Basketball Support Added
The function now supports all four sports with proper emojis and labels:

```javascript
const configs = {
  'nfl': { emoji: '🏈', label: 'NFL' },
  'cfb': { emoji: '🏈', label: 'College Football' },
  'nba': { emoji: '🏀', label: 'NBA' },
  'ncaab': { emoji: '🏀', label: 'College Basketball' }
};
```

**Result:**
- NBA picks show: 🏀 NEW EDITOR'S PICK with "NBA" in footer
- NCAAB picks show: 🏀 NEW EDITOR'S PICK with "College Basketball" in footer

### 2. ✅ Smart Logo Display
Logos now display based on the bet selection:

**Away Team Bets** (`spread_away` or `ml_away`):
- Large image: Away team logo
- Small thumbnail: Home team logo

**Home Team Bets** (`spread_home` or `ml_home`):
- Large image: Home team logo  
- Small thumbnail: Away team logo

**Over/Under Bets** (`over` or `under`):
- Large image: Home team logo
- Small thumbnail: Away team logo
- Both shown equally

**How it works:**
```javascript
const getLogoConfig = (selectedBetTypes, gameData) => {
  const firstBet = selectedBetTypes[0];
  
  // Away team bets -> show away logo large
  if (firstBet === 'spread_away' || firstBet === 'ml_away') {
    return {
      thumbnail: { url: gameData.homeLogo },
      image: { url: gameData.awayLogo }  // Large
    };
  }
  
  // Home team bets -> show home logo large
  if (firstBet === 'spread_home' || firstBet === 'ml_home') {
    return {
      thumbnail: { url: gameData.awayLogo },
      image: { url: gameData.homeLogo }  // Large
    };
  }
  
  // Over/under -> show both equally
  // ...
}
```

## Discord Embed Structure

The Discord message now includes:

```
[Basketball/Football Emoji] NEW EDITOR'S PICK

[Small Logo]                Away Team @ Home Team

📅 Game Time
Sat, Nov 16 at 7:00 PM EST

🎲 Pick(s)
🎯 Spread: Lakers -5.5
📈 Over 225.5

📊 Analysis
Lakers have been dominant at home...

[Large Logo - Based on Pick]

WagerBot • Editor's Pick • NBA | [Timestamp]
```

## Examples

### Example 1: NBA Home Team Pick
```javascript
pickData: {
  gameType: 'nba',
  selectedBetTypes: ['spread_home', 'over']
}
```
**Result:**
- Title: "🏀 NEW EDITOR'S PICK"
- Footer: "WagerBot • Editor's Pick • NBA"
- Large logo: Home team (Lakers)
- Small logo: Away team (Warriors)

### Example 2: NCAAB Away Team Pick
```javascript
pickData: {
  gameType: 'ncaab',
  selectedBetTypes: ['ml_away']
}
```
**Result:**
- Title: "🏀 NEW EDITOR'S PICK"
- Footer: "WagerBot • Editor's Pick • College Basketball"
- Large logo: Away team (Duke)
- Small logo: Home team (UNC)

### Example 3: NFL Over/Under Pick
```javascript
pickData: {
  gameType: 'nfl',
  selectedBetTypes: ['over']
}
```
**Result:**
- Title: "🏈 NEW EDITOR'S PICK"
- Footer: "WagerBot • Editor's Pick • NFL"
- Large logo: Home team
- Small logo: Away team
- Both shown to indicate it's a totals bet

## Deployment to BuildShip

1. **Copy the updated code** from `BUILDSHIP_DISCORD_MESSAGE_SEND_EDITORS_PICK`

2. **Go to BuildShip** and navigate to the workflow:
   - Endpoint: `https://xna68l.buildship.run/discord-editor-pick-post`

3. **Paste the updated code** into the Node.js function

4. **Configure inputs** (should already be set):
   - `pickData` (object)
   - `gameData` (object)
   - `channelId` (string)
   - `botToken` (secret)

5. **Test with the test file**: Open `test-discord-basketball-picks.html` and test all sports

## Testing Checklist

- [ ] NBA pick with home team bet → Shows home logo large
- [ ] NBA pick with away team bet → Shows away logo large
- [ ] NCAAB pick with home team bet → Shows home logo large
- [ ] NCAAB pick with away team bet → Shows away logo large
- [ ] NFL pick with over/under → Shows both logos
- [ ] All picks show correct sport emoji (🏀 for basketball, 🏈 for football)
- [ ] All picks show correct sport label in footer

## Visual Comparison

### Before:
```
NEW EDITOR'S PICK
Away Team @ Home Team
[Small: Away logo]
[Large: Home logo]
Footer: WagerBot • Editor's Pick • NFL
```

### After:
```
🏀 NEW EDITOR'S PICK (basketball emoji for NBA/NCAAB)
Away Team @ Home Team
[Small: Non-picked team logo]
[Large: Picked team logo]
Footer: WagerBot • Editor's Pick • NBA
```

## Complete Feature Set

✅ **All Four Sports Supported:**
- NFL (🏈 NFL)
- College Football (🏈 College Football)
- NBA (🏀 NBA)
- College Basketball (🏀 College Basketball)

✅ **Smart Logo Display:**
- Shows the team being bet on prominently
- Shows both logos for over/under bets
- Automatically adjusts based on bet type

✅ **Dynamic Embed Colors:**
- Uses team colors from the picked team
- Matches team branding

✅ **Comprehensive Bet Display:**
- Spread (home/away)
- Moneyline (home/away)
- Over/Under
- Supports multiple picks in one message

---

**Status:** Ready for deployment to BuildShip
**Impact:** NBA and NCAAB editor's picks will now post correctly to Discord with appropriate branding and logos

