# Sportsbook Configuration Update

## Changes Made

### Top 5 US Sportsbooks (Buttons)
Updated to show the **top 5 most used free US sportsbooks** as prominent buttons:

1. **DraftKings** (`draftkings`)
2. **FanDuel** (`fanduel`)
3. **BetMGM** (`betmgm`)
4. **BetRivers** (`betrivers`)
5. **ESPN BET** (`espnbet`)

### Additional Free US Sportsbooks (Dropdown)
All **free US bookmakers** are now available in the dropdown menu:

- BetOnline.ag (`betonlineag`)
- BetUS (`betus`)
- Bovada (`bovada`)
- LowVig.ag (`lowvig`)
- MyBookie.ag (`mybookieag`)
- Bally Bet (`ballybet`)
- BetAnything (`betanysports`)
- betPARX (`betparx`)
- Fliff (`fliff`)
- Hard Rock Bet (`hardrockbet`)

### Excluded (Paid Subscriptions)
The following bookmakers require paid subscriptions and are **not included**:
- Caesars (`williamhill_us`) - Only available on paid subscriptions
- Fanatics (`fanatics`) - Only available on paid subscriptions
- ReBet (`rebet`) - Only available on paid subscriptions

## Implementation Details

### API Fetching
- The component now fetches odds from **all free US bookmakers** at once
- This ensures we get betslip links for all available sportsbooks
- Top 5 are displayed as buttons, others appear in dropdown

### UI Updates
- Top 5 sportsbooks shown as prominent buttons
- Dropdown shows count of available additional sportsbooks: "More Sportsbooks (X)"
- Dropdown has scrollable content for many options
- Only shows sportsbooks that have available links for the specific game

## Reference
Based on The Odds API documentation: https://the-odds-api.com/sports-odds-data/bookmaker-apis.html#us-bookmakers

