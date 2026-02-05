# Agent Personality Parameters

This document defines all configurable parameters for AI betting agents. Parameters are organized as a conditional flow based on sport selection.

**Total: 31 parameters** (27 structured + 4 text)

---

## Parameter Flow Overview

```
STEP 1: Sport Selection (required)
    ↓
STEP 2: Core Personality (always shown)
    ↓
STEP 3: Bet Selection (always shown)
    ↓
STEP 4: Data Source Trust (always + conditional)
    ↓
STEP 5: Game Conditions (conditional)
    ↓
STEP 6: Trends & Form (conditional)
    ↓
STEP 7: Situational (conditional)
    ↓
STEP 8: Custom Insights (always shown, optional)
```

---

## STEP 1: SPORT SELECTION (Required)

**"Which sports should this agent analyze?"**

```typescript
preferred_sports: ('nfl' | 'cfb' | 'nba' | 'ncaab')[];  // Multi-select, at least 1 required
```

| Selection | Unlocks Additional Questions |
|-----------|------------------------------|
| NFL | Weather, Public Betting |
| CFB | Weather, Public Betting |
| NBA | Team Ratings, Form, Trends, Back-to-Back |
| NCAAB | Team Ratings, Rankings, Back-to-Back |

---

## STEP 2: CORE PERSONALITY (Always shown)

These define the agent's fundamental betting identity.

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 1 | `risk_tolerance` | number | 1-5 | 1=Conservative, 5=Aggressive |
| 2 | `underdog_lean` | number | 1-5 | 1=Favorites only, 3=Neutral, 5=Dogs only |
| 3 | `over_under_lean` | number | 1-5 | 1=Unders, 3=Neutral, 5=Overs |
| 4 | `confidence_threshold` | number | 1-5 | 1=Bet often (55%+), 5=Very selective (75%+) |
| 5 | `chase_value` | boolean | - | true=Hunt big edges, false=Prefer safer picks |

### UI Prompts

| Parameter | Question |
|-----------|----------|
| risk_tolerance | "How aggressive should your agent be?" |
| underdog_lean | "Does your agent prefer favorites or underdogs?" |
| over_under_lean | "Does your agent lean toward overs or unders?" |
| confidence_threshold | "How selective should your agent be?" |
| chase_value | "Should your agent chase big edges or play it safe?" |

---

## STEP 3: BET SELECTION (Always shown)

Controls what types of bets and at what odds.

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 6 | `preferred_bet_type` | enum | - | `spread` \| `moneyline` \| `total` \| `any` |
| 7 | `max_favorite_odds` | number | null or -100 to -500 | Won't lay worse than this (e.g., -200) |
| 8 | `min_underdog_odds` | number | null or +100 to +500 | Won't take dogs shorter than this (e.g., +150) |
| 9 | `max_picks_per_day` | number | 1-5 | 1=Max 2 picks, 3=Max 5, 5=Unlimited |
| 10 | `skip_weak_slates` | boolean | - | true=OK with 0 picks on weak days |

### UI Prompts

| Parameter | Question |
|-----------|----------|
| preferred_bet_type | "What's your preferred bet type?" |
| max_favorite_odds | "What's the most juice you'll lay on a favorite?" |
| min_underdog_odds | "What's the minimum plus-money you'll take on a dog?" |
| max_picks_per_day | "How many picks per day maximum?" |
| skip_weak_slates | "Is it OK to pass on days with no good plays?" |

### Line Range Examples

| Bettor Type | max_favorite_odds | min_underdog_odds |
|-------------|-------------------|-------------------|
| Plus money hunter | -110 | +100 |
| Chalk grinder | -400 | null (any) |
| Balanced | -200 | null (any) |
| Big dog hunter | null (any) | +200 |

---

## STEP 4: DATA SOURCE TRUST (Always + Conditional)

### Always Shown

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 11 | `trust_model` | number | 1-5 | Trust in WagerProof ML predictions |
| 12 | `trust_polymarket` | number | 1-5 | Trust in prediction market odds |
| 13 | `polymarket_divergence_flag` | boolean | - | true=Flag when PM differs 10%+ from Vegas |

### If NFL or CFB Selected

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 14 | `fade_public` | boolean | - | true=Bet against heavy public sides |
| 15 | `public_threshold` | number | 1-5 | 1=Fade 60%+, 5=Fade 80%+ only |

> **Note:** `public_threshold` only shown if `fade_public` = true

### UI Prompts

| Parameter | Question |
|-----------|----------|
| trust_model | "How much should your agent trust the WagerProof model?" |
| trust_polymarket | "How much should your agent trust Polymarket odds?" |
| polymarket_divergence_flag | "Flag games where Polymarket disagrees with Vegas?" |
| fade_public | "Should your agent bet against heavy public sides?" |
| public_threshold | "How lopsided should public betting be before fading?" |

---

## STEP 5: GAME CONDITIONS (Conditional)

### If NFL or CFB Selected

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 16 | `weather_impacts_totals` | boolean | - | true=Adjust totals for bad weather |
| 17 | `weather_sensitivity` | number | 1-5 | 1=Slight adjustment, 5=Heavy adjustment |

> **Note:** `weather_sensitivity` only shown if `weather_impacts_totals` = true

### If NBA or NCAAB Selected

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 18 | `trust_team_ratings` | number | 1-5 | How much to weight adj off/def/pace |
| 19 | `pace_affects_totals` | boolean | - | true=Use pace differential for O/U picks |

### UI Prompts

| Parameter | Question |
|-----------|----------|
| weather_impacts_totals | "Should weather affect total predictions?" |
| weather_sensitivity | "How much should weather impact the analysis?" |
| trust_team_ratings | "How much should your agent trust team efficiency ratings?" |
| pace_affects_totals | "Should pace factor into over/under analysis?" |

---

## STEP 6: TRENDS & FORM (Conditional)

### If NBA Selected

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 20 | `weight_recent_form` | number | 1-5 | 1=Season stats, 5=Last 3 games only |
| 21 | `ride_hot_streaks` | boolean | - | true=Back teams on win streaks |
| 22 | `fade_cold_streaks` | boolean | - | true=Fade teams on losing streaks |
| 23 | `trust_ats_trends` | boolean | - | true=Factor in historical ATS % |
| 24 | `regress_luck` | boolean | - | true=Fade lucky teams, back unlucky ones |

### UI Prompts

| Parameter | Question |
|-----------|----------|
| weight_recent_form | "How much should recent games matter vs season stats?" |
| ride_hot_streaks | "Should your agent ride teams on winning streaks?" |
| fade_cold_streaks | "Should your agent fade teams on losing streaks?" |
| trust_ats_trends | "Should ATS history factor into spread picks?" |
| regress_luck | "Should your agent expect lucky teams to regress?" |

---

## STEP 7: SITUATIONAL (Conditional)

### Always Shown

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 25 | `home_court_boost` | number | 1-5 | 1=Ignore home advantage, 5=Weight heavily |

### If NBA or NCAAB Selected

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 26 | `fade_back_to_backs` | boolean | - | true=Fade teams on back-to-back games |

### If NCAAB Selected

| # | Parameter | Type | Range | Description |
|---|-----------|------|-------|-------------|
| 27 | `upset_alert` | boolean | - | true=Flag ranked vs unranked mismatches |

### UI Prompts

| Parameter | Question |
|-----------|----------|
| home_court_boost | "How much should home court advantage matter?" |
| fade_back_to_backs | "Should your agent fade back-to-back games?" |
| upset_alert | "Should your agent flag potential upsets based on rankings?" |

---

## STEP 8: CUSTOM INSIGHTS (Always shown, optional)

Free-text fields that let users teach their agent personal edges and preferences. The AI incorporates these into its analysis.

### 28. betting_philosophy
**Type:** text (max 500 chars)
**Prompt:** *"Describe your overall betting philosophy in a few sentences."*

**Examples:**
- "I believe in fading public overreactions after big wins or losses. The market overcorrects."
- "I'm a contrarian. When everyone loves a team, I look for reasons to go the other way."
- "Trust the math. If the model says there's value, take it regardless of narratives."

---

### 29. perceived_edges
**Type:** text (max 500 chars)
**Prompt:** *"What specific edges or patterns do you believe in?"*

**Examples:**
- "Home underdogs in primetime games are consistently undervalued."
- "Teams coming off a blowout loss tend to bounce back hard the next game."
- "West coast teams playing early east coast games struggle in the first half."
- "Division rivals always play close regardless of the spread."

---

### 30. avoid_situations
**Type:** text (max 300 chars)
**Prompt:** *"Are there any teams, matchups, or situations you want to avoid entirely?"*

**Examples:**
- "Never bet on or against my hometown Bears - too emotional."
- "Avoid player prop markets, stick to game lines only."
- "Skip Thursday Night Football games, too unpredictable."
- "Don't touch games with a total over 240."

---

### 31. target_situations
**Type:** text (max 300 chars)
**Prompt:** *"Any specific spots you want the agent to always flag or prioritize?"*

**Examples:**
- "Always flag when Polymarket and Vegas disagree by more than 10%."
- "Love SEC night games - prioritize those."
- "Look for road favorites in the NBA, they're often undervalued."
- "Highlight any game where the model shows 60%+ edge."

---

## Complete TypeScript Interface

```typescript
interface AgentPersonality {
  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: SPORT SELECTION
  // ═══════════════════════════════════════════════════════════════════
  preferred_sports: ('nfl' | 'cfb' | 'nba' | 'ncaab')[];

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: CORE PERSONALITY (always)
  // ═══════════════════════════════════════════════════════════════════
  risk_tolerance: 1 | 2 | 3 | 4 | 5;
  underdog_lean: 1 | 2 | 3 | 4 | 5;
  over_under_lean: 1 | 2 | 3 | 4 | 5;
  confidence_threshold: 1 | 2 | 3 | 4 | 5;
  chase_value: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: BET SELECTION (always)
  // ═══════════════════════════════════════════════════════════════════
  preferred_bet_type: 'spread' | 'moneyline' | 'total' | 'any';
  max_favorite_odds: number | null;      // e.g., -200 or null for no limit
  min_underdog_odds: number | null;      // e.g., +150 or null for no limit
  max_picks_per_day: 1 | 2 | 3 | 4 | 5;
  skip_weak_slates: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: DATA SOURCE TRUST (always + conditional)
  // ═══════════════════════════════════════════════════════════════════
  trust_model: 1 | 2 | 3 | 4 | 5;
  trust_polymarket: 1 | 2 | 3 | 4 | 5;
  polymarket_divergence_flag: boolean;

  // NFL/CFB only
  fade_public?: boolean;
  public_threshold?: 1 | 2 | 3 | 4 | 5;  // only if fade_public=true

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: GAME CONDITIONS (conditional)
  // ═══════════════════════════════════════════════════════════════════
  // NFL/CFB only
  weather_impacts_totals?: boolean;
  weather_sensitivity?: 1 | 2 | 3 | 4 | 5;  // only if weather_impacts_totals=true

  // NBA/NCAAB only
  trust_team_ratings?: 1 | 2 | 3 | 4 | 5;
  pace_affects_totals?: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: TRENDS & FORM (NBA only)
  // ═══════════════════════════════════════════════════════════════════
  weight_recent_form?: 1 | 2 | 3 | 4 | 5;
  ride_hot_streaks?: boolean;
  fade_cold_streaks?: boolean;
  trust_ats_trends?: boolean;
  regress_luck?: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 7: SITUATIONAL (conditional)
  // ═══════════════════════════════════════════════════════════════════
  home_court_boost: 1 | 2 | 3 | 4 | 5;   // always
  fade_back_to_backs?: boolean;           // NBA/NCAAB only
  upset_alert?: boolean;                  // NCAAB only

  // ═══════════════════════════════════════════════════════════════════
  // STEP 8: CUSTOM INSIGHTS (always, optional)
  // ═══════════════════════════════════════════════════════════════════
  betting_philosophy?: string;   // max 500 chars
  perceived_edges?: string;      // max 500 chars
  avoid_situations?: string;     // max 300 chars
  target_situations?: string;    // max 300 chars
}
```

---

## Parameter Count by Sport Selection

| Sports Selected | Total Questions |
|-----------------|-----------------|
| NFL only | 19 |
| CFB only | 19 |
| NBA only | 24 |
| NCAAB only | 21 |
| NFL + NBA | 26 |
| All 4 sports | 29 |

> **Note:** Custom insights (4 text fields) are always available but optional, so not counted in required questions.

---

## Conditional Logic Summary

```typescript
// Show public betting questions
if (preferred_sports.includes('nfl') || preferred_sports.includes('cfb')) {
  show: fade_public, public_threshold
}

// Show weather questions
if (preferred_sports.includes('nfl') || preferred_sports.includes('cfb')) {
  show: weather_impacts_totals, weather_sensitivity
}

// Show team ratings questions
if (preferred_sports.includes('nba') || preferred_sports.includes('ncaab')) {
  show: trust_team_ratings, pace_affects_totals
}

// Show trends & form questions (NBA has richest data)
if (preferred_sports.includes('nba')) {
  show: weight_recent_form, ride_hot_streaks, fade_cold_streaks,
        trust_ats_trends, regress_luck
}

// Show back-to-back question
if (preferred_sports.includes('nba') || preferred_sports.includes('ncaab')) {
  show: fade_back_to_backs
}

// Show upset alert question
if (preferred_sports.includes('ncaab')) {
  show: upset_alert
}

// Nested conditionals
if (fade_public === true) {
  show: public_threshold
}

if (weather_impacts_totals === true) {
  show: weather_sensitivity
}
```

---

## How Custom Insights Are Used

The text fields are injected into the agent's system prompt when generating picks:

```
You are a sports betting analyst with the following philosophy and preferences:

BETTING PHILOSOPHY:
{betting_philosophy}

PERCEIVED EDGES TO LOOK FOR:
{perceived_edges}

SITUATIONS TO AVOID:
{avoid_situations}

SITUATIONS TO PRIORITIZE:
{target_situations}

Use these preferences alongside the structured parameters when analyzing games and making pick recommendations.
```

---

## Preset Archetypes

Pre-configured agent personalities users can select to auto-fill all parameters. Users can use as-is or customize after selection.

| Archetype | Philosophy | Key Settings |
|-----------|------------|--------------|
| **The Contrarian** | "Fade the public, the sharps know better" | `fade_public=true`, `underdog_lean=4`, `public_threshold=3` |
| **Chalk Grinder** | "Favorites win for a reason" | `underdog_lean=1`, `confidence_threshold=5`, `max_favorite_odds=-400`, `chase_value=false` |
| **Plus Money Hunter** | "Give me dogs or give me nothing" | `underdog_lean=5`, `min_underdog_odds=+150`, `chase_value=true`, `preferred_bet_type=moneyline` |
| **Model Truther** | "Trust the math, ignore the noise" | `trust_model=5`, `trust_polymarket=2`, `confidence_threshold=4` |
| **Polymarket Prophet** | "The crowd is wise" | `trust_polymarket=5`, `polymarket_divergence_flag=true`, `trust_model=3` |
| **Momentum Rider** | "Ride the hot hand" | `ride_hot_streaks=true`, `fade_cold_streaks=true`, `weight_recent_form=5` (NBA only) |
| **Weather Watcher** | "Nature picks winners" | `weather_impacts_totals=true`, `weather_sensitivity=5`, `over_under_lean=2` (NFL/CFB only) |
| **The Analyst** | "Balanced and selective" | All values at 3, `skip_weak_slates=true`, `confidence_threshold=4` |

### Archetype Quick-Fill Values

```typescript
const PRESET_ARCHETYPES: Record<string, Partial<AgentPersonality>> = {
  contrarian: {
    risk_tolerance: 4,
    underdog_lean: 4,
    over_under_lean: 3,
    confidence_threshold: 3,
    chase_value: true,
    fade_public: true,
    public_threshold: 3,
    trust_model: 3,
    trust_polymarket: 4,
    home_court_boost: 2,
    betting_philosophy: "The public loses. When 70%+ of bets are on one side, I look the other way.",
  },

  chalk_grinder: {
    risk_tolerance: 2,
    underdog_lean: 1,
    over_under_lean: 3,
    confidence_threshold: 5,
    chase_value: false,
    max_favorite_odds: -400,
    min_underdog_odds: null,
    preferred_bet_type: 'spread',
    trust_model: 4,
    home_court_boost: 4,
    betting_philosophy: "Favorites are favorites for a reason. I take the sure thing and grind out profits.",
  },

  plus_money_hunter: {
    risk_tolerance: 5,
    underdog_lean: 5,
    over_under_lean: 3,
    confidence_threshold: 2,
    chase_value: true,
    max_favorite_odds: -110,
    min_underdog_odds: 150,
    preferred_bet_type: 'moneyline',
    trust_model: 3,
    betting_philosophy: "Plus money or nothing. One big hit pays for the losses.",
  },

  model_truther: {
    risk_tolerance: 3,
    underdog_lean: 3,
    over_under_lean: 3,
    confidence_threshold: 4,
    chase_value: false,
    trust_model: 5,
    trust_polymarket: 2,
    skip_weak_slates: true,
    betting_philosophy: "The model is smarter than my gut. When it shows value, I bet.",
  },

  polymarket_prophet: {
    risk_tolerance: 3,
    underdog_lean: 3,
    over_under_lean: 3,
    confidence_threshold: 3,
    trust_model: 3,
    trust_polymarket: 5,
    polymarket_divergence_flag: true,
    betting_philosophy: "Prediction markets aggregate wisdom. When Polymarket disagrees with Vegas, I follow the crowd.",
  },

  momentum_rider: {
    // NBA only archetype
    preferred_sports: ['nba'],
    risk_tolerance: 4,
    underdog_lean: 3,
    confidence_threshold: 3,
    chase_value: true,
    trust_team_ratings: 3,
    weight_recent_form: 5,
    ride_hot_streaks: true,
    fade_cold_streaks: true,
    regress_luck: false,
    betting_philosophy: "Hot teams stay hot. I ride winning streaks until they break.",
  },

  weather_watcher: {
    // NFL/CFB only archetype
    preferred_sports: ['nfl', 'cfb'],
    risk_tolerance: 3,
    over_under_lean: 2,
    confidence_threshold: 3,
    weather_impacts_totals: true,
    weather_sensitivity: 5,
    preferred_bet_type: 'total',
    betting_philosophy: "Wind kills passing games. Cold slows everything down. I bet the weather.",
  },

  the_analyst: {
    risk_tolerance: 3,
    underdog_lean: 3,
    over_under_lean: 3,
    confidence_threshold: 4,
    chase_value: false,
    preferred_bet_type: 'any',
    max_picks_per_day: 3,
    skip_weak_slates: true,
    trust_model: 4,
    trust_polymarket: 3,
    home_court_boost: 3,
    betting_philosophy: "No biases, no emotions. I analyze every angle and only bet when everything aligns.",
  },
};
```

---

## Default Values

For quick-start or when users skip optional fields:

```typescript
const DEFAULT_PERSONALITY: Partial<AgentPersonality> = {
  // Core
  risk_tolerance: 3,
  underdog_lean: 3,
  over_under_lean: 3,
  confidence_threshold: 3,
  chase_value: false,

  // Bet Selection
  preferred_bet_type: 'any',
  max_favorite_odds: -200,
  min_underdog_odds: null,
  max_picks_per_day: 3,
  skip_weak_slates: true,

  // Data Trust
  trust_model: 4,
  trust_polymarket: 3,
  polymarket_divergence_flag: true,

  // Situational
  home_court_boost: 3,
};
```
