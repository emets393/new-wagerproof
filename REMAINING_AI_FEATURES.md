# Remaining AI Completion Features

## ✅ Completed So Far

### Widget-Level Completions (Spread & OU)
- ✅ OpenAI API integration with web search enabled
- ✅ Edge Function: `generate-ai-completion` (working and tested)
- ✅ Database tables created (`ai_completions`, `ai_completion_configs`)
- ✅ System prompts stored in database
- ✅ AI Payload Viewer (admin tool for testing)
- ✅ Prompt editing and saving from payload viewer
- ✅ Completions display in NFL game cards ("What this Means")
- ✅ Auto-refresh after generating new completions
- ✅ Polymarket data included in payloads

## 🚧 Remaining Tasks

### 1. CFB (College Football) Integration
**Status**: Partially done
- ✅ Database tables support CFB
- ✅ Edge Functions support CFB
- ❌ CFB page doesn't have AI Payload Viewer button
- ❌ CFB page doesn't display AI completions in widgets

**What's needed**:
- Add AI Payload Viewer to CFB page (same as NFL)
- Integrate AI completions display in CFB game cards
- Test CFB completion generation

**Files to modify**:
- `src/pages/CollegeFootball.tsx`
- Test with CFB games

---

### 2. Automated Daily Completion Runs
**Status**: Edge Function created but not scheduled
- ✅ Edge Function: `check-missing-completions` exists
- ✅ Checks for games without completions
- ✅ Generates completions for missing widgets
- ❌ No automated schedule configured
- ❌ Not set up as a cron job

**What's needed**:
- Configure Supabase cron job to run twice daily
- Test the Edge Function manually first
- Set up monitoring/notifications for failures

**Supabase cron setup**:
```sql
-- In Supabase SQL Editor
select cron.schedule(
  'check-ai-completions-morning',
  '0 8 * * *', -- 8 AM daily
  $$
  select net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/check-missing-completions',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'check-ai-completions-evening',
  '0 18 * * *', -- 6 PM daily
  $$
  select net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/check-missing-completions',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

---

### 3. Page-Level "Value Finds" Analysis
**Status**: Edge Function created but not integrated
- ✅ Edge Function: `generate-page-level-analysis` exists
- ✅ Database table: `ai_value_finds` exists
- ✅ Database table: `ai_page_level_schedules` exists
- ❌ No default system prompts inserted
- ❌ No UI to trigger page-level analysis
- ❌ No display of Value Finds results

**What's needed**:
1. **Insert default prompts**:
   - Create migration to insert default page-level system prompts
   - NFL prompt should guide GPT to find value mismatches
   - CFB prompt similar

2. **Admin trigger UI**:
   - Add page to Admin Panel with "Generate Value Finds" button
   - Display last run time and results
   - Allow editing page-level system prompts

3. **Update Edge Function for web search**:
   - Currently uses Chat Completions API
   - Should use Responses API (like widget completions)
   - Add web search tool for real-time news

**Example page-level prompt**:
```
You are an expert sports betting analyst. Analyze the provided games and identify 3-5 "value finds" - games where there are significant mismatches between:
- Model predictions vs Vegas lines
- Public betting percentages vs actual line value
- Polymarket odds vs Vegas odds
- Weather/news factors not reflected in lines

For each value pick, return JSON with:
- game_id
- matchup
- bet_type (spread/ml/ou)
- recommended_pick
- confidence (1-10)
- key_factors (array of strings)
- explanation (2-3 sentences)

Also provide an overall summary of the betting landscape for the day.

Return JSON: {
  "value_picks": [...],
  "summary": "...",
  "total_games_analyzed": X
}
```

---

### 4. "Value Finds" Display Section
**Status**: Component created but not integrated
- ✅ Component: `ValueFindsSection.tsx` exists
- ❌ Not integrated into Editors Picks page
- ❌ Not fetching real data
- ❌ Not displaying actual Value Finds

**What's needed**:
1. **Update ValueFindsSection component**:
   - Fetch latest Value Finds from `ai_value_finds` table
   - Display each value pick as a card
   - Show confidence, key factors, explanation
   - Link to the actual game card

2. **Integrate into Editors Picks page**:
   - Add NFL Value Finds section
   - Add CFB Value Finds section
   - Show when last generated
   - Add refresh button for admins

**Files to modify**:
- `src/components/ValueFindsSection.tsx`
- `src/pages/EditorsPicks.tsx`

---

### 5. Admin Panel for AI Configs
**Status**: No dedicated admin page
- ✅ Can edit prompts in Payload Viewer (per-test basis)
- ✅ Can save prompts from Payload Viewer
- ❌ No centralized admin page for all AI configs
- ❌ No way to enable/disable widget types
- ❌ No way to manage page-level schedules
- ❌ No analytics/monitoring of AI usage

**What's needed**:
1. **Create Admin AI Settings page**:
   - `/admin/ai-settings` route
   - List all widget configs (NFL & CFB, Spread & OU)
   - Enable/disable toggles
   - Edit system prompts directly
   - View prompt history (future)

2. **Page-level config section**:
   - Manage NFL and CFB page-level prompts
   - Set scheduled run times
   - Enable/disable automated runs
   - Trigger manual runs
   - View last run results

3. **Analytics dashboard**:
   - Total completions generated
   - API usage and costs
   - Success/error rates
   - Popular value finds
   - User engagement with AI content

**New files to create**:
- `src/pages/admin/AISettings.tsx`
- `src/components/admin/AIConfigManager.tsx`
- `src/components/admin/PageLevelManager.tsx`
- `src/components/admin/AIAnalytics.tsx`

---

### 6. Discord Bot Integration
**Status**: Not started
- ❌ No Discord webhook configured
- ❌ No integration with Value Finds
- ❌ No automated posting

**What's needed**:
1. **Set up Discord webhook**:
   - Create webhook in Discord server
   - Store webhook URL in Supabase secrets
   - Create utility function to post to Discord

2. **Value Finds posting**:
   - After generating page-level analysis, post to Discord
   - Format as rich embed with:
     - Title: "🎯 Daily Value Finds - NFL/CFB"
     - Fields for each value pick
     - Link back to website
     - Timestamp

3. **Widget completion notifications (optional)**:
   - Post when new games get completions
   - Daily summary of completions generated

**Implementation**:
```typescript
// src/utils/discordWebhook.ts
export async function postValueFindsToDiscord(valueFin

ds: any) {
  const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
  
  const embed = {
    title: `🎯 ${valueFins.sport_type.toUpperCase()} Value Finds`,
    description: valueFins.summary_text,
    color: 0x22c55e, // Honeydew green
    fields: valueFins.value_picks.map(pick => ({
      name: pick.matchup,
      value: `${pick.recommended_pick} - Confidence: ${pick.confidence}/10\n${pick.explanation}`,
      inline: false
    })),
    timestamp: new Date().toISOString(),
    footer: {
      text: 'WagerProof AI Analysis'
    }
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] })
  });
}
```

**Files to create**:
- `src/utils/discordWebhook.ts`
- Update `generate-page-level-analysis` Edge Function to call Discord

---

### 7. Cron Job / Automated Scheduling
**Status**: Not configured
- ❌ No cron jobs set up in Supabase
- ❌ No scheduling for page-level analysis
- ❌ No monitoring of automated runs

**What's needed**:
1. **Widget completions cron**:
   - Run `check-missing-completions` twice daily (8 AM, 6 PM)
   - Generates completions for any new games

2. **Page-level analysis cron**:
   - Read from `ai_page_level_schedules` table
   - Run at configured times for NFL/CFB
   - Trigger Value Finds generation
   - Post results to Discord

3. **Monitoring & alerts**:
   - Log all cron runs to a table
   - Send alerts on failures
   - Track API usage and costs

---

## Priority Order (Recommended)

### High Priority (Complete main features)
1. ✅ ~~Widget completions working~~ DONE
2. **CFB Integration** (1-2 hours) - Parity with NFL
3. **Page-level Value Finds** (3-4 hours) - Core differentiator
4. **Value Finds Display** (2-3 hours) - User-facing feature

### Medium Priority (Admin & automation)
5. **Automated Daily Runs** (1 hour) - Reduce manual work
6. **Admin AI Settings Page** (3-4 hours) - Better management
7. **Discord Integration** (1-2 hours) - Distribution

### Low Priority (Nice to have)
8. **Analytics Dashboard** (future)
9. **Prompt versioning** (future)
10. **A/B testing prompts** (future)

---

## Estimated Time to Complete
- **CFB Integration**: 1-2 hours
- **Page-level Analysis**: 3-4 hours (prompts + UI + testing)
- **Value Finds Display**: 2-3 hours
- **Automated Scheduling**: 1 hour
- **Admin Panel**: 3-4 hours
- **Discord Integration**: 1-2 hours

**Total**: ~13-18 hours of development work

---

## Testing Checklist

### Widget Completions
- [x] NFL Spread completions generate
- [x] NFL OU completions generate
- [ ] CFB Spread completions generate
- [ ] CFB OU completions generate
- [x] Completions display in game cards
- [x] Payload viewer works
- [x] Prompt saving works
- [x] Web search is included in responses

### Page-Level Analysis
- [ ] Can trigger manually from admin panel
- [ ] Generates Value Finds JSON correctly
- [ ] Stores in database
- [ ] Displays on Editors Picks page
- [ ] Includes all game data
- [ ] Uses web search for news
- [ ] Discord posting works

### Automation
- [ ] check-missing-completions runs successfully
- [ ] Cron jobs execute on schedule
- [ ] Failures are logged
- [ ] No rate limiting issues

### Admin Panel
- [ ] Can view all configs
- [ ] Can edit prompts
- [ ] Can enable/disable widgets
- [ ] Can trigger page-level analysis
- [ ] Can view analytics

---

## Next Steps

**Immediate action items**:
1. Decide on priority order (recommend: CFB → Value Finds → Admin Panel)
2. Start with CFB integration (easiest, provides parity)
3. Move to page-level Value Finds (highest value feature)
4. Then automation and admin tools

**Your call**: Which feature would you like to tackle first?

