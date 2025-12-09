# Sports & Predictions

> Last verified: December 2024

## Overview

WagerProof provides game predictions, live scores, and betting analytics for four major sports: NFL, CFB (College Football), NBA, and NCAAB (College Basketball).

---

## Architecture Comparison

| Feature | Web | Mobile |
|---------|-----|--------|
| **Sports Pages** | Separate page per sport | Unified Feed with sport tabs |
| **Game Details** | Modal dialogs | Bottom sheets |
| **Live Scores** | Marquee ticker | Full Scoreboard tab (8 leagues) |
| **Polymarket** | Widget on pages | Widget + Feed integration |
| **Caching** | sessionStorage + React Query | In-memory per-sport cache |

---

## Database Tables (Verified)

| Sport | Input Data | Predictions |
|-------|------------|-------------|
| **NFL** | `v_input_values_with_epa` | `nfl_predictions_epa` |
| **CFB** | `cfb_live_weekly_inputs` | `cfb_api_predictions` |
| **NBA** | `nba_input_values_view` | `nba_predictions` |
| **NCAAB** | `v_cbb_input_values` | `ncaab_predictions` |

### Additional Tables
- `production_weather` - Weather for NFL
- `live_scores` - Real-time scores
- `polymarket_markets` / `polymarket_events` - Polymarket cache

---

## Web Implementation

### Sport Pages
- `NFL.tsx` (93KB), `CollegeFootball.tsx` (95KB)
- `NBA.tsx` (75KB), `NCAAB.tsx` (82KB)
- `TodayInSports.tsx` (117KB) - Live dashboard

### Key Components
- `NFLGameCard.tsx` - With Aurora/ShineBorder effects
- `GameDetailsModal.tsx` (119KB) - Full details
- `LiveScoreTicker.tsx` - Marquee ticker
- `PolymarketWidget.tsx` - Prediction markets

---

## Mobile Implementation

### Navigation
```
app/(drawer)/(tabs)/
├── index.tsx      # Feed (all 4 sports)
├── scoreboard.tsx # 8 leagues
├── picks.tsx      # Editor picks
└── outliers.tsx   # Anomalies
```

### Components
- `*GameCard.tsx` - Per sport
- `*GameBottomSheet.tsx` - Detail sheets
- `LiveScoreCard.tsx` / `LiveScoreDetailModal.tsx`

### Bottom Sheet Contexts
Separate context per sport: `NFLGameSheetContext`, `CFBGameSheetContext`, etc.

---

## Live Scores

### Web: Marquee Ticker
- Auto-scrolling, hover to pause
- 2-minute refresh

### Mobile: Full Scoreboard Tab
8 leagues: NFL, NCAAF, NBA, NCAAB, NHL, MLB, MLS, EPL

---

## Polymarket Integration

### Supported
NFL, CFB, NBA, NCAAB

### Cache Tables
- `polymarket_markets` - Game markets
- `polymarket_events` - Event lists (24h TTL)

### Service
Cache-first strategy with live API fallback

---

## Key Files

**Web**: `src/pages/NFL.tsx`, `src/services/polymarketService.ts`
**Mobile**: `wagerproof-mobile/services/gameDataService.ts`
