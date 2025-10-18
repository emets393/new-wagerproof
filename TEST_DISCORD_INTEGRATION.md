# Test Discord Integration - Ready to Go! 🚀

## ✅ Setup Complete

Your Discord bot is now fully integrated and ready to test!

- ✅ BuildShip workflow deployed at `https://xna68l.buildship.run/discord-editor-pick-post`
- ✅ Frontend integration complete in `EditorPickCard.tsx`
- ✅ Discord bot configured with proper credentials
- ✅ Target channel: #editors-picks (1428843931889569893)

## How to Test

### 1. Publish an Editor's Pick

1. Go to your WagerProof app
2. Navigate to Editor's Picks page
3. Create or edit a draft pick
4. Add editor notes (required)
5. Select bet type(s) (spread, moneyline, and/or over/under)
6. Click **"Publish"**

### 2. Watch the Console

Open browser DevTools (F12) and check the Console tab. You should see:

```
📤 Publishing with data: {...}
🔔 Posting to Discord...
✅ Posted to Discord successfully
```

### 3. Check Discord

Go to your Discord server and look in the `#editors-picks` channel. You should see a rich embed with:

- 🏈 "NEW EDITOR'S PICK" title
- Team names with @ separator
- Game date and time
- Selected bet(s) with odds
- Your editor's analysis
- Team logos (away team as thumbnail, home team as main image)
- Color matching the selected team
- WagerBot footer with timestamp

## What to Test

### Basic Tests
- [ ] Single spread pick
- [ ] Single moneyline pick
- [ ] Single over/under pick
- [ ] Multiple picks (e.g., spread + over)
- [ ] NFL game
- [ ] CFB game

### Formatting Tests
- [ ] Negative spread displays correctly (e.g., -7.5)
- [ ] Positive spread displays with + (e.g., +7.5)
- [ ] Negative moneyline displays correctly (e.g., -350)
- [ ] Positive moneyline displays with + (e.g., +280)
- [ ] Long editor notes wrap properly
- [ ] Team logos load correctly

### Edge Cases
- [ ] Game without logos
- [ ] Game without date/time
- [ ] Very long team names

## Expected Discord Message Format

```
┌─────────────────────────────────────────┐
│ 🏈 NEW EDITOR'S PICK                    │
│ [Red color bar based on team colors]   │
├─────────────────────────────────────────┤
│ Los Angeles Chargers @ Kansas City      │
│ Chiefs                                  │
│                                         │
│ 📅 Game Time                            │
│ Sunday, October 20, 2025 at 1:00 PM ET │
│                                         │
│ 🎲 Pick(s)                              │
│ 🎯 Spread: Kansas City Chiefs -7.5     │
│ 📈 Over 47.5                            │
│                                         │
│ 📊 Analysis                             │
│ The Chiefs have been dominant at home   │
│ this season, covering in 7 of their     │
│ last 9 games...                         │
│                                         │
│ [Chargers Logo]                         │
│ [Chiefs Logo]                           │
│                                         │
│ WagerBot • Editor's Pick • NFL          │
│ Oct 20, 2025 5:32 PM                   │
└─────────────────────────────────────────┘
```

## Troubleshooting

### If Discord post fails:

**Check Browser Console:**
```
❌ Discord post failed: [error details]
```

**Common Issues:**

1. **BuildShip workflow not responding**
   - Verify workflow is deployed and active
   - Check BuildShip execution logs
   - Test workflow directly in BuildShip

2. **Discord API error**
   - Check bot permissions in Discord
   - Verify bot has "Send Messages" permission
   - Verify bot has "Embed Links" permission
   - Confirm bot can access #editors-picks channel

3. **Network error**
   - Check internet connection
   - Verify no firewall blocking BuildShip
   - Try again after a moment

### Important Notes

✅ **Pick will still publish even if Discord fails** - The Discord posting is non-blocking, so if there's any issue posting to Discord, your pick will still be published to the app successfully.

✅ **Check BuildShip logs** - If you see errors, go to BuildShip dashboard and check the execution logs for your workflow to see detailed error messages.

## Success Criteria

Your integration is working correctly if:
- ✅ Pick publishes to app normally
- ✅ Console shows "Posted to Discord successfully"
- ✅ Message appears in #editors-picks channel
- ✅ All formatting is correct
- ✅ Team colors display properly
- ✅ Logos load correctly

## Next Steps After Testing

Once you confirm it's working:

1. **Test with real picks** - Use actual NFL/CFB games
2. **Monitor performance** - Watch for any delays or errors
3. **Gather feedback** - See what your Discord community thinks
4. **Iterate** - Adjust formatting in BuildShip workflow as needed

## Need to Change Something?

### Change Discord Channel
Update line 185 in `src/components/EditorPickCard.tsx`:
```typescript
channelId: 'YOUR_NEW_CHANNEL_ID',
```

### Change Message Format
Update the BuildShip workflow code to modify:
- Embed colors
- Field layout
- Emoji usage
- Footer text
- Thumbnail/image placement

### Add Features
Potential enhancements:
- Post to multiple channels
- Add reaction buttons
- Include betting trends
- Add link to pick in app
- Tag specific Discord roles

---

**Ready to test?** Just publish an Editor's Pick and watch the magic happen! 🎉

