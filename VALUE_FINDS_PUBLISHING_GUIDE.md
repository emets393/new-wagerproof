# Value Finds Publishing & Testing Guide

## Overview
This guide covers the new features added to the AI Value Finds system: publish/unpublish controls and the page-level payload testing tool.

## Features Added

### 1. Publish/Unpublish Controls

Value Finds analyses can now be published or unpublished from the user-facing pages.

#### Database Changes
- Added `published` column to `ai_value_finds` table (defaults to `true`)
- Added indexes for efficient querying by `published` status

#### Frontend Behavior
- **Regular Users**: Only see Value Finds marked as `published: true`
- **Admin Mode**: See all Value Finds with:
  - Yellow "Unpublished (Admin Only)" badge for unpublished finds
  - Publish/Unpublish toggle button in the header
  
#### How to Use
1. Navigate to the **Editors Picks** page
2. Enable **Admin Mode** (if not already enabled)
3. Scroll to the **AI Value Finds** section for NFL or CFB
4. Click the **Unpublish** button to hide the analysis from users
5. Click **Publish** to make it visible again

#### Use Cases
- Review AI-generated Value Finds before making them public
- Hide outdated or incorrect analyses quickly
- Test page-level analysis generation without exposing results to users
- Control which Value Finds appear in Discord posts

---

### 2. Page-Level Payload Testing Tool

A comprehensive testing interface for page-level Value Finds analysis, similar to the card-level payload viewer.

#### Location
**Admin Panel → AI Settings → Page-Level Analysis → Test Payload button**

#### Features

##### 📋 How It Works Explainer
A built-in guide that explains:
- How data is collected from all games on the page
- What the AI analyzes (predictions, Vegas lines, public betting, weather, Polymarket, etc.)
- What web search adds (real-time news, injuries, weather updates)
- What the AI returns (value picks, confidence scores, key factors, explanations)
- How publishing and Discord integration work

##### 🎮 Sample Games Preview
- Shows first 3 games that will be analyzed
- Displays game IDs, matchups, and key betting lines
- Indicates total number of games in the dataset

##### 📝 Editable System Prompt
- Displays the current page-level system prompt
- Allows editing for testing variations
- Copy button for easy prompt management
- Changes are for testing only (use main UI to save permanent changes)

##### 🚀 Test Generation
- "Generate Test Analysis" button triggers a full page-level run
- Shows loading state during generation
- Uses the current system prompt (including any test edits)
- Processes all games on the selected sport page

##### ✅ Generated Response Display
- Shows the full JSON response from OpenAI
- Includes all value picks with:
  - Recommended picks and bet types
  - Confidence scores (1-10)
  - Key factors used in the analysis
  - Detailed explanations with real-world context
- Summary text for the overall analysis
- Copy button for easy access to the raw JSON

#### How to Use

1. **Navigate to AI Settings**
   ```
   Admin Panel → AI Settings → Page-Level Analysis tab
   ```

2. **Open the Tester**
   - Click **"Test Payload"** button on NFL or CFB Value Finds card

3. **Review the Explainer**
   - Read the blue box at the top to understand the workflow

4. **Check Sample Games**
   - Verify which games will be included in the analysis

5. **Edit the Prompt (Optional)**
   - Modify the system prompt to test different instructions
   - Try asking for more/fewer picks
   - Adjust confidence thresholds
   - Change formatting requirements

6. **Generate Test Analysis**
   - Click **"Generate Test Analysis"**
   - Wait for the AI to complete (usually 30-60 seconds)
   - Review the generated Value Finds

7. **Evaluate Results**
   - Check if picks make sense given the data
   - Verify confidence scores are reasonable
   - Ensure explanations are clear and actionable
   - Copy the JSON if needed for further review

8. **Publish or Iterate**
   - If satisfied: Use "Generate Now" to create a live analysis
   - If not: Edit the prompt and test again
   - View results on Editors Picks page
   - Use Publish/Unpublish controls as needed

---

## API Changes

### New Service Function
```typescript
toggleValueFindPublished(
  valueFindId: string,
  published: boolean
): Promise<{ success: boolean; error?: string }>
```

### Updated Interface
```typescript
interface AIValueFind {
  id: string;
  sport_type: 'nfl' | 'cfb';
  analysis_date: string;
  value_picks: any[];
  analysis_json: any;
  summary_text: string;
  generated_at: string;
  generated_by: string | null;
  published: boolean; // NEW
}
```

---

## Database Schema

### Migration: `20251108000006_add_published_to_value_finds.sql`

```sql
-- Add published column
ALTER TABLE ai_value_finds 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;

-- Add indexes
CREATE INDEX idx_ai_value_finds_published 
ON ai_value_finds(published);

CREATE INDEX idx_ai_value_finds_sport_published 
ON ai_value_finds(sport_type, published);
```

---

## Testing Checklist

### Publish/Unpublish Feature
- [ ] Value Find is visible on Editors Picks page when published
- [ ] Value Find is hidden from regular users when unpublished
- [ ] Admin can see unpublished Value Finds with yellow badge
- [ ] Toggle button works correctly (Publish ↔ Unpublish)
- [ ] Toast notifications appear on status change
- [ ] State updates immediately without page refresh

### Payload Testing Tool
- [ ] "Test Payload" button appears on both NFL and CFB cards
- [ ] Modal opens with correct sport type
- [ ] Explainer section is clear and informative
- [ ] Sample games load correctly (shows up to 3 games)
- [ ] System prompt populates from current schedule config
- [ ] Prompt can be edited in the textarea
- [ ] "Generate Test Analysis" creates a new Value Find
- [ ] Generated response displays in formatted JSON
- [ ] Copy buttons work for both prompt and response
- [ ] Loading states show during generation
- [ ] Error handling works if generation fails

---

## Tips for Effective Use

### Optimizing System Prompts
1. Be specific about what constitutes "value" (e.g., >10% difference between model and Vegas)
2. Set clear confidence score guidelines (what makes a 9/10 vs 6/10)
3. Ask for specific data points to be highlighted (weather impact, injury concerns, etc.)
4. Request structured output with consistent formatting
5. Use the web search effectively by mentioning recent news, injuries, line movements

### Testing Workflow
1. **Test First**: Always use the payload tester before running live analysis
2. **Iterate**: Adjust prompts based on test results
3. **Review Unpublished**: Generate live analysis but leave unpublished initially
4. **Quality Check**: Verify picks make sense with your domain knowledge
5. **Publish**: Only publish after manual review

### Managing Published Content
- Unpublish outdated analyses after games start
- Keep the most recent analysis published
- Hide analyses if line movements invalidate the picks
- Review before big betting days (Sunday morning for NFL, Saturday for CFB)

---

## Troubleshooting

### Value Find Not Appearing
- Check if `published` is set to `true` in the database
- Verify you're looking at the correct sport page
- Ensure the analysis was generated successfully
- Check if there are any value_picks in the JSON

### Payload Tester Not Loading Games
- Verify the Supabase client has access to the data tables
- Check that games exist for the selected sport
- Look for console errors in browser dev tools

### Toggle Button Not Working
- Verify admin mode is enabled
- Check browser console for API errors
- Ensure RLS policies allow the current user to update `ai_value_finds`

---

## Related Documentation
- [AI System Implementation](./AI_SYSTEM_IMPLEMENTATION_COMPLETE.md)
- [AI Payload Viewer Guide](./AI_PAYLOAD_VIEWER_GUIDE.md)
- [Discord Integration Setup](./DISCORD_INTEGRATION_SETUP.md)

---

## Future Enhancements
- Scheduled auto-publish/unpublish based on game times
- Version history for Value Finds
- A/B testing different prompts
- Analytics on which Value Finds perform best
- Batch operations (publish/unpublish multiple at once)

