# The Odds API Key Setup

## Environment Variable Setup

The API key is now stored in environment variables for security.

### 1. Create `.env` File

Create a `.env` file in the project root (`/Users/chrishabib/Documents/new-wagerproof/.env`):

```bash
VITE_THE_ODDS_API_KEY=your_api_key_here
```

### 2. Netlify Environment Variables ✅

**Already configured!** The environment variable has been added in Netlify:
- **Key**: `VITE_THE_ODDS_API_KEY`
- **Value**: [Configured in Netlify dashboard]

The API key will be available in production builds automatically.

### 3. Restart Dev Server

After creating/updating `.env` file:
```bash
npm run dev
```

## Security Notes

- ✅ `.env` file is in `.gitignore` (won't be committed)
- ✅ API key is only used in client-side code (Vite prefix)
- ⚠️ Note: Vite env vars are exposed in client bundle (this is expected for The Odds API)

## Verification

Check browser console - you should NOT see:
```
⚠️ VITE_THE_ODDS_API_KEY not set in environment variables
```

If you see this warning, the env var is not loaded correctly.

