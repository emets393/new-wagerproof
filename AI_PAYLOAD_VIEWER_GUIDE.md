# AI Payload Viewer Guide

## Overview
The AI Payload Viewer is an admin tool for testing and managing AI completions for game cards. It allows you to view the exact data being sent to OpenAI, test prompt variations, and save successful prompts back to the database.

## How to Access
1. Enable Admin Mode (toggle in the sidebar)
2. Navigate to the NFL or CFB page
3. Click the purple **"AI Payload"** button on any game card
4. The Payload Viewer modal will open

## Features

### 1. View Game Data
- **Game ID**: Displays the unique identifier for the game
- **Data Payload**: See the complete JSON payload sent to OpenAI, including:
  - Game details (teams, date, time)
  - Vegas lines (spread, moneyline, over/under)
  - Weather conditions
  - Public betting splits
  - **Polymarket data** (moneyline, spread, and total odds)

### 2. Test AI Prompts

#### Base Prompt (Read-Only)
- Shows the current system prompt stored in the database
- This is the prompt that will be used for automatic completions
- Located in the gray box at the top of each tab

#### Test Prompt (Editable)
- Editable textarea where you can modify the prompt
- Test different variations without affecting the base prompt
- When you click **"Generate"**, this version is sent to OpenAI
- Located in the purple box below the base prompt

### 3. Generate Completions
1. Switch between **Spread Prediction** and **Over/Under Prediction** tabs
2. Edit the test prompt if desired (or leave as-is to test the base prompt)
3. Click the **"Generate"** button
4. Wait for the AI to generate a completion (includes web search)
5. The response appears in the green **"AI Generated Response"** section

### 4. Save Prompts
Once you've tested a prompt variation and are happy with the results:

1. Edit the **Test Prompt** to your desired version
2. Click the green **"Save as Base Prompt"** button (bottom right of the editable prompt)
3. The prompt will be saved to the database and become the new base prompt
4. Future automatic completions will use this new prompt
5. You'll see a success toast notification

**Important Notes:**
- Saved prompts immediately update the base prompt display
- All future AI generations for that widget type will use the new prompt
- The save button is disabled while loading or saving
- Empty prompts cannot be saved

### 5. View Responses
- AI-generated responses appear in the green-themed section
- Click **"Copy Response"** to copy the text to your clipboard
- Responses include web search results when available (injury reports, news, etc.)

### 6. Copy Payloads
- Click **"Copy Payload"** to copy the raw JSON data
- Useful for debugging or external testing

## Workflow Example

### Testing and Updating a Prompt

1. **Open Payload Viewer**
   ```
   Admin Mode → NFL Page → Click "AI Payload" on a game card
   ```

2. **Review Current Prompt**
   - Read the base prompt in the gray box
   - Note what instructions are currently being sent to GPT

3. **Test a Variation**
   - Edit the test prompt (purple box) to try a different approach
   - Example: Add "Focus on recent injury reports" or "Emphasize weather impact"
   - Click "Generate" to test the new prompt

4. **Review Results**
   - Check the AI-generated response in the green section
   - Evaluate if the new prompt produces better analysis

5. **Save if Satisfied**
   - If the response is good, click **"Save as Base Prompt"**
   - The new prompt becomes the default for all future completions
   - The base prompt display (gray box) will update to show the new saved version

6. **Test Again**
   - Generate another completion to verify the saved prompt works as expected
   - The editable prompt will still show your edited version until you reload

## Tips

- **Start with small changes**: Test minor prompt tweaks before making major rewrites
- **Use specific instructions**: GPT responds better to clear, specific guidance
- **Mention web search**: Prompt GPT to "search for recent news" or "check injury reports" to leverage the web search capability
- **Compare results**: Generate completions with the base prompt, then with your edited version to see the difference
- **Document your changes**: Note what prompted you to change the prompt and what improved

## Troubleshooting

### "Config ID not found" error
- This means the system couldn't find the configuration in the database
- Try refreshing the page and reopening the payload viewer
- Contact an admin if the issue persists

### "Prompt cannot be empty" error
- You tried to save an empty prompt
- Add text to the test prompt before saving

### Generated response shows as error
- Check the Supabase logs at: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions
- Click on `generate-ai-completion` to see detailed error messages
- Common issues: API key problems, rate limiting, or malformed prompts

### Polymarket data not loading
- The system will still generate completions, but with `polymarket: null` in the payload
- Check your network connection
- Verify the game teams match Polymarket's naming conventions

## Example Prompts

### Spread Prediction
```
You are an expert NFL analyst. Analyze the provided game data and search the web for:
- Recent injury reports for both teams
- Weather forecasts for the game location
- Latest news affecting either team

Explain in 2-3 sentences why the predicted team is likely to cover the spread.
Focus on data discrepancies (e.g., public betting vs. Vegas line).
Return JSON: {"explanation": "your analysis"}
```

### Over/Under Prediction
```
You are an expert NFL betting analyst. Review the game data and search for:
- Offensive/defensive matchup news
- Weather conditions impact on scoring
- Recent scoring trends for these teams

Provide a 2-3 sentence analysis of why the game is likely to go over or under.
Highlight any notable factors (weather, injuries, public betting mismatch).
Return JSON: {"explanation": "your analysis"}
```

## Database Schema

Prompts are stored in the `ai_completion_configs` table:
- `id`: Unique identifier
- `widget_type`: `'spread_prediction'` or `'ou_prediction'`
- `sport_type`: `'nfl'` or `'cfb'`
- `system_prompt`: The text instructions sent to GPT
- `enabled`: Whether this widget type should generate completions
- `updated_at`: Timestamp of last update
- `updated_by`: User ID who made the update (not yet implemented)

## Future Enhancements
- Version history for prompts (see what was changed over time)
- A/B testing different prompts
- Prompt templates library
- Batch generation for multiple games
- Prompt performance metrics (which prompts produce better results)

