# Discord Bot BuildShip Workflow Setup

## Overview
This document provides the complete setup instructions for creating the BuildShip workflow that posts Editor's Picks to Discord.

## Discord Bot Information
- **Application ID**: YOUR_APPLICATION_ID_HERE
- **Public Key**: YOUR_PUBLIC_KEY_HERE
- **Bot Token**: YOUR_DISCORD_BOT_TOKEN_HERE
- **Server ID**: YOUR_SERVER_ID_HERE
- **Channels**:
  - General: 1428416705171951821
  - Editors Picks: 1428843931889569893

## BuildShip Workflow Configuration

### Endpoint
Create a new workflow at: `https://xna68l.buildship.run/discord-editor-pick-post`

### HTTP Method
POST

### Input Parameters

The workflow receives a JSON payload with the following structure:

```json
{
  "pickData": {
    "id": "uuid",
    "gameId": "string",
    "gameType": "nfl" | "cfb",
    "selectedBetTypes": ["spread_home", "ml_away", "over", etc.],
    "editorNotes": "string"
  },
  "gameData": {
    "awayTeam": "string",
    "homeTeam": "string",
    "awayLogo": "url",
    "homeLogo": "url",
    "gameDate": "string",
    "gameTime": "string",
    "awaySpread": number,
    "homeSpread": number,
    "awayMl": number,
    "homeMl": number,
    "overLine": number,
    "homeTeamColors": {
      "primary": "#hex",
      "secondary": "#hex"
    },
    "awayTeamColors": {
      "primary": "#hex",
      "secondary": "#hex"
    }
  },
  "channelId": "1428843931889569893"
}
```

## Workflow Implementation

### Node 1: Input Processing

Create input parameters in BuildShip:
- `pickData` (object)
- `gameData` (object)
- `channelId` (string)

### Node 2: Format Data (JavaScript Code Node)

```javascript
// Helper function to format spread
function formatSpread(spread) {
  if (spread === null || spread === undefined) return '-';
  if (spread > 0) return `+${spread}`;
  return spread.toString();
}

// Helper function to format moneyline
function formatMoneyline(ml) {
  if (ml === null || ml === undefined) return '-';
  if (ml > 0) return `+${ml}`;
  return ml.toString();
}

// Helper function to format bet type display
function formatBetType(betType, gameData) {
  switch(betType) {
    case 'spread_away':
      return `🎯 Spread: **${gameData.awayTeam}** ${formatSpread(gameData.awaySpread)}`;
    case 'spread_home':
      return `🎯 Spread: **${gameData.homeTeam}** ${formatSpread(gameData.homeSpread)}`;
    case 'ml_away':
      return `💰 Moneyline: **${gameData.awayTeam}** ${formatMoneyline(gameData.awayMl)}`;
    case 'ml_home':
      return `💰 Moneyline: **${gameData.homeTeam}** ${formatMoneyline(gameData.homeMl)}`;
    case 'over':
      return `📈 Over **${gameData.overLine || 'N/A'}**`;
    case 'under':
      return `📉 Under **${gameData.overLine || 'N/A'}**`;
    default:
      return betType;
  }
}

// Convert hex color to Discord decimal
function hexToDecimal(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  return parseInt(hex, 16);
}

// Determine embed color based on first selected bet
function getEmbedColor(selectedBetTypes, gameData) {
  const firstBet = selectedBetTypes[0];
  
  if (firstBet.includes('home')) {
    return hexToDecimal(gameData.homeTeamColors.primary);
  } else if (firstBet.includes('away')) {
    return hexToDecimal(gameData.awayTeamColors.primary);
  } else if (firstBet === 'over' || firstBet === 'under') {
    // Use home team color for O/U
    return hexToDecimal(gameData.homeTeamColors.primary);
  }
  
  // Default to a neutral color (WagerProof green)
  return hexToDecimal('#10b981');
}

// Format all selected bets
const formattedBets = pickData.selectedBetTypes
  .map(bet => formatBetType(bet, gameData))
  .join('\n');

// Get embed color
const embedColor = getEmbedColor(pickData.selectedBetTypes, gameData);

// Format game info
const gameInfo = gameData.gameDate && gameData.gameTime 
  ? `${gameData.gameDate} at ${gameData.gameTime}`
  : gameData.gameDate || gameData.gameTime || 'TBD';

// Build the Discord embed
const discordEmbed = {
  embeds: [{
    title: "🏈 NEW EDITOR'S PICK",
    description: `**${gameData.awayTeam}** @ **${gameData.homeTeam}**`,
    color: embedColor,
    fields: [
      {
        name: "📅 Game Time",
        value: gameInfo,
        inline: false
      },
      {
        name: "🎲 Pick(s)",
        value: formattedBets,
        inline: false
      },
      {
        name: "📊 Analysis",
        value: pickData.editorNotes || "No analysis provided.",
        inline: false
      }
    ],
    thumbnail: {
      url: gameData.awayLogo || ""
    },
    image: {
      url: gameData.homeLogo || ""
    },
    footer: {
      text: `WagerBot • Editor's Pick • ${pickData.gameType.toUpperCase()}`,
      icon_url: "https://wagerproof.com/wagerproof-logo.png"
    },
    timestamp: new Date().toISOString()
  }]
};

// Return formatted data for next node
return {
  discordEmbed,
  channelId
};
```

### Node 3: Send to Discord (REST API Call Node)

Configure the REST API node:

**URL**: `https://discord.com/api/v10/channels/{{channelId}}/messages`

**Method**: POST

**Headers**:
```json
{
  "Authorization": "Bot YOUR_DISCORD_BOT_TOKEN_HERE",
  "Content-Type": "application/json"
}
```

**Body**: Use the `discordEmbed` output from Node 2

### Node 4: Response Handler (JavaScript Code Node)

```javascript
// Check if Discord API call was successful
if (response && response.id) {
  return {
    success: true,
    messageId: response.id,
    timestamp: response.timestamp
  };
} else {
  throw new Error('Failed to post to Discord');
}
```

### Node 5: Return Response

Return the final response:
```json
{
  "success": true,
  "messageId": "discord_message_id",
  "timestamp": "ISO timestamp"
}
```

## Error Handling

Add try-catch blocks in your workflow:

```javascript
try {
  // Discord API call
  const response = await discordAPI();
  return { success: true, data: response };
} catch (error) {
  console.error('Discord API Error:', error);
  return {
    success: false,
    error: error.message
  };
}
```

## Testing the Workflow

### Test Payload

Use this test payload in BuildShip:

```json
{
  "pickData": {
    "id": "test-123",
    "gameId": "401635491",
    "gameType": "nfl",
    "selectedBetTypes": ["spread_home", "over"],
    "editorNotes": "The Chiefs have been dominant at home this season, covering in 7 of their last 9 games. Their offense is clicking and the total looks promising given both teams' scoring trends."
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

## Discord Embed Preview

The message will appear in Discord as:

```
┌─────────────────────────────────────┐
│ 🏈 NEW EDITOR'S PICK                │
├─────────────────────────────────────┤
│ Los Angeles Chargers @ Kansas City  │
│ Chiefs                              │
│                                     │
│ 📅 Game Time                        │
│ Sunday, October 20, 2025 at 1:00   │
│ PM ET                               │
│                                     │
│ 🎲 Pick(s)                          │
│ 🎯 Spread: Kansas City Chiefs -7.5 │
│ 📈 Over 47.5                        │
│                                     │
│ 📊 Analysis                         │
│ The Chiefs have been dominant at    │
│ home this season...                 │
│                                     │
│ [Away Team Logo]                    │
│ [Home Team Logo]                    │
│                                     │
│ WagerBot • Editor's Pick • NFL      │
└─────────────────────────────────────┘
```

## Deployment Checklist

- [ ] Create BuildShip workflow endpoint
- [ ] Add input parameters (pickData, gameData, channelId)
- [ ] Implement formatting logic (Node 2)
- [ ] Configure Discord API call (Node 3)
- [ ] Add response handler (Node 4)
- [ ] Test with sample payload
- [ ] Verify message appears in Discord
- [ ] Test error handling
- [ ] Deploy workflow to production
- [ ] Test integration with frontend

## Troubleshooting

### Discord API Returns 401 Unauthorized
- Verify bot token is correct
- Check that token starts with "Bot " prefix in Authorization header

### Discord API Returns 403 Forbidden
- Ensure bot has "Send Messages" permission in the channel
- Verify bot is a member of the server

### Discord API Returns 404 Not Found
- Verify channel ID is correct
- Check that bot can see the channel

### Embed Not Displaying Correctly
- Ensure color is a valid decimal number
- Check that image URLs are valid and accessible
- Verify embed field values are not empty strings

### Frontend Integration Issues
- Check browser console for fetch errors
- Verify BuildShip endpoint URL is correct
- Ensure CORS is configured on BuildShip

## Monitoring

Add console logs at key points:
```javascript
console.log('Received payload:', { pickData, gameData, channelId });
console.log('Formatted embed:', discordEmbed);
console.log('Discord API response:', response);
```

## Support

For issues with:
- **Discord Bot**: Check Discord Developer Portal
- **BuildShip Workflow**: Check BuildShip logs and console
- **Frontend Integration**: Check browser DevTools console

