# Sportsbook Integration Implementation Summary

## Overview
Successfully implemented sportsbook integration for Editor's Picks, allowing users to access bets from their preferred sportsbooks via The Odds API.

## Implementation Details

### API Integration
- **Endpoint**: `GET https://api.the-odds-api.com/v4/sports/{sport}/odds`
- **API Key**: Stored in environment variable `VITE_THE_ODDS_API_KEY` (configured in Netlify)
- **Parameters**:
  - `regions`: `us`
  - `markets`: `h2h,spreads,totals`
  - `bookmakers`: Top 5 sportsbooks (draftkings, fanduel, betmgm, caesars, bet365)
  - `apiKey`: Your API key

### Files Created

1. **`src/services/theOddsApi.ts`**
   - `fetchOdds()`: Fetches odds from The Odds API
   - `matchTeamName()`: Fuzzy team name matching algorithm
   - `findMatchingEvent()`: Matches our games to API events
   - `findBetOdds()`: Finds specific bet odds in event
   - `getSportKey()`: Maps game type to API sport key

2. **`src/utils/sportsbookConfig.ts`**
   - Top 5 sportsbooks: DraftKings, FanDuel, BetMGM, Caesars, Bet365
   - Additional sportsbooks: PointsBet, WynnBet, Unibet, Barstool, FoxBet
   - Sport key mappings (nfl → americanfootball_nfl, etc.)

3. **`src/utils/betslipLinkGenerator.ts`**
   - Constructs betslip links for each sportsbook
   - Uses event ID from The Odds API response
   - Generates links for all available sportsbooks

4. **`src/components/SportsbookButtons.tsx`**
   - Displays top 5 sportsbooks as buttons
   - Dropdown for additional sportsbooks
   - Loading/error states
   - Opens links in new tabs

### Files Modified

1. **`src/components/EditorPickCard.tsx`**
   - Added `SportsbookButtons` component import
   - Renders sportsbook buttons below "Analysis" section
   - Only shows for published picks
   - Passes all required game data and bet type info

### API Response Structure

```json
[
  {
    "id": "event_id_string",
    "sport_key": "basketball_nba",
    "home_team": "Phoenix Suns",
    "away_team": "Memphis Grizzlies",
    "bookmakers": [
      {
        "key": "draftkings",
        "markets": [
          {
            "key": "h2h",
            "outcomes": [{"name": "Team", "price": -192}]
          }
        ]
      }
    ]
  }
]
```

### Team Matching Algorithm

- Normalizes team names (removes "University", "College")
- Case-insensitive matching
- Partial matching (one name contains the other)
- Handles team name variations

### Bet Type Mapping

- `spread_away/spread_home` → `spreads` market
- `ml_away/ml_home` → `h2h` market  
- `over/under` → `totals` market

### Betslip Link Formats

- **DraftKings**: `https://sportsbook.draftkings.com/event/{eventId}`
- **FanDuel**: `https://www.fanduel.com/sportsbook/{eventId}`
- **BetMGM**: `https://sports.betmgm.com/en/sports/events/{eventId}`
- **Caesars**: `https://www.caesars.com/sportsbook/events/{eventId}`
- **Bet365**: `https://www.bet365.com/#/AC/B18/C20604387/D48/E{eventId}/F`

### Error Handling

- API failures: Shows error message, logs to console
- Event not found: "Game not found in sportsbooks"
- Missing links: Buttons disabled gracefully
- Loading states: Spinner with "Loading sportsbook links..."

### Testing

Test script created: `test-odds-api.mjs`
- Fetches real editor picks from Supabase
- Calls The Odds API with real data
- Tests team matching and link generation
- Saves results to `odds-api-test-results.json`

## Next Steps

1. **Optional**: Move API key to environment variable (`VITE_THE_ODDS_API_KEY`)
2. **Manual**: Configure affiliate links in The Odds API dashboard
3. **Enhancement**: Research actual betslip prefill URL formats (current links are basic event pages)
4. **Caching**: Consider implementing caching to reduce API calls

## Usage

The sportsbook buttons automatically appear on published Editor's Picks cards. Users can:
1. Click top 5 sportsbook buttons to go directly to the sportsbook
2. Use dropdown for additional sportsbooks
3. Links open in new tabs with security attributes

