# BuildShip Discord General Message Function

## Endpoint
`https://xna68l.buildship.run/discord-thread-creation-wager-bot-copy-562a06b862bf`

## Code for BuildShip

```javascript
export default async function ({ embeds, channelId, botToken }) {
  try {
    // Validate inputs
    if (!botToken) {
      throw new Error('Bot token is required');
    }
    if (!channelId) {
      throw new Error('Channel ID is required');
    }
    if (!embeds || !Array.isArray(embeds) || embeds.length === 0) {
      throw new Error('Embeds array is required');
    }

    // Build Discord payload
    const payload = {
      embeds: embeds
    };

    // Send to Discord via Bot API
    const discordApiUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
    
    const response = await fetch(discordApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Discord API error (${response.status}): ${errorData.message || response.statusText}`);
    }

    const messageData = await response.json();

    return {
      success: true,
      message: 'Message sent to Discord successfully',
      messageId: messageData.id,
      channelId: channelId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error sending to Discord:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
```

## Input Parameters

- `embeds` (required): Array of Discord embed objects
- `channelId` (required): Discord channel ID to post to
- `botToken` (required): Discord bot token (configured in BuildShip secrets)

## Usage Example

```json
{
  "embeds": [
    {
      "title": "🏈 Today in Sports",
      "description": "Your message content here...",
      "color": 1096577,
      "fields": [
        {
          "name": "📅 Date",
          "value": "Wednesday, November 12, 2025",
          "inline": false
        }
      ],
      "footer": {
        "text": "WagerBot • Today in Sports",
        "icon_url": "https://wagerproof.com/wagerproof-logo.png"
      },
      "timestamp": "2025-11-12T23:15:19.113Z"
    }
  ],
  "channelId": "1428416705171951821",
  "botToken": "YOUR_BOT_TOKEN"
}
```

