# AI Completion System - Testing Guide

## ✅ Setup Complete

- Database tables created
- OpenAI API key configured
- Edge functions deployed:
  - `generate-ai-completion`
  - `check-missing-completions`
  - `generate-page-level-analysis`

---

## 🧪 How to Test a Single Game Card Completion

### Method 1: Using the Payload Viewer (Recommended)

This is the easiest way to test individual completions:

1. **Enable Admin Mode**
   - Make sure you're logged in as an admin
   - Toggle Admin Mode ON in the header

2. **Go to NFL Page**
   - Navigate to the NFL predictions page
   - You'll see game cards for upcoming games

3. **Click "View AI Payload" Button**
   - Each game card now has a purple **"AI Payload"** button in the top-right
   - Click it to open the Payload Viewer modal

4. **Test the Completion**
   - The modal shows two tabs: "Spread Prediction" and "Over/Under Prediction"
   - Each tab shows the exact JSON payload that will be sent to GPT
   - Click the **"Generate"** button to trigger AI completion for that specific widget
   - The button will show "Generating..." while it's working
   - You'll get a toast notification when done

5. **Verify the Result**
   - Close the modal
   - Expand the game card (click "Show More Details")
   - Scroll to the "What This Means" section under predictions
   - You should now see the AI-generated explanation instead of the static text

---

## 🔍 Method 2: Using Browser Console

For more technical testing, you can call the service directly:

```javascript
// Open browser console (F12)

// Import the service (if in React context)
import { generateCompletion } from '@/services/aiCompletionService';

// Test a completion
const result = await generateCompletion(
  'game_id_here',           // Replace with actual game ID
  'nfl',                    // or 'cfb'
  'spread_prediction',      // or 'ou_prediction'
  {
    game: { away_team: "Chiefs", home_team: "Bills", ... },
    predictions: { ... },
    vegas_lines: { ... },
    // ... rest of payload
  }
);

console.log(result);
```

---

## 🎯 What to Look For

### Successful Test

✅ **Payload Viewer Shows:**
- Clean JSON payload with all game data
- "Generate" button works without errors
- Toast shows "Completion Generated"

✅ **Game Card Shows:**
- AI-generated text in "What This Means" section
- Text is contextual and mentions specific teams/numbers
- Different from the static fallback text

### Troubleshooting

❌ **If you see errors:**

1. **Check Supabase Logs**
   - Go to: https://supabase.com/dashboard/project/gnjrklxotmbvnxbnnqgq/functions
   - Click on `generate-ai-completion`
   - View the Logs tab

2. **Common Issues:**
   - **"OPENAI_API_KEY not configured"** → API key not set correctly
   - **"No config found"** → Default prompts not seeded in database
   - **Network errors** → Edge function not deployed properly

3. **Check Database Tables**
   ```sql
   -- Check if config exists
   SELECT * FROM ai_completion_configs WHERE sport_type = 'nfl';
   
   -- Check if completion was created
   SELECT * FROM ai_completions ORDER BY generated_at DESC LIMIT 5;
   ```

---

## 📊 Testing Checklist

- [ ] Admin mode is enabled
- [ ] NFL page loads with game cards
- [ ] "AI Payload" button appears on cards
- [ ] Payload viewer opens with correct data
- [ ] "Generate" button triggers completion
- [ ] Success toast appears
- [ ] AI text appears in "What This Means" section
- [ ] Text is different from static fallback
- [ ] Text mentions specific teams and game details

---

## 🔄 Testing Multiple Cards

Once you've tested one card successfully:

1. **Test another card** using the same process
2. **Verify caching** - Click "Generate" again on the same card:
   - Should return immediately
   - Toast says "Returned cached completion"
   - No new API call to OpenAI

3. **Test both widget types**:
   - Generate spread prediction
   - Generate over/under prediction
   - Both should work independently

---

## 🚀 Next Steps After Testing

Once single-card testing works:

1. **Test bulk generation** - Run the check-missing-completions function
2. **Test page-level analysis** - Generate Value Finds
3. **Integrate College Football** - Same pattern as NFL
4. **Build Admin Panel UI** - Full configuration interface
5. **Set up Discord webhook** - Auto-post value finds

---

## 💡 Tips

- **Start with one game** that has complete data (weather, public betting, etc.)
- **Check the payload** before generating - make sure all fields are populated
- **Use the browser console** to see any JavaScript errors
- **Check Supabase logs** for backend errors
- **Regenerate if needed** - Completions can be overwritten by generating again

---

## 🐛 Debug Mode

If you need more visibility, add this to browser console:

```javascript
localStorage.setItem('debug', 'wagerproof:*');
```

This will show all debug logs from the app, including AI completion calls.

