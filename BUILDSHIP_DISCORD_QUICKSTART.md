# BuildShip Discord Workflow - Quick Start Guide

## Step-by-Step Setup

### 1. Create New Workflow
- Go to BuildShip dashboard
- Create new workflow
- Name: `Discord Editor Pick Poster`
- Endpoint: `/discord-editor-pick-post`
- Method: POST

### 2. Add Input Node
Create these input parameters:
- `pickData` (Object)
- `gameData` (Object)  
- `channelId` (Text)

### 3. Add Code Node - "Format Discord Message"

Paste this complete code:

```javascript
// Helper functions
const formatSpread = (spread) => {
  if (!spread) return '-';
  return spread > 0 ? `+${spread}` : spread.toString();
};

const formatMoneyline = (ml) => {
  if (!ml) return '-';
  return ml > 0 ? `+${ml}` : ml.toString();
};

const formatBetType = (betType, gameData) => {
  const map = {
    'spread_away': `🎯 Spread: **${gameData.awayTeam}** ${formatSpread(gameData.awaySpread)}`,
    'spread_home': `🎯 Spread: **${gameData.homeTeam}** ${formatSpread(gameData.homeSpread)}`,
    'ml_away': `💰 Moneyline: **${gameData.awayTeam}** ${formatMoneyline(gameData.awayMl)}`,
    'ml_home': `💰 Moneyline: **${gameData.homeTeam}** ${formatMoneyline(gameData.homeMl)}`,
    'over': `📈 Over **${gameData.overLine || 'N/A'}**`,
    'under': `📉 Under **${gameData.overLine || 'N/A'}**`
  };
  return map[betType] || betType;
};

const hexToDecimal = (hex) => parseInt(hex.replace('#', ''), 16);

const getEmbedColor = (selectedBetTypes, gameData) => {
  const firstBet = selectedBetTypes[0];
  if (firstBet?.includes('home')) return hexToDecimal(gameData.homeTeamColors.primary);
  if (firstBet?.includes('away')) return hexToDecimal(gameData.awayTeamColors.primary);
  return hexToDecimal('#10b981'); // WagerProof green default
};

// Build embed
const formattedBets = pickData.selectedBetTypes
  .map(bet => formatBetType(bet, gameData))
  .join('\n');

const embedColor = getEmbedColor(pickData.selectedBetTypes, gameData);

const gameInfo = gameData.gameDate && gameData.gameTime 
  ? `${gameData.gameDate} at ${gameData.gameTime}`
  : gameData.gameDate || gameData.gameTime || 'TBD';

return {
  embeds: [{
    title: "🏈 NEW EDITOR'S PICK",
    description: `**${gameData.awayTeam}** @ **${gameData.homeTeam}**`,
    color: embedColor,
    fields: [
      { name: "📅 Game Time", value: gameInfo, inline: false },
      { name: "🎲 Pick(s)", value: formattedBets, inline: false },
      { name: "📊 Analysis", value: pickData.editorNotes || "No analysis provided.", inline: false }
    ],
    thumbnail: { url: gameData.awayLogo || "" },
    image: { url: gameData.homeLogo || "" },
    footer: {
      text: `WagerBot • Editor's Pick • ${pickData.gameType.toUpperCase()}`,
      icon_url: "https://wagerproof.com/wagerproof-logo.png"
    },
    timestamp: new Date().toISOString()
  }],
  channelId: channelId
};
```

**Output variable name**: `discordMessage`

### 4. Add REST API Node - "Post to Discord"

Configure:
- **URL**: `https://discord.com/api/v10/channels/{{discordMessage.channelId}}/messages`
- **Method**: POST
- **Headers**:
  ```json
  {
    "Authorization": "Bot YOUR_DISCORD_BOT_TOKEN_HERE",
    "Content-Type": "application/json"
  }
  ```
- **Body**: `{{discordMessage.embeds}}` (select the embeds array from previous node)

**Note**: In BuildShip, for the body, you'll want to pass the entire `discordMessage` object which contains the `embeds` array.

### 5. Add Response Node

Return:
```javascript
{
  success: true,
  messageId: response.id,
  timestamp: response.timestamp
}
```

### 6. Test with Sample Data

Use this test payload:

```json
{
  "pickData": {
    "id": "test-123",
    "gameId": "401635491",
    "gameType": "nfl",
    "selectedBetTypes": ["spread_home", "over"],
    "editorNotes": "The Chiefs have been dominant at home this season, covering in 7 of their last 9 games."
  },
  "gameData": {
    "awayTeam": "Los Angeles Chargers",
    "homeTeam": "Kansas City Chiefs",
    "awayLogo": "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png",
    "homeLogo": "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
    "gameDate": "Sunday, October 20, 2025",
    "gameTime": "1:00 PM ET",
    "awaySpread": 7.5,
    "homeSpread": -7.5,
    "awayMl": 280,
    "homeMl": -350,
    "overLine": 47.5,
    "homeTeamColors": {
      "primary": "#E31837",
      "secondary": "#FFB81C"
    },
    "awayTeamColors": {
      "primary": "#0080C6",
      "secondary": "#FFC20E"
    }
  },
  "channelId": "1428843931889569893"
}
```

### 7. Deploy

- Click "Deploy"
- Copy the production URL
- Verify it's: `https://xna68l.buildship.run/discord-editor-pick-post`

## Verification

1. Test in BuildShip with sample payload
2. Check Discord #editors-picks channel for message
3. Verify formatting and images
4. Check console logs in BuildShip

## Common Issues

**401 Error**: Check bot token in Authorization header
**403 Error**: Bot needs "Send Messages" permission in channel
**404 Error**: Verify channel ID is correct
**Embed not showing**: Check embeds array structure

## Quick Links

- Discord Developer Portal: https://discord.com/developers
- Server ID: 1428416703175594209
- Editors Picks Channel: 1428843931889569893
- General Channel: 1428416705171951821

---

Once deployed and tested, the frontend will automatically post to Discord when picks are published!

