# Mobile-Specific Features

> Last verified: December 2024

## Navigation Architecture

### Current Structure (VERIFIED)
```
app/
├── (auth)/              # Login, signup, forgot-password
├── (onboarding)/        # 16-step onboarding
├── (drawer)/            # Main app with side menu
│   └── (tabs)/         # Bottom tabs
│       ├── index.tsx   # Feed (all sports)
│       ├── picks.tsx   # Editor picks
│       ├── outliers.tsx # Betting anomalies
│       ├── scoreboard.tsx # Live scores (8 leagues)
│       ├── chat.tsx    # WagerBot (modal)
│       ├── settings.tsx # Hidden tab
│       └── feature-requests.tsx # Hidden tab
└── (modals)/            # Discord, secret-settings
```

### Tab Bar
- Custom floating tab bar (animated)
- 4 visible tabs: Feed, Picks, Outliers, Scores
- Hides on scroll down, shows on scroll up
- Chat accessed via side menu or modal

---

## Feed Screen

### Sport Tabs
All 4 sports are **fully live** (not "coming soon"):
- NFL, CFB, NBA, NCAAB

### Features
- Horizontal sport selector
- Search by team name
- Sort: Time, Spread, O/U
- Pull-to-refresh
- Per-sport caching (5 minutes)
- Parallel preloading all sports

### Data Sources
- NFL: `v_input_values_with_epa`
- CFB: `cfb_live_weekly_inputs`
- NBA: `nba_input_values_view`
- NCAAB: `v_cbb_input_values`

---

## Onboarding Flow

### Steps (UPDATED from docs)
1. PersonalizationIntro
2. **TermsAcceptance** (NEW)
3. SportsSelection
4. AgeConfirmation
5. BettorType
6. PrimaryGoal
7. Methodology2
8. FeatureSpotlight
9. CompetitorComparison
10. EmailOptIn
11. SocialProof
12. **DiscordCommunity** (NEW)
13. ValueClaim
14. AcquisitionSource
15. DataTransparency
16. **RevenueCatPaywall** (uses native V2 paywall)

### Components
- `OnboardingContext.tsx` - State management
- `OnboardingGuard.tsx` - Enforces completion
- `AnimatedGradientBackground` - Step-specific colors
- `ProgressIndicator` - With back button

---

## Live Scores (Scoreboard Tab)

### Supported Leagues (8)
1. NFL
2. NCAAF/CFB
3. NBA
4. NCAAB
5. NHL
6. MLB
7. MLS
8. EPL

### Features
- Games grouped by league
- Pull-to-refresh
- Prediction enrichment (hit/miss status)
- Tap for detail modal
- League icons (Material Community Icons)

---

## Bottom Sheets

### Sport-Specific Sheets
- `NFLGameBottomSheet.tsx` (32KB)
- `CFBGameBottomSheet.tsx` (50KB)
- `NBAGameBottomSheet.tsx` (38KB)
- `NCAABGameBottomSheet.tsx` (40KB)

### Context Management
```typescript
// Separate context per sport
<NFLGameSheetProvider>
  <CFBGameSheetProvider>
    <NBAGameSheetProvider>
      <NCAABGameSheetProvider>
        {children}
      </NCAABGameSheetProvider>
    </NBAGameSheetProvider>
  </CFBGameSheetProvider>
</NFLGameSheetProvider>
```

---

## Sportsbook Integration

### Component: `SportsbookButtons.tsx`
- Modal-based selection (mobile-optimized)
- Opens links via React Native `Linking`
- Used in Editor's Picks cards
- Compact mode support

### Configuration: `sportsbookConfig.ts`
- Top sportsbooks list
- Deep link URL patterns

---

## Features NOT in Mobile

### Tailing Feature
- Documented in web but **NOT implemented in mobile**
- Tables exist (`game_tails`) but no mobile components

### Ghost Blog
- Web only

### Mixpanel Analytics
- Web only

---

## RevenueCat (Mobile)

### Paywalls V2
```typescript
import { PaywallComponent } from 'react-native-purchases-ui';
await Purchases.presentPaywall();
```

### Customer Center
```typescript
await Purchases.presentCustomerCenter();
```

---

## Secret Settings

### Access
- Double-tap on specific area
- Easter egg for developers

### Features
- Onboarding reset
- Debug tools
- Test features

---

## Key Files

```
wagerproof-mobile/
├── app/(drawer)/(tabs)/_layout.tsx  # Tab configuration
├── contexts/OnboardingContext.tsx
├── contexts/*GameSheetContext.tsx
├── components/SideMenu.tsx
├── components/SportFilter.tsx
├── components/SportsbookButtons.tsx
└── components/OnboardingGuard.tsx
```
