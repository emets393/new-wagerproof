# Mobile Sportsbook Selection Feature Implementation

## Overview
Successfully implemented the sportsbook selection feature for mobile Editor's Picks, matching the website's functionality. Users can now tap "Place Bet" on a pick to see available sportsbooks and deep link directly to the event.

## Changes Made

### 1. Sportsbook Configuration ✅
**File**: `wagerproof-mobile/utils/sportsbookConfig.ts`
- Created a centralized configuration for sportsbooks (DraftKings, FanDuel, BetMGM, etc.)
- Matches the website's configuration for consistency
- Includes display names and keys mapping to The Odds API

### 2. Sportsbook Selection UI ✅
**File**: `wagerproof-mobile/components/SportsbookButtons.tsx`
- **"Place Bet" Button**: A primary action button that appears when betslip links are available.
- **Selection Modal**: A clean, native-feeling modal (using `Portal` and `Modal`) that lists available sportsbooks.
- **Deep Linking**: Uses `Linking.openURL` to take the user directly to the sportsbook app or website.
- **Theme Support**: Fully adapts to light and dark modes using `react-native-paper` themes.
- **Fallback Handling**: Gracefully handles cases where specific sportsbooks might not be in the config.

### 3. Integration with Editor Pick Cards ✅
**File**: `wagerproof-mobile/components/EditorPickCard.tsx`
- Integrated `SportsbookButtons` into the pick card.
- Conditional rendering: Only shows the button if valid `betslip_links` exist and the pick is published.
- Added styling to position the button at the bottom of the card, creating a clear call-to-action.

## How to Test
1. Open the mobile app and navigate to the "Picks" tab.
2. Find a pick that has been viewed on the website (so links are generated/saved in the database).
3. You should see a "Place Bet" button at the bottom of the card.
4. Tap it to open the sportsbook selection modal.
5. Tap a sportsbook to test the deep link.

