# Discord Basketball Picks Integration Fix

## Problem
NBA and College Basketball editor's picks are not being sent to Discord when published, while NFL and College Football picks work correctly.

## Root Cause Analysis

### Frontend Code Status: ✅ FIXED
The frontend code in `src/components/EditorPickCard.tsx` has been updated to support all four sports:
- TypeScript interface updated to include `'nba' | 'ncaab'`
- Team initials helper functions added for NBA and NCAAB
- Discord payload correctly includes `gameType` field with all four sport types

### Database Status: ✅ FIXED
The database constraint has been updated via migration `20250115000000_add_basketball_sports.sql`:
```sql
ALTER TABLE editors_picks DROP CONSTRAINT IF EXISTS editors_picks_game_type_check;
ALTER TABLE editors_picks ADD CONSTRAINT editors_picks_game_type_check 
CHECK (game_type IN ('nfl', 'cfb', 'nba', 'ncaab'));
```

### BuildShip Endpoint Status: ⚠️ NEEDS FIXING
The BuildShip endpoint at `https://xna68l.buildship.run/discord-editor-pick-post` likely has logic that only handles NFL and CFB game types.

## Testing
Use the test file `test-discord-basketball-picks.html` to verify the issue:

1. Open the file in a browser
2. Click "Send Test NBA Pick to Discord"
3. Click "Send Test NCAAB Pick to Discord"
4. Click "Send Test NFL Pick to Discord" (control test)
5. Compare the responses

Expected behavior:
- All three should succeed with HTTP 200 status
- All three should post messages to Discord channel #editors-picks (ID: 1428843931889569893)

## Required BuildShip Endpoint Fix

The BuildShip workflow at `discord-editor-pick-post` needs to be updated to handle NBA and NCAAB game types. Here's what needs to be changed:

### Current Payload Structure
```json
{
  "pickData": {
    "id": "uuid",
    "gameId": "game-id",
    "gameType": "nba|ncaab|nfl|cfb",
    "selectedBetTypes": ["spread_home", "over"],
    "editorNotes": "Analysis text"
  },
  "gameData": {
    "awayTeam": "Team Name",
    "homeTeam": "Team Name",
    "awayLogo": "url",
    "homeLogo": "url",
    "gameDate": "Sat, Nov 16",
    "gameTime": "7:00 PM EST",
    "awaySpread": 5.5,
    "homeSpread": -5.5,
    "awayMl": 185,
    "homeMl": -220,
    "overLine": 225.5,
    "homeTeamColors": { "primary": "#hex", "secondary": "#hex" },
    "awayTeamColors": { "primary": "#hex", "secondary": "#hex" }
  },
  "channelId": "1428843931889569893"
}
```

### BuildShip Code Updates Needed

The BuildShip workflow needs to:

1. **Accept all four game types** - Remove any conditional logic that filters by game type
2. **Update sport emojis** - Ensure basketball picks use 🏀 emoji
3. **Update sport labels** - Map game types correctly:
   ```javascript
   const sportEmojis = {
     'nfl': '🏈',
     'cfb': '🏈', 
     'nba': '🏀',
     'ncaab': '🏀'
   };
   
   const sportLabels = {
     'nfl': 'NFL',
     'cfb': 'College Football',
     'nba': 'NBA',
     'ncaab': 'College Basketball'
   };
   ```

4. **Update color scheme** - Add basketball-specific colors:
   ```javascript
   const sportColors = {
     'nfl': 0x0055A4,    // NFL blue
     'cfb': 0xFF6B00,    // CFB orange
     'nba': 0xFF6600,    // NBA orange  
     'ncaab': 0x003366   // NCAAB navy
   };
   ```

5. **Handle bet type display** - The bet types are the same format for all sports

### Example BuildShip Node.js Code

```javascript
export default async function({ pickData, gameData, channelId, botToken }) {
  const { gameType, selectedBetTypes, editorNotes } = pickData;
  const { awayTeam, homeTeam, gameDate, gameTime, awaySpread, homeSpread, 
          awayMl, homeMl, overLine } = gameData;

  // Sport-specific configuration
  const sportConfig = {
    'nfl': { emoji: '🏈', label: 'NFL', color: 0x0055A4 },
    'cfb': { emoji: '🏈', label: 'College Football', color: 0xFF6B00 },
    'nba': { emoji: '🏀', label: 'NBA', color: 0xFF6600 },
    'ncaab': { emoji: '🏀', label: 'College Basketball', color: 0x003366 }
  };

  const config = sportConfig[gameType] || sportConfig['nfl'];

  // Format bet types into readable text
  const betTypeMap = {
    'spread_away': `${awayTeam} ${awaySpread > 0 ? '+' : ''}${awaySpread}`,
    'spread_home': `${homeTeam} ${homeSpread > 0 ? '+' : ''}${homeSpread}`,
    'ml_away': `${awayTeam} ${awayMl > 0 ? '+' : ''}${awayMl}`,
    'ml_home': `${homeTeam} ${homeMl > 0 ? '+' : ''}${homeMl}`,
    'over': `Over ${overLine}`,
    'under': `Under ${overLine}`
  };

  const picks = selectedBetTypes.map(bt => betTypeMap[bt] || bt).join('\n');

  // Build Discord embed
  const embed = {
    title: `${config.emoji} ${config.label} Editor's Pick`,
    description: `**${awayTeam} @ ${homeTeam}**\n${gameDate} • ${gameTime}`,
    color: config.color,
    fields: [
      {
        name: '🎯 Recommended Picks',
        value: picks,
        inline: false
      },
      {
        name: '📊 Analysis',
        value: editorNotes,
        inline: false
      },
      {
        name: '📈 Betting Lines',
        value: `**Spread:** ${awayTeam} ${awaySpread > 0 ? '+' : ''}${awaySpread} / ${homeTeam} ${homeSpread > 0 ? '+' : ''}${homeSpread}\n**Moneyline:** ${awayTeam} ${awayMl > 0 ? '+' : ''}${awayMl} / ${homeTeam} ${homeMl > 0 ? '+' : ''}${homeMl}\n**Total:** ${overLine}`,
        inline: false
      }
    ],
    footer: {
      text: 'WagerProof Editor\'s Pick • Always research before betting',
      icon_url: 'https://wagerproof.com/wagerproof-logo.png'
    },
    timestamp: new Date().toISOString()
  };

  // Send to Discord
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ embeds: [embed] })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Discord API error: ${JSON.stringify(error)}`);
  }

  return { success: true, message: 'Posted to Discord successfully' };
}
```

## Verification Steps

After updating the BuildShip endpoint:

1. Create a draft NBA pick in the Editor's Picks admin interface
2. Add editor notes and select bet types
3. Click "Publish"
4. Check Discord #editors-picks channel for the post
5. Repeat for NCAAB

## Additional Files Updated

- `wagerproof-mobile/types/editorsPicks.ts` - Updated EditorPick interface to include 'nba' | 'ncaab'
- `src/components/EditorPickCard.tsx` - Already supports all four sports
- `src/pages/EditorsPicks.tsx` - Already fetches and displays all four sports

## Summary

The frontend and database are ready for basketball picks. The only remaining issue is the BuildShip endpoint configuration. Once that's updated to handle all four sport types, basketball picks will be posted to Discord correctly.

