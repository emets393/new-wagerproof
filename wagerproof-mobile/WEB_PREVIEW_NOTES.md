# Web Preview - What You'll See

## Current Features (Phase 1 Complete)

When the web app opens, you'll see:

### 🏠 Home Screen (Default)
- Welcome header with "Welcome to WagerProof"
- 4 feature cards:
  - 🏈 NFL Predictions
  - 🏆 College Football
  - 📊 Live Scores
  - 🤖 WagerBot

### 📱 Bottom Navigation (5 Tabs)
Click through the tabs at the bottom:

1. **Home** - Welcome screen (what you see first)
2. **NFL** - Placeholder with "Coming Soon" and feature list
3. **CFB** - Placeholder with "Coming Soon" and feature list
4. **Scores** - Placeholder with filter chips (All, NFL, CFB, NBA)
5. **More** - Settings menu with:
   - Account section (Profile, Settings, Sign Out)
   - Features section (WagerBot, Bet Slip Grader, Analytics, Editors' Picks)
   - About section (Learn, Feature Requests, Discord)

### 🎨 Theme
- Default: Light mode (white background, honeydew green accents)
- Toggle your system dark mode to see the dark theme automatically switch!
- Honeydew green (#22c55e) as primary color throughout

## What's Working

✅ Navigation between all 5 tabs
✅ Material Design UI with React Native Paper
✅ Responsive layout
✅ Dark mode support (automatic)
✅ Beautiful card layouts
✅ List items with icons

## What's Coming Next

Phase 2 will add:
- 🔐 Login/Signup screens
- 🛡️ Protected routes
- ⚙️ Functional settings
- 📊 Real NFL data

Phase 3 will add:
- 🏈 NFL predictions page with game cards
- 🏆 CFB predictions page
- 📊 Live scores
- 🤖 WagerBot chat
- And more!

## Known Issues

1. **No real data yet** - Everything is placeholder content
2. **No authentication** - Sign out just clears state (no actual auth yet)
3. **Animations disabled** - Reanimated temporarily removed to fix plugin conflict
4. **No Supabase connection** - Need to add `.env` file with credentials

## How to Test

1. **Navigate** - Click through all 5 tabs
2. **Dark Mode** - Toggle system dark mode to see theme change
3. **Responsive** - Resize browser window to see layout adapt
4. **More Menu** - Check out all the menu items in the "More" tab

## Next Steps

1. Add `.env` file with Supabase credentials
2. Create login/signup screens
3. Start migrating NFL predictions page
4. Add real data fetching

---

**Server running at:** http://localhost:8081 or http://localhost:19006

Press `Ctrl+C` in terminal to stop the server.

