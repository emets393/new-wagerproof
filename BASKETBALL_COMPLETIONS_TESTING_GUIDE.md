# Basketball AI Completions - Testing Guide

## Quick Start

### 1. Apply Database Migration

First, apply the migration to add NBA and NCAAB system prompts:

```bash
cd /Users/chrishabib/Documents/new-wagerproof
npx supabase db push
```

When prompted, confirm with `Y` to push the migration.

---

## 2. Test NBA Widget Completions

### Test Spread Prediction

1. **Navigate to NBA page** in your app
2. **Enable Admin Mode** (toggle in sidebar)
3. **Find an NBA game card** with upcoming games
4. **Click "AI Payload" button** (purple button, top-right of card)
5. **In Spread Prediction tab**:
   - Review the game data payload
   - Check the system prompt (should mention injuries, rest, momentum)
   - Click **"Generate"** button
   - Wait 10-20 seconds for OpenAI to respond
   - Verify completion appears in green "AI Generated Response" section
6. **Close the modal**
7. **Expand the game card** (Show More Details)
8. **Verify completion appears** in "What This Means - Spread Prediction" section
9. **Check for Sparkles icon** (✨) indicating AI content

### Test Over/Under Prediction

1. **Click "AI Payload" button again** on the same game
2. **Switch to Over/Under Prediction tab**
3. **Review the payload and prompt** (should mention pace, scoring trends)
4. **Click "Generate"**
5. **Wait for completion**
6. **Close modal and verify** completion appears in "What This Means - Over/Under Prediction"

### Verify Web Search Integration

The completions should include:
- Recent injury news (e.g., "With [Player] out...")
- Recent performance trends (e.g., "Team has covered in 3 of last 5...")
- Rest considerations (e.g., "Playing on back-to-back...")
- Current context that wouldn't be in static data

---

## 3. Test NCAAB Widget Completions

### Test Spread Prediction

1. **Navigate to NCAAB page**
2. **Ensure Admin Mode is enabled**
3. **Find a college basketball game card**
4. **Click "AI Payload" button**
5. **In Spread Prediction tab**:
   - Review the game data payload
   - Check the system prompt (should mention home court, conference, rivalries)
   - Click **"Generate"**
   - Wait for completion
   - Verify it appears in modal
6. **Close modal and verify** it appears in game card

### Test Over/Under Prediction

1. **Open AI Payload again**
2. **Switch to Over/Under tab**
3. **Review prompt** (should mention tempo, coaching tendencies)
4. **Generate completion**
5. **Verify it appears** in both modal and game card

### Verify College-Specific Context

Completions should include:
- Home court advantage mentions
- Conference standings/implications
- Recent performance against similar opponents
- Coaching style/tempo considerations
- Any tournament implications

---

## 4. Test Page-Level Analysis (NBA)

### Generate Value Finds

1. **Navigate to AI Settings page** (Admin menu)
2. **Scroll to NBA section**
3. **Click "Generate Analysis Now" button**
4. **Wait 30-60 seconds** (analyzes entire slate)
5. **Check for success message**

### Verify Results

1. **Still on AI Settings page**:
   - Preview should show high value badges
   - Preview should show page header summary
   - Preview should show editor cards
2. **If satisfied, click "Publish"** to make visible to users
3. **Navigate to NBA page**:
   - Check for page header with summary text
   - Check for compact picks widgets
   - Check for high value badges on select game cards
4. **Navigate to Editors Picks page**:
   - Should see NBA editor cards
   - Each card shows recommended pick, confidence, key factors, explanation

---

## 5. Test Page-Level Analysis (NCAAB)

### Generate Value Finds

1. **In AI Settings page**
2. **Scroll to NCAAB section**
3. **Click "Generate Analysis Now"**
4. **Wait for completion**

### Verify Results

1. **Review preview** in AI Settings
2. **Publish if satisfied**
3. **Check NCAAB page** for:
   - Page header content
   - High value badges
   - Compact picks
4. **Check Editors Picks page** for NCAAB cards

---

## 6. Test Prompt Editing

### Edit and Save a Prompt

1. **Open AI Payload viewer** on any NBA game
2. **In the editable "Test Prompt" section**, modify the prompt:
   - Add emphasis on a specific factor
   - Change the word count
   - Adjust the tone
3. **Click "Generate"** with your modified prompt
4. **Review the result**
5. **If satisfied**, click **"Save as Base Prompt"** button
6. **Verify the base prompt updated** by reopening the modal

### Test the New Base Prompt

1. **Find a different NBA game**
2. **Open AI Payload viewer**
3. **Verify the base prompt** now shows your saved version
4. **Generate completion** to test it works

---

## 7. Testing Checklist

### NBA
- [ ] Spread prediction generates successfully
- [ ] Over/under prediction generates successfully
- [ ] Completions appear in game cards immediately
- [ ] Sparkles icon (✨) shows on AI content
- [ ] Web search context is included (injuries, news)
- [ ] Rest/back-to-back factors mentioned when relevant
- [ ] Page-level analysis generates successfully
- [ ] High value badges appear on game cards
- [ ] Page header content displays correctly
- [ ] Editor cards show on Editors Picks page

### NCAAB
- [ ] Spread prediction generates successfully
- [ ] Over/under prediction generates successfully
- [ ] Completions appear in game cards immediately
- [ ] Sparkles icon (✨) shows on AI content
- [ ] Web search context is included (injuries, news)
- [ ] Home court and conference factors mentioned
- [ ] Page-level analysis generates successfully
- [ ] High value badges appear on game cards
- [ ] Page header content displays correctly
- [ ] Editor cards show on Editors Picks page

### General
- [ ] No console errors when generating completions
- [ ] Loading states work correctly (button shows "Generating...")
- [ ] Success/error toasts appear appropriately
- [ ] Modal can be opened and closed smoothly
- [ ] Payload viewer shows correct game data
- [ ] Polymarket data included in payload (if available)
- [ ] Copy to clipboard works for payloads

---

## 8. Expected Completion Quality

### Good NBA Completion Example

```
The model projects the Lakers to cover the -4.5 spread with moderate confidence (65%). 
Key factors include LeBron James returning from rest and the Warriors playing their 
third game in four nights. Public betting is 70% on the Lakers, but the line hasn't 
moved, suggesting sharp money agrees with the model. The Warriors have struggled 
defensively in back-to-back situations this season, allowing 8 more points per game. 
For the Lakers to cover, they need to exploit the tired Warriors defense early.
```

### Good NCAAB Completion Example

```
Duke is favored by 7.5 at home against UNC in this rivalry game, and the model gives 
them a 72% chance to cover. Key factors include Duke's dominant home court advantage 
(12-1 at Cameron Indoor) and UNC's struggles on the road in ACC play (3-4). Public 
betting is split 50-50, but Polymarket has Duke at 68% to cover, aligning with our 
model. Recent news indicates UNC's starting point guard is questionable with an ankle 
injury. For Duke to cover, their interior defense needs to contain UNC's inside game.
```

### Red Flags (Poor Quality)

- ❌ Generic analysis that could apply to any game
- ❌ No mention of recent news or injuries
- ❌ Missing web search context
- ❌ Overly confident predictions without supporting data
- ❌ Ignores rest, travel, or situational factors
- ❌ Doesn't explain what needs to happen for bet to win

---

## 9. Troubleshooting

### Completion Generation Fails

**Symptom**: Error message when clicking "Generate"

**Possible Causes**:
1. OpenAI API key not configured
2. System prompt doesn't exist in database
3. Edge function error

**Solutions**:
1. Check Supabase secrets for `OPENAI_API_KEY`
2. Verify migration was applied: `npx supabase db push`
3. Check edge function logs in Supabase dashboard

---

### Completions Don't Appear in Game Cards

**Symptom**: Completion generates successfully in modal but doesn't show in card

**Possible Causes**:
1. Completions are disabled for the sport
2. Emergency toggle is ON
3. Frontend not fetching completions

**Solutions**:
1. Check AI Settings → verify sport is enabled
2. Check AI Settings → verify emergency toggle is OFF
3. Check browser console for errors
4. Try refreshing the page

---

### AI Payload Button Not Visible

**Symptom**: Can't find the purple "AI Payload" button

**Possible Causes**:
1. Admin Mode not enabled
2. Not logged in as admin

**Solutions**:
1. Toggle Admin Mode ON in sidebar
2. Verify you're logged in with admin privileges
3. Refresh the page

---

### Web Search Not Working

**Symptom**: Completions don't include recent news or injuries

**Possible Causes**:
1. OpenAI web search not enabled in API call
2. System prompt doesn't request web search

**Solutions**:
1. Verify edge function uses Responses API (not Chat Completions)
2. Check system prompt includes "with access to real-time web search"
3. Look for web search results in edge function logs

---

## 10. Performance Benchmarks

### Expected Generation Times

- **Widget-level completion**: 10-20 seconds
  - Includes web search queries
  - Includes OpenAI processing
  
- **Page-level analysis**: 30-60 seconds
  - Analyzes 5-15 games
  - Multiple web searches
  - Complex JSON generation

### Cost Estimates (OpenAI)

- **Widget completion**: ~$0.02-0.03 per generation
  - Using GPT-4o-mini
  - Includes web search tokens
  
- **Page-level analysis**: ~$0.10-0.20 per generation
  - Larger context window
  - More web search queries

---

## 11. Next Steps After Testing

Once testing is complete:

1. **Fine-tune prompts** based on output quality
   - Edit in AI Settings or via Payload Viewer
   - Save successful variations
   
2. **Enable automated generation** (optional)
   - In AI Settings, enable page-level schedules
   - Set preferred generation times
   - Enable auto-publish if desired
   
3. **Monitor usage and costs**
   - Check Supabase edge function logs
   - Monitor OpenAI API usage
   
4. **Gather user feedback**
   - Track which completions users engage with
   - Note any quality issues
   - Iterate on prompts

---

## 12. Rollback Plan

If issues arise:

### Disable Completions
1. Go to AI Settings
2. Toggle off NBA and NCAAB completions
3. Optionally enable emergency toggle to disable all completions

### Revert Migration (if needed)
```bash
# Create a new migration to remove the prompts
supabase migration new remove_basketball_prompts

# In the migration file:
DELETE FROM ai_completion_configs WHERE sport_type IN ('nba', 'ncaab');
DELETE FROM ai_page_level_schedules WHERE sport_type IN ('nba', 'ncaab');

# Apply
npx supabase db push
```

### Clear Bad Completions
```sql
-- In Supabase SQL Editor
DELETE FROM ai_completions WHERE sport_type IN ('nba', 'ncaab');
DELETE FROM ai_value_finds WHERE sport_type IN ('nba', 'ncaab');
```

---

## ✅ Testing Complete!

Once you've completed all the tests above, the NBA and NCAAB AI Completions system is fully operational and ready for production use.

**Remember**: The AI completions improve over time as you refine prompts based on actual results. Don't expect perfection on day one—iterate and improve!

