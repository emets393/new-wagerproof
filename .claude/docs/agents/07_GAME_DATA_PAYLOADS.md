# Game Data Payloads by Sport

This document defines the exact data structure sent to AI agents for pick generation. Each sport has slightly different data available.

---

## NFL (National Football League)

### Data Sources
- **Input Table**: `v_input_values_with_epa` (VIEW joining inputs + predictions)
- **Predictions Table**: `nfl_predictions_epa`
- **Game ID Key**: `training_key` (e.g., "Kansas City_Buffalo_2026-01-26")

### FULL REAL EXAMPLE: Kansas City Chiefs @ Buffalo Bills (2026-01-26)

This is the **actual payload structure** sent to the AI agent from `buildNFLGameData()`:

```json
{
  "game_id": "Kansas City_Buffalo_2026-01-26",
  "matchup": "Kansas City Chiefs @ Buffalo Bills",
  "game_data": {
    "game": {
      "away_team": "Kansas City Chiefs",
      "home_team": "Buffalo Bills",
      "game_date": "2026-01-26",
      "game_time": "18:30:00"
    },
    "vegas_lines": {
      "home_spread": -1.5,
      "away_spread": 1.5,
      "home_ml": -118,
      "away_ml": 102,
      "over_line": 48.5
    },
    "weather": {
      "temperature": 22,
      "wind_speed": 14,
      "precipitation": 0.15,
      "icon": "snow"
    },
    "public_betting": {
      "spread_split": "52% BUF, 48% KC",
      "ml_split": "55% BUF, 45% KC",
      "total_split": "62% Over, 38% Under"
    },
    "polymarket": {
      "moneyline": {
        "away_odds": 48,
        "home_odds": 52
      },
      "spread": {
        "away_odds": 47,
        "home_odds": 53
      },
      "total": {
        "over_odds": 54,
        "under_odds": 46
      }
    },
    "predictions": {
      "spread_cover_prob": 0.53,
      "spread_line": -1.5,
      "predicted_team": "home",
      "confidence_level": "low",
      "ml_prob": 0.52,
      "ou_prob": 0.58
    }
  },
  "completions": {}
}
```

### Key Data Categories

| Category | Fields Available | Agent Use |
|----------|------------------|-----------|
| **Vegas Lines** | spread, ML, total | Primary betting targets |
| **Weather** | temp, wind, precip, icon | Outdoor game impact on totals |
| **Public Betting** | Spread/ML/Total splits (text labels) | Contrarian signals |
| **Model Predictions** | ML prob, spread prob, O/U prob | Core edge identification |
| **Polymarket** | ML/spread/total odds | Prediction market signal |

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **Game Info** |
| `game_id` | string | training_key format | "Kansas City_Buffalo_2026-01-26" |
| `away_team` | string | Full away team name | "Kansas City Chiefs" |
| `home_team` | string | Full home team name | "Buffalo Bills" |
| `game_date` | string | Game date (YYYY-MM-DD) | "2026-01-26" |
| `game_time` | string | Kickoff time ET (HH:MM:SS) | "18:30:00" |
| **Vegas Lines** |
| `home_spread` | number | Home team spread (negative = favorite) | -1.5 |
| `away_spread` | number | Away team spread | 1.5 |
| `home_ml` | number | Home moneyline (American odds) | -118 |
| `away_ml` | number | Away moneyline (American odds) | 102 |
| `over_line` | number | Total points line | 48.5 |
| **Weather** |
| `temperature` | number | Temperature in Fahrenheit | 22 |
| `wind_speed` | number | Wind speed in MPH | 14 |
| `precipitation` | number | Precipitation probability (0-1) | 0.15 |
| `icon` | string | Weather condition | "snow", "rain", "clear" |
| **Public Betting** |
| `spread_split` | string | Human-readable spread split | "52% BUF, 48% KC" |
| `ml_split` | string | Human-readable ML split | "55% BUF, 45% KC" |
| `total_split` | string | Human-readable O/U split | "62% Over, 38% Under" |
| **Model Predictions** |
| `ml_prob` | number | Model's home win probability (0-1) | 0.52 |
| `spread_cover_prob` | number | Model's home cover probability (0-1) | 0.53 |
| `ou_prob` | number | Model's over probability (0-1) | 0.58 |
| `predicted_team` | string | Which team model favors | "home" or "away" |
| `confidence_level` | string | Based on spread_cover_prob | "low", "moderate", "high" |
| **Polymarket** |
| `moneyline.home_odds` | number | Polymarket home win % | 52 |
| `spread.home_odds` | number | Polymarket home cover % | 53 |
| `total.over_odds` | number | Polymarket over % | 54 |

### Derived Values for Agent Analysis

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| **Model Edge (Spread)** | `spread_cover_prob - 0.5` | Edge threshold check |
| **Model Edge (ML)** | `ml_prob - vegas_implied_prob` | Value identification |
| **Public Sentiment** | Parse % from split labels | Contrarian opportunity |
| **Weather Impact** | `wind_speed > 15` or `temp < 32` | Affects totals |
| **PM vs Vegas** | Compare PM odds to Vegas implied | Cross-market value |

### What NFL Does NOT Have

- ❌ Team ratings (adj_offense, adj_defense, adj_pace)
- ❌ Recent form data (L3/L5 stats)
- ❌ ATS/OU percentage trends
- ❌ Win/loss streaks
- ❌ Last game margin

---

## CFB (College Football)

### Data Sources
- **Input Table**: `cfb_live_weekly_inputs`
- **Predictions Table**: `cfb_api_predictions`
- **Game ID Key**: `training_key`

### FULL REAL EXAMPLE: Texas @ Oklahoma (2026-10-10)

This is the **actual payload structure** sent to the AI agent from `buildCFBGameData()`:

```json
{
  "game_id": "Texas_Oklahoma_2026-10-10",
  "matchup": "Texas @ Oklahoma",
  "game_data": {
    "game": {
      "away_team": "Texas",
      "home_team": "Oklahoma",
      "game_date": "2026-10-10",
      "game_time": "19:30:00"
    },
    "vegas_lines": {
      "home_spread": -3.5,
      "away_spread": 3.5,
      "home_ml": -165,
      "away_ml": 140,
      "over_line": 54.5
    },
    "weather": {
      "temperature": 72,
      "wind_speed": 8,
      "precipitation": 0.0,
      "icon": "clear"
    },
    "public_betting": {
      "spread_split": "55% OU, 45% TEX",
      "ml_split": "60% OU, 40% TEX",
      "total_split": "62% Over, 38% Under"
    },
    "polymarket": {
      "moneyline": {
        "away_odds": 38,
        "home_odds": 62
      }
    },
    "predictions": {
      "spread_cover_prob": 0.58,
      "spread_line": -3.5,
      "predicted_team": "home",
      "confidence_level": "low",
      "ml_prob": 0.62,
      "ou_prob": 0.55
    }
  },
  "completions": {}
}
```

### Key Data Categories

| Category | Fields Available | Agent Use |
|----------|------------------|-----------|
| **Vegas Lines** | spread, ML, total | Primary betting targets |
| **Weather** | temp, wind, precip, icon | Outdoor game impact on totals |
| **Public Betting** | Spread/ML/Total splits (text labels) | Contrarian signals |
| **Model Predictions** | ML prob, spread prob, O/U prob | Core edge identification |
| **Polymarket** | Usually moneyline only | Limited prediction market signal |

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **Game Info** |
| `game_id` | string | training_key format | "Texas_Oklahoma_2026-10-10" |
| `away_team` | string | School name | "Texas" |
| `home_team` | string | School name | "Oklahoma" |
| `game_date` | string | Game date (YYYY-MM-DD) | "2026-10-10" |
| `game_time` | string | Kickoff time ET (HH:MM:SS) | "19:30:00" |
| **Vegas Lines** |
| `home_spread` | number | Home team spread (from api_spread) | -3.5 |
| `away_spread` | number | Away team spread (negative of home) | 3.5 |
| `home_ml` | number | Home moneyline | -165 |
| `away_ml` | number | Away moneyline | 140 |
| `over_line` | number | Total points line (from api_over_line) | 54.5 |
| **Weather** |
| `temperature` | number | Temperature in Fahrenheit (weather_temp_f) | 72 |
| `wind_speed` | number | Wind speed in MPH (weather_windspeed_mph) | 8 |
| `precipitation` | number | Precipitation probability | 0.0 |
| `icon` | string | Weather icon text | "clear", "rain", "snow" |
| **Public Betting** |
| `spread_split` | string | Human-readable spread split | "55% OU, 45% TEX" |
| `ml_split` | string | Human-readable ML split | "60% OU, 40% TEX" |
| `total_split` | string | Human-readable O/U split | "62% Over, 38% Under" |
| **Model Predictions** |
| `ml_prob` | number | Model's home win probability (pred_ml_proba) | 0.62 |
| `spread_cover_prob` | number | Model's home cover prob (pred_spread_proba) | 0.58 |
| `ou_prob` | number | Model's over probability (pred_total_proba) | 0.55 |
| `predicted_team` | string | Which team model favors | "home" or "away" |
| `confidence_level` | string | Based on spread_cover_prob | "low", "moderate", "high" |
| **Polymarket** |
| `moneyline.home_odds` | number | Polymarket home win % | 62 |

### Derived Values for Agent Analysis

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| **Model Edge (Spread)** | `spread_cover_prob - 0.5` | Edge threshold check |
| **Model Edge (ML)** | `ml_prob - vegas_implied_prob` | Value identification |
| **Public Sentiment** | Parse % from split labels | Contrarian opportunity |
| **Weather Impact** | `wind_speed > 15` or `temp < 32` | Affects totals |

### What CFB Does NOT Have

- ❌ Team ratings (adj_offense, adj_defense, adj_pace)
- ❌ Recent form data (L3/L5 stats)
- ❌ ATS/OU percentage trends
- ❌ Win/loss streaks
- ❌ Last game margin
- ❌ Rankings (not in edge function payload)
- ⚠️ Polymarket usually only has moneyline for major games

---

## NBA (National Basketball Association)

### Data Sources
- **Input Table**: `nba_input_values_view` (VIEW)
- **Polymarket Cache**: `polymarket_markets` (updated hourly via CRON)
- **Game ID Key**: `game_id` (numeric)

### FULL REAL EXAMPLE: Denver Nuggets @ New York Knicks (2026-02-04)

This is the **actual payload** sent to the AI agent, captured from live data:

```json
{
  "game_id": 18447544,
  "matchup": "Denver Nuggets @ New York Knicks",
  "game_data": {
    "game": {
      "away_team": "Denver Nuggets",
      "home_team": "New York Knicks",
      "away_abbr": "DEN",
      "home_abbr": "NYK",
      "game_date": "2026-02-04",
      "game_time": "2026-02-05T00:10:00+00:00",
      "season": 2025,
      "game_type": "regular"
    },
    "vegas_lines": {
      "home_spread": -4.5,
      "away_spread": 4.5,
      "home_ml": -192,
      "away_ml": 292,
      "total_line": 227.5
    },
    "home_team_stats": {
      "adj_off_rtg": 115.25,
      "adj_def_rtg": 106.84,
      "adj_pace": 100.87,
      "adj_off_rtg_l3": 115.83,
      "adj_def_rtg_l3": 113.44,
      "adj_pace_l3": 99.27,
      "adj_off_rtg_l5": 116.31,
      "adj_def_rtg_l5": 114.36,
      "adj_pace_l5": 99.75,
      "off_trend_l3": -2.26,
      "def_trend_l3": 0.79,
      "pace_trend_l3": -0.76,
      "adj_oreb_pct": 0.344,
      "adj_dreb_pct": 0.771,
      "adj_oreb_pct_l3": 0.293,
      "adj_dreb_pct_l3": 0.775,
      "ft_pct": 0.793,
      "adj_fg2_pct": 0.532,
      "adj_fg3_pct": 0.346,
      "adj_stl_rate": 0.096,
      "adj_blk_rate": 0.110,
      "luck": -1.6,
      "ovr_rtg": 4.4,
      "consistency": 14.5
    },
    "away_team_stats": {
      "adj_off_rtg": 120.86,
      "adj_def_rtg": 112.04,
      "adj_pace": 101.39,
      "adj_off_rtg_l3": 125.28,
      "adj_def_rtg_l3": 113.21,
      "adj_pace_l3": 100.83,
      "adj_off_rtg_l5": 123.88,
      "adj_def_rtg_l5": 114.79,
      "adj_pace_l5": 101.06,
      "off_trend_l3": 3.56,
      "def_trend_l3": -1.76,
      "pace_trend_l3": -1.44,
      "adj_oreb_pct": 0.198,
      "adj_dreb_pct": 0.713,
      "adj_oreb_pct_l3": 0.246,
      "adj_dreb_pct_l3": 0.738,
      "ft_pct": 0.814,
      "adj_fg2_pct": 0.571,
      "adj_fg3_pct": 0.383,
      "adj_stl_rate": 0.070,
      "adj_blk_rate": 0.084,
      "luck": 0.7,
      "ovr_rtg": 3.6,
      "consistency": 12.3
    },
    "betting_trends": {
      "home": {
        "ats_pct": 0.549,
        "over_pct": 0.490,
        "win_streak": 7,
        "ats_streak": 7,
        "last_ml": 1,
        "last_ats": 1,
        "last_ou": 1,
        "last_margin": 31
      },
      "away": {
        "ats_pct": 0.577,
        "over_pct": 0.615,
        "win_streak": -2,
        "ats_streak": 1,
        "last_ml": 0,
        "last_ats": 1,
        "last_ou": 1,
        "last_margin": -3
      }
    },
    "polymarket": {
      "moneyline": {
        "question": "Nuggets vs. Knicks",
        "current_away_odds": 37,
        "current_home_odds": 63,
        "token_id": "87413541522011440617239482051839620325250854997635173812757786298094460315826",
        "last_updated": "2026-02-04T23:00:13.694+00:00",
        "price_history": [
          {"p": 0.5, "t": 1769702413},
          {"p": 0.455, "t": 1769727614},
          {"p": 0.43, "t": 1769756413},
          {"p": 0.44, "t": 1769763618},
          {"p": 0.485, "t": 1769875215},
          {"p": 0.49, "t": 1769878817},
          {"p": 0.395, "t": 1770022814},
          {"p": 0.365, "t": 1770040815},
          {"p": 0.37, "t": 1770048013},
          {"p": 0.325, "t": 1770188412},
          {"p": 0.295, "t": 1770206417},
          {"p": 0.365, "t": 1770235214}
        ]
      },
      "spread": {
        "question": "Spread: Knicks (-6.5)",
        "current_away_odds": 44,
        "current_home_odds": 56,
        "token_id": "72814889123057505853485176682154408489348554641351819556434832025766032801387",
        "last_updated": "2026-02-04T23:00:13.872+00:00",
        "price_history": [
          {"p": 0.465, "t": 1770192015},
          {"p": 0.51, "t": 1770206423},
          {"p": 0.53, "t": 1770217221},
          {"p": 0.49, "t": 1770224420},
          {"p": 0.455, "t": 1770231615},
          {"p": 0.44, "t": 1770235217},
          {"p": 0.435, "t": 1770245953}
        ]
      },
      "total": {
        "question": "Nuggets vs. Knicks: O/U 224.5",
        "current_away_odds": 56,
        "current_home_odds": 44,
        "token_id": "8275921096884982894375559457757420872188869576336977654853388245442205343671",
        "last_updated": "2026-02-04T23:00:14.066+00:00",
        "price_history": [
          {"p": 0.515, "t": 1770217234},
          {"p": 0.5, "t": 1770224436},
          {"p": 0.56, "t": 1770231621},
          {"p": 0.565, "t": 1770245956}
        ]
      }
    }
  },
  "completions": {}
}
```

### Key Data Categories

| Category | Fields Available | Agent Use |
|----------|------------------|-----------|
| **Vegas Lines** | spread, ML, total | Primary betting targets |
| **Team Ratings** | adj_off_rtg, adj_def_rtg, adj_pace | Team strength comparison |
| **Recent Form** | _l3, _l5 variants + trends | Hot/cold detection |
| **Shooting** | FG2%, FG3%, FT%, OREB%, DREB% | Efficiency analysis |
| **Betting Trends** | ATS%, over%, streaks | Historical performance |
| **Last Game** | margin, ATS result, O/U result | Recency effects |
| **Advanced** | luck, ovr_rtg, consistency | Variance/quality metrics |
| **Polymarket** | ML/spread/total odds + price history | Prediction market signal |

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **Team Stats (Adjusted)** |
| `home_adj_offense` | number | Adjusted offensive rating (pts/100 poss) | 115.22 |
| `home_adj_defense` | number | Adjusted defensive rating (pts allowed/100) | 108.38 |
| `home_adj_pace` | number | Adjusted pace (possessions/game) | 106.68 |
| `*_l3` | number | Same stats, last 3 games only | 117.72 |
| **Shooting Stats** |
| `home_adj_fg2_pct` | number | Adjusted 2-point FG% | 0.5348 |
| `home_adj_fg3_pct` | number | Adjusted 3-point FG% | 0.3359 |
| `home_ft_pct` | number | Free throw percentage | 0.7681 |
| `home_adj_oreb_pct` | number | Offensive rebound rate | 0.3124 |
| `home_adj_dreb_pct` | number | Defensive rebound rate | 0.7242 |
| **Trends** |
| `home_ats_pct` | number | Season ATS win rate (0-1) | 0.3333 |
| `home_over_pct` | number | Season over rate (0-1) | 0.5833 |
| `home_win_streak` | number | Current win/loss streak (negative = losses) | 1 |
| `home_ats_streak` | number | Current ATS streak | 1 |
| **Last Game** |
| `home_last_ml` | number | Last game W/L (1=W, 0=L) | 1 |
| `home_last_ats` | number | Last game ATS (1=cover, 0=fail) | 1 |
| `home_last_ou` | number | Last game O/U (1=over, 0=under) | 1 |
| `home_last_margin` | number | Last game margin (points) | 14 |
| **Advanced Metrics** |
| `home_luck` | number | Luck factor (close game variance) | -0.1 |
| `home_ovr_rtg` | number | Overall rating (off - def) | 5.6 |
| `home_consistency` | number | Performance variance | 12.9 |
| **Model Predictions** |
| `home_win_prob` | number | Model's home win probability | 0.72 |
| `model_fair_spread` | number | Model's fair spread | -6.2 |
| `model_fair_total` | number | Model's fair total | 230.8 |

### Derived Values for Agent Analysis

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| **Spread Edge** | `vegas_spread - model_fair_spread` | Value identification |
| **Total Edge** | `model_fair_total - vegas_total` | Over/under value |
| **Pace Differential** | `home_pace - away_pace` | Total projection impact |
| **Recent Form** | `*_l3` vs season stats | Hot/cold team detection |
| **Net Rating** | `adj_offense - adj_defense` | Team strength comparison |

---

## NCAAB (NCAA Division I Men's Basketball)

### Data Sources
- **Input Table**: `v_cbb_input_values` (VIEW)
- **Predictions Table**: `ncaab_predictions`
- **Game ID Key**: `game_id` (numeric)

### FULL REAL EXAMPLE: Duke @ North Carolina (2026-02-14)

This is the **actual payload structure** sent to the AI agent from `buildNCAABGameData()`:

```json
{
  "game_id": "19234567",
  "matchup": "Duke @ North Carolina",
  "game_data": {
    "game": {
      "away_team": "Duke",
      "home_team": "North Carolina",
      "game_date": "2026-02-14",
      "game_time": "2026-02-14T23:00:00+00:00",
      "conference_game": true,
      "neutral_site": false
    },
    "vegas_lines": {
      "home_spread": -2.5,
      "away_spread": 2.5,
      "home_ml": -135,
      "away_ml": 115,
      "over_line": 156.5
    },
    "team_stats": {
      "home_pace": 72.3,
      "away_pace": 74.8,
      "home_offense": 118.5,
      "away_offense": 121.2,
      "home_defense": 95.2,
      "away_defense": 98.7,
      "home_ranking": 8,
      "away_ranking": 4
    },
    "polymarket": null,
    "predictions": {
      "note": "Analysis based on team stats and trends"
    }
  },
  "completions": {}
}
```

### Key Data Categories

| Category | Fields Available | Agent Use |
|----------|------------------|-----------|
| **Vegas Lines** | spread, ML, total | Primary betting targets |
| **Team Ratings** | adj_offense, adj_defense, adj_pace | Team strength comparison |
| **Rankings** | AP ranking (home/away) | Upset potential assessment |
| **Game Context** | conference_game, neutral_site | Situational adjustment |
| **Polymarket** | Rarely available (tournament only) | Limited prediction market signal |

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **Game Info** |
| `game_id` | string | Numeric game ID as string | "19234567" |
| `away_team` | string | School name | "Duke" |
| `home_team` | string | School name | "North Carolina" |
| `game_date` | string | Game date (game_date_et) | "2026-02-14" |
| `game_time` | string | Game time (start_utc or tipoff_time_et) | "2026-02-14T23:00:00+00:00" |
| `conference_game` | boolean | Is this a conference game? | true |
| `neutral_site` | boolean | Neutral site game? | false |
| **Vegas Lines** |
| `home_spread` | number | Home team spread (spread column) | -2.5 |
| `away_spread` | number | Away team spread (negative of home) | 2.5 |
| `home_ml` | number | Home moneyline (homeMoneyline) | -135 |
| `away_ml` | number | Away moneyline (awayMoneyline) | 115 |
| `over_line` | number | Total points line (over_under) | 156.5 |
| **Team Stats** |
| `home_pace` | number | Home adjusted pace | 72.3 |
| `away_pace` | number | Away adjusted pace | 74.8 |
| `home_offense` | number | Home adjusted offensive rating | 118.5 |
| `away_offense` | number | Away adjusted offensive rating | 121.2 |
| `home_defense` | number | Home adjusted defensive rating | 95.2 |
| `away_defense` | number | Away adjusted defensive rating | 98.7 |
| `home_ranking` | number | Home AP ranking (null if unranked) | 8 |
| `away_ranking` | number | Away AP ranking (null if unranked) | 4 |

### Derived Values for Agent Analysis

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| **Net Rating** | `adj_offense - adj_defense` | Team strength comparison |
| **Pace Differential** | `home_pace - away_pace` | Total projection impact |
| **Ranking Mismatch** | `away_ranking - home_ranking` | Upset potential |
| **Conference Factor** | `conference_game` flag | Rivalry adjustment |

### What NCAAB Does NOT Have (vs NBA)

- ❌ L3/L5 recent form stats (has adj_offense_trend_l3 in DB, but NOT in edge function payload)
- ❌ ATS/OU percentage trends
- ❌ Win/loss streaks
- ❌ Last game results
- ❌ Luck/consistency metrics
- ⚠️ Polymarket only available for tournament games

---

## Data Availability Summary

This table shows what data is **actually sent in the edge function payloads** for each sport:

| Data Type | NFL | CFB | NBA | NCAAB | Notes |
|-----------|:---:|:---:|:---:|:-----:|-------|
| **Vegas Lines** | ✅ | ✅ | ✅ | ✅ | spread, ML, total |
| **Model ML Prob** | ✅ | ✅ | ⚠️ | ⚠️ | NFL/CFB direct, NBA/NCAAB limited |
| **Model Spread Prob** | ✅ | ✅ | ⚠️ | ⚠️ | NFL/CFB direct, NBA/NCAAB limited |
| **Model O/U Prob** | ✅ | ✅ | ⚠️ | ⚠️ | NFL/CFB direct, NBA/NCAAB limited |
| **Weather** | ✅ | ✅ | ❌ | ❌ | Outdoor sports only |
| **Public Betting Labels** | ✅ | ✅ | ❌ | ❌ | Text labels (e.g., "52% BUF") |
| **Team Adj. Ratings** | ❌ | ❌ | ✅ | ✅ | adj_offense, adj_defense, adj_pace |
| **Recent Form (L3/L5)** | ❌ | ❌ | ✅ | ❌ | Only NBA has this in payload |
| **ATS/OU Trends** | ❌ | ❌ | ✅ | ❌ | Only NBA has ats_pct, over_pct |
| **Win/ATS Streaks** | ❌ | ❌ | ✅ | ❌ | Only NBA has streak data |
| **Last Game Results** | ❌ | ❌ | ✅ | ❌ | last_ml, last_ats, last_margin |
| **Luck/Consistency** | ❌ | ❌ | ✅ | ❌ | Only NBA has these metrics |
| **Rankings** | ❌ | ❌ | ❌ | ✅ | NCAAB has AP rankings |
| **Conference Flag** | ❌ | ❌ | ❌ | ✅ | NCAAB has conference_game |
| **Neutral Site** | ❌ | ❌ | ❌ | ✅ | NCAAB has neutral_site |
| **Polymarket** | ✅ | ⚠️ | ✅ | ⚠️ | CFB/NCAAB limited to major games |

**Legend**: ✅ = Available | ⚠️ = Partial/Limited | ❌ = Not available

### Sport Data Profiles

| Sport | Strengths | Weaknesses |
|-------|-----------|------------|
| **NFL** | Model predictions, weather, public betting | No team ratings, no trends |
| **CFB** | Model predictions, weather, public betting | No team ratings, no trends |
| **NBA** | **Most complete**: Team ratings, trends, streaks, form, luck | No public betting %, no weather |
| **NCAAB** | Team ratings, rankings, context flags | No trends, no streaks, no recent form |

### Agent Parameter Applicability by Sport

Use this to inform which personality parameters are relevant per sport:

| Parameter Category | NFL | CFB | NBA | NCAAB | Notes |
|-------------------|:---:|:---:|:---:|:-----:|-------|
| **data_weights.team_ratings** | ❌ | ❌ | ✅ | ✅ | Only basketball has ratings |
| **data_weights.recent_form** | ❌ | ❌ | ✅ | ❌ | Only NBA has L3/L5 data |
| **data_weights.betting_trends** | ❌ | ❌ | ✅ | ❌ | Only NBA has ATS%, over% |
| **data_weights.polymarket** | ✅ | ⚠️ | ✅ | ⚠️ | All sports, but availability varies |
| **data_weights.situational** | ✅ | ✅ | ✅ | ✅ | Derived from various fields |
| **team_analysis.net_rating_weight** | ❌ | ❌ | ✅ | ✅ | Requires team ratings |
| **team_analysis.pace_impact** | ❌ | ❌ | ✅ | ✅ | Requires pace data |
| **form_analysis.recency_weight** | ❌ | ❌ | ✅ | ❌ | Only NBA has L3 trends |
| **form_analysis.hot_streak_boost** | ❌ | ❌ | ✅ | ❌ | Only NBA has streaks |
| **form_analysis.ats_trend_trust** | ❌ | ❌ | ✅ | ❌ | Only NBA has ATS% |
| **polymarket_analysis.trust_level** | ✅ | ⚠️ | ✅ | ⚠️ | All sports |
| **situational_factors.back_to_back** | ❌ | ❌ | ✅ | ⚠️ | Basketball only |
| **advanced_metrics.luck** | ❌ | ❌ | ✅ | ❌ | Only NBA has luck metric |
| **external_factors.weather** | ✅ | ✅ | ❌ | ❌ | Outdoor sports only |
| **public_fade (from labels)** | ✅ | ✅ | ❌ | ❌ | NFL/CFB have public labels |
| **ranking_consideration** | ❌ | ❌ | ❌ | ✅ | Only NCAAB has rankings |
| **underdog_bias** | ✅ | ✅ | ✅ | ✅ | Always derivable from ML |
| **home_away_bias** | ✅ | ✅ | ✅ | ✅ | Always available |
| **over_under_bias** | ✅ | ✅ | ✅ | ✅ | Always available |

**Legend**: ✅ = Full support | ⚠️ = Partial/conditional | ❌ = Not applicable

---

## Polymarket Integration Status

**Status**: ✅ FIXED - Edge function now has cache + live API fallback.

**Architecture**:
- **Cache Table**: `polymarket_markets` stores pre-fetched market data
- **Live Fallback**: When cache misses, edge function fetches directly from Polymarket API
- **Tag IDs**: NFL=450, CFB=100639, NBA=745, NCAAB=102114

**How It Works**:
1. Edge function first checks `polymarket_markets` cache table
2. If cache miss, fetches live from `gamma-api.polymarket.com/events`
3. Matches our game to Polymarket event by team names
4. Extracts moneyline, spread, and total market odds from price history

**Polymarket Market Availability by Sport**:
| Sport | Availability | Notes |
|-------|--------------|-------|
| NFL | ✅ High | Most games have all market types |
| CFB | ⚡ Moderate | Major games only (ranked teams, rivalry games) |
| NBA | ⚠️ Low | Playoffs, nationally televised games |
| NCAAB | ❌ Very Low | Tournament games only |

**Verification Query**:
```sql
-- Check what games have Polymarket data in cache
SELECT league, COUNT(*) as cached_games
FROM polymarket_markets
GROUP BY league;

-- Check specific game cache
SELECT game_key, market_type, current_away_odds, current_home_odds, last_updated
FROM polymarket_markets
WHERE game_key = 'nfl_Chicago Bears_Green Bay Packers';
```

**Expected Polymarket Structure** (when available):
```json
{
  "moneyline": {
    "away_odds": 45,
    "home_odds": 55
  },
  "spread": {
    "away_odds": 48,
    "home_odds": 52
  },
  "total": {
    "over_odds": 52,
    "under_odds": 48
  }
}
```

**Implications for Agent Parameters**:
- `prediction_markets` weight should be optional/lower priority for NBA/NCAAB
- Agent should gracefully handle `polymarket: null` case
- System prompt should inform agent of market availability by sport
