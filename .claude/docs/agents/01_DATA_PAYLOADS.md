# Data Payload Architecture

The pick generation system uses 4 distinct payloads:

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  PAYLOAD 1          │   │  PAYLOAD 2          │   │  PAYLOAD 3          │
│  Agent Personality  │ + │  Game Data          │ + │  System Prompt      │
│  (from DB)          │   │  (aggregated)       │   │  (hardcoded)        │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    ▼
                          ┌─────────────────────┐
                          │   OpenAI API Call   │
                          └─────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │  PAYLOAD 4          │
                          │  Structured Output  │
                          │  (picks + messages) │
                          └─────────────────────┘
```

---

## Payload 1: Agent Personality (from DB)

Created during onboarding, stored in `avatar_profiles`. This is the agent's "betting DNA" - defines HOW they analyze and decide.

See [02_PERSONALITY_PARAMS.md](./02_PERSONALITY_PARAMS.md) for full interface definition.

---

## Payload 2: Game Data (Input)

Aggregated from multiple sources for each matchup. This is the "menu" the agent picks from.

```typescript
interface GameDataPayload {
  games: GameMatchup[];
  generated_at: string;             // Timestamp for freshness
  sport_filter: string[];           // Which sports included
}

interface GameMatchup {
  game_id: string;
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab';

  // Teams
  away_team: string;
  home_team: string;
  away_team_record?: string;
  home_team_record?: string;

  // Schedule
  game_date: string;
  game_time_et: string;
  venue?: string;
  is_neutral_site?: boolean;

  // Vegas Lines (current)
  vegas_spread: number;             // Home team spread
  vegas_total: number;
  vegas_home_ml: number;
  vegas_away_ml: number;

  // Line Movement
  opening_spread?: number;
  spread_movement?: number;         // Current - opening
  opening_total?: number;
  total_movement?: number;

  // Public Betting Splits
  public_spread_home_pct?: number;  // % of bets on home spread
  public_spread_away_pct?: number;
  public_ml_home_pct?: number;
  public_ml_away_pct?: number;
  public_over_pct?: number;
  public_under_pct?: number;

  // Money Splits (sharp indicator)
  money_spread_home_pct?: number;   // % of money on home spread
  money_spread_away_pct?: number;

  // WagerProof Model Predictions
  model_home_win_prob: number;      // 0.0-1.0
  model_predicted_spread: number;   // Model's predicted margin
  model_predicted_total: number;
  model_spread_edge?: number;       // Model spread - vegas spread
  model_total_edge?: number;

  // Prediction Market Data (Polymarket, etc.)
  polymarket_home_win?: number;     // If available
  polymarket_volume?: number;

  // Contextual Factors
  weather?: {
    temp_f?: number;
    wind_mph?: number;
    precipitation_pct?: number;
    dome?: boolean;
  };
  injuries?: {
    away_out: string[];             // Key players out
    home_out: string[];
    away_questionable: string[];
    home_questionable: string[];
  };

  // Historical Context
  head_to_head_last_5?: string;     // e.g., "Home 3-2"
  away_ats_record?: string;         // e.g., "8-4-1"
  home_ats_record?: string;
  away_ou_record?: string;          // Over/under record
  home_ou_record?: string;
}
```

### Data Sources

| Data Point | NFL Source | NBA Source | CFB Source | NCAAB Source |
|------------|------------|------------|------------|--------------|
| Teams/Schedule | `nfl_betting_lines` | `nba_input_values_view` | `cfb_live_weekly_inputs` | `v_cbb_input_values` |
| Vegas Lines | `nfl_betting_lines` | `nba_input_values_view` | `cfb_live_weekly_inputs` | `ncaab_predictions` |
| Model Predictions | `nfl_predictions_epa` | `nba_predictions` | `cfb_predictions` | `ncaab_predictions` |
| Public Betting | The Odds API | The Odds API | The Odds API | The Odds API |
| Polymarket | `polymarket_events` | `polymarket_events` | `polymarket_events` | — |
| Weather | Weather API | — | Weather API | — |

---

## Payload 3: System Prompt (Hardcoded)

Foundational instructions for ALL agents regardless of personality:

```typescript
const AGENT_SYSTEM_PROMPT = `
You are a sports betting analysis agent for WagerProof. Your job is to analyze games and select picks based on your configured personality and strategy.

## Core Principles
- You have access to WagerProof's proprietary model predictions
- Compare model probabilities to Vegas lines to identify value
- Consider line movement and public betting percentages
- Factor in contextual elements (weather, injuries, rest)

## Decision Framework
1. EDGE IDENTIFICATION: Look for games where model probability differs significantly from implied Vegas odds
2. VALUE ASSESSMENT: Bigger edge = higher confidence, but consider variance
3. RISK MANAGEMENT: Stay within your configured parameters (units, confidence threshold)
4. REASONING: Provide clear, analytical reasoning for each pick

## Constraints
- Only pick games you have genuine edge on
- Never exceed max_picks_per_day
- Never pick below min_confidence_threshold
- Respect bet_type_preferences weightings

## Output Format
Return valid JSON matching the specified schema. Include reasoning for each pick.
`;
```

---

## Payload 4: Structured Output (Return)

The schema for what OpenAI returns:

```typescript
interface AgentPicksResponse {
  agent_id: string;
  generated_at: string;

  picks: AgentPick[];

  // Optional agent commentary
  daily_summary?: string;           // "Tough slate today, only 2 edges worth taking..."
  confidence_note?: string;         // "Higher than usual confidence today"

  // Metadata
  games_analyzed: number;
  edges_found: number;
  picks_made: number;
}

interface AgentPick {
  game_id: string;
  sport: string;

  // The Pick
  bet_type: 'spread_home' | 'spread_away' | 'ml_home' | 'ml_away' | 'over' | 'under';
  pick_value: string;               // e.g., "KC -3.5", "Over 45.5", "LAL +150"

  // Sizing
  units: number;                    // 1.0, 1.5, 2.0, etc.
  confidence: number;               // 0.55-1.0

  // Reasoning
  reasoning: string;                // 2-3 sentence explanation
  key_factors: string[];            // ["Model edge +4.2%", "Reverse line movement", "Public fading"]

  // Context (for display)
  model_edge?: number;              // The calculated edge
  implied_prob?: number;            // Vegas implied probability
  model_prob?: number;              // Our model's probability
}
```

---

## Edge Function Assembly

```typescript
// In generate-avatar-picks edge function
async function generatePicks(agentId: string) {
  // 1. Fetch Payload 1: Agent Personality
  const personality = await fetchAgentPersonality(agentId);

  // 2. Build Payload 2: Game Data (filtered by agent's sports)
  const gameData = await aggregateGameData(personality.preferred_sports);

  // 3. Payload 3: System Prompt (hardcoded)
  const systemPrompt = AGENT_SYSTEM_PROMPT;

  // 4. Construct the API call
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(personality, gameData) }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: AGENT_PICKS_SCHEMA  // Enforces Payload 4 structure
    }
  });

  // 5. Parse and save Payload 4
  const picks: AgentPicksResponse = JSON.parse(response.choices[0].message.content);
  await savePicks(agentId, picks);

  return picks;
}

function buildUserPrompt(personality: AgentPersonalityPayload, games: GameDataPayload): string {
  return `
## Your Identity
Name: ${personality.name}
Risk Tolerance: ${personality.risk_tolerance}/10
Analysis Style: ${personality.analysis_style}
Preferred Bet Types: ${JSON.stringify(personality.bet_type_weights)}
Unit Sizing: ${personality.unit_sizing_strategy} (base: ${personality.base_unit_size}u)
Max Picks: ${personality.max_picks_per_day}
Min Confidence: ${personality.min_confidence_threshold * 100}%

## Data Source Weights
${JSON.stringify(personality.data_weights)}

## Today's Games
${JSON.stringify(games.games, null, 2)}

## Instructions
Analyze these games through the lens of your personality. Select your best picks (up to ${personality.max_picks_per_day}) where you have genuine edge above ${personality.min_confidence_threshold * 100}% confidence.

Return your picks as JSON matching the AgentPicksResponse schema.
`;
}
```
