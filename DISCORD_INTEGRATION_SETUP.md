# Discord Integration Setup

## Overview
The Discord integration automatically posts AI-generated "Value Finds" to your Discord server whenever page-level analysis is run.

## Features
- Rich embed with team matchups
- Recommended picks with confidence ratings
- Analysis summary
- Automatic posting after Value Finds generation
- Separate channels for NFL and CFB (optional)

## Setup Steps

### 1. Create Discord Webhook

#### In Your Discord Server:
1. Go to your Discord server
2. Right-click on the channel where you want Value Finds posted
3. Select **Edit Channel** → **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Name it "WagerProof AI" or "Value Finds Bot"
6. Optionally upload a logo image
7. Click **Copy Webhook URL**

#### Recommended Channel Structure:
- `#value-finds-nfl` - For NFL picks
- `#value-finds-cfb` - For CFB picks
- Or use a single `#value-finds` channel for both

### 2. Add Webhook to Supabase Secrets

#### Go to Supabase Dashboard:
https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/settings/vault

#### Add the Secret:
1. Click **New secret**
2. Name: `DISCORD_WEBHOOK_URL`
3. Secret: Paste your Discord webhook URL
4. Click **Save**

**Important**: If you want separate webhooks for NFL and CFB, create:
- `DISCORD_WEBHOOK_URL_NFL`
- `DISCORD_WEBHOOK_URL_CFB`

Then update the Edge Function code to use the appropriate one based on `sport_type`.

### 3. Test the Integration

#### Manual Test via SQL:
```sql
-- Trigger a manual page-level analysis for NFL
SELECT net.http_post(
  url := 'YOUR_PROJECT_URL/functions/v1/generate-page-level-analysis',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object(
    'sport_type', 'nfl',
    'analysis_date', to_char(current_date, 'YYYY-MM-DD')
  )
);
```

#### Or via Admin Panel:
1. Go to `/admin/ai-settings`
2. Click on the **Page-Level Analysis** tab
3. Click **Generate Now** for NFL or CFB
4. Check your Discord channel for the post

### 4. Verify It Works

After generating, you should see a Discord message that looks like:

```
🏈 NFL Value Finds - 2025-11-08

WagerProof AI has identified 5 value opportunities for today's games.

1. Buffalo Bills @ Kansas City Chiefs
**Chiefs -3.5** (SPREAD)
Confidence: ⭐⭐⭐⭐⭐⭐⭐⭐ (8/10)
Model shows Chiefs covering by 5+ points...

2. Dallas Cowboys @ Philadelphia Eagles
...

📊 Analysis Summary
Today's slate features strong edges in divisional matchups...
```

## Customizing the Discord Post

### Update the Edge Function:

Edit `supabase/functions/generate-page-level-analysis/index.ts`:

```typescript
// Change the colors
const color = sportType === 'nfl' ? 0x0055A4 : 0xFF6B00; // Hex colors

// Change the emojis
const sportEmoji = sportType === 'nfl' ? '🏈' : '🏈';

// Change the bot name/avatar
username: 'WagerProof AI',
avatar_url: 'https://your-logo-url.com/logo.png',

// Change the footer
footer: {
  text: 'Your Custom Footer Text',
  icon_url: 'https://your-icon-url.com/icon.png'
}
```

Then redeploy:
```bash
npx supabase functions deploy generate-page-level-analysis
```

## Discord Embed Format Reference

### Current Fields:
1. **Title**: Sport type and date
2. **Description**: Number of value opportunities found
3. **Fields**: Up to 5 value picks with:
   - Matchup
   - Recommended pick
   - Bet type
   - Confidence rating (stars)
   - Explanation snippet
4. **Footer**: Disclaimer and branding
5. **Timestamp**: When the analysis was generated
6. **URL**: Link to your Value Finds page

### Discord Limits:
- Title: 256 characters max
- Description: 4096 characters max
- Fields: 25 max (we use 6: 5 picks + summary)
- Field name: 256 characters max
- Field value: 1024 characters max
- Footer text: 2048 characters max
- Total embed: 6000 characters max

## Multiple Webhooks (NFL & CFB)

If you want separate channels for NFL and CFB:

### 1. Create Two Webhooks
- One for `#value-finds-nfl`
- One for `#value-finds-cfb`

### 2. Add Both to Supabase Secrets
```
DISCORD_WEBHOOK_URL_NFL = https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_URL_CFB = https://discord.com/api/webhooks/...
```

### 3. Update the Edge Function

In `generate-page-level-analysis/index.ts`, change:

```typescript
// Old:
const discordWebhook = Deno.env.get('DISCORD_WEBHOOK_URL');

// New:
const webhookKey = `DISCORD_WEBHOOK_URL_${sport_type.toUpperCase()}`;
const discordWebhook = Deno.env.get(webhookKey) || Deno.env.get('DISCORD_WEBHOOK_URL');
```

## Troubleshooting

### Webhook Not Posting

1. **Check if webhook URL is set**:
```sql
-- In Supabase SQL Editor (won't show the actual value for security)
SELECT name FROM vault.secrets WHERE name = 'DISCORD_WEBHOOK_URL';
```

2. **Check Edge Function logs**:
https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions/generate-page-level-analysis

Look for:
- "Posted Value Finds to Discord" (success)
- "Error posting to Discord" (failure)

3. **Test webhook directly** (from terminal):
```bash
curl -X POST "YOUR_DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Test",
    "content": "Test message from WagerProof"
  }'
```

### Discord Errors

Common Discord webhook errors:

- **404 Not Found**: Webhook URL is invalid or was deleted
- **400 Bad Request**: Embed format is invalid
- **401 Unauthorized**: Webhook URL is incorrect
- **429 Rate Limited**: Posting too frequently (max 30/minute)

### No Value Finds Generated

If Discord isn't posting, check if Value Finds were even generated:

```sql
SELECT * FROM ai_value_finds 
ORDER BY generated_at DESC 
LIMIT 5;
```

If the table is empty, the analysis isn't finding any value opportunities.

## Rate Limits

Discord webhook rate limits:
- **30 messages per minute** per webhook
- **5 messages per second** across all webhooks

Our integration posts once per analysis run, so this should never be an issue.

## Security

### Webhook URL Security
- **Never commit webhook URLs to git**
- Store in Supabase secrets only
- If leaked, regenerate the webhook in Discord

### Regenerating a Webhook
1. Go to Discord channel → Integrations → Webhooks
2. Delete the old webhook
3. Create a new one
4. Update the secret in Supabase

## Best Practices

1. **Test before automating**: Always test manually before setting up cron jobs
2. **Monitor for spam**: Make sure Value Finds aren't posting too often
3. **Use roles/pings wisely**: Consider adding role mentions for important picks
4. **Archive old messages**: Discord has message limits, consider archiving
5. **Multiple channels**: Separate by sport to keep things organized

## Advanced: Role Mentions

To ping a role when Value Finds are posted:

### 1. Create a Discord Role
- Name it "Value Finds Alerts" or similar
- Copy the Role ID (enable Developer Mode in Discord)

### 2. Update the Post Function

Add to the Discord post body:

```typescript
body: JSON.stringify({
  content: `<@&YOUR_ROLE_ID> New value finds available!`,
  username: 'WagerProof AI',
  embeds: [embed],
})
```

Replace `YOUR_ROLE_ID` with the actual role ID.

## Support

If you need help:
1. Check Edge Function logs first
2. Test webhook directly with curl
3. Verify secrets are set correctly
4. Check Discord channel permissions

## Next Steps

After Discord is working:
1. Set up automated page-level analysis runs
2. Monitor which picks perform best
3. Adjust prompts based on results
4. Consider adding historical tracking
5. Build a Discord bot for interactive features (future)

