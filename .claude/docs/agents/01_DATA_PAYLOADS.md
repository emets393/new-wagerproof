# Data Payload Architecture

The pick generation system uses 4 distinct payloads:

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  PAYLOAD 1          │   │  PAYLOAD 2          │   │  PAYLOAD 3          │
│  Agent Personality  │ + │  Game Data          │ + │  System Prompt      │
│  (from DB)          │   │  (aggregated)       │   │  (from DB, remote)  │
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

## Payload 3: System Prompt (Remote, from DB)

The system prompt is stored in the `agent_system_prompts` table on the main Supabase instance and fetched at runtime by both edge functions. This allows developers to iterate on prompt quality without code deploys.

### Table: `agent_system_prompts`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | Slug identifier (e.g., `v1_default`, `v2_experimental`) |
| `prompt_text` | text | The full system prompt template with placeholder variables |
| `is_active` | boolean | Only one row can be active (enforced by partial unique index) |
| `version` | integer | Version number for tracking iterations |
| `description` | text | Developer notes about this version |
| `updated_by` | text | Who last edited it |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated via trigger |

### Template Variables

The prompt template uses these placeholders, which `promptBuilder.ts` populates per-agent:

| Placeholder | Source | Description |
|-------------|--------|-------------|
| `{{AGENT_NAME}}` | `avatar_profiles.name` | Agent's display name |
| `{{AGENT_EMOJI}}` | `avatar_profiles.avatar_emoji` | Agent's emoji |
| `{{AGENT_SPORTS}}` | `avatar_profiles.preferred_sports` | Comma-separated sport list (e.g., "NFL, NBA") |
| `{{PERSONALITY_INSTRUCTIONS}}` | Built from `personality_params` | Natural language instructions mapped from all 31 params |
| `{{CUSTOM_INSIGHTS}}` | Built from `custom_insights` | User's free-text betting philosophy, edges, targets, avoids |
| `{{CONSTRAINTS}}` | Built from `personality_params` | Bet type limits, odds limits |

### How It Works

```
Edge function starts
    ↓
Fetch active prompt from agent_system_prompts (is_active=true)
    ↓
If found → use remote template
If not found → fall back to hardcoded prompt in promptBuilder.ts
    ↓
promptBuilder.ts replaces {{PLACEHOLDERS}} with per-agent data
    ↓
Final system prompt sent to OpenAI
```

### Editing the Prompt

1. Open Supabase dashboard → Table Editor → `agent_system_prompts`
2. Edit the `prompt_text` column on the active row
3. Changes take effect immediately on the next pick generation (no deploy needed)

### Creating a New Version

1. Insert a new row with a new `id` slug (e.g., `v2_concise`)
2. Set `is_active = false` on the new row
3. Test by temporarily swapping: set old row `is_active = false`, new row `is_active = true`
4. The partial unique index ensures only one row can be active

### Fallback Behavior

If no active prompt is found (e.g., table is empty, all rows inactive), both edge functions fall back to the hardcoded prompt in `promptBuilder.ts`. This ensures pick generation never breaks due to a missing or misconfigured prompt.

### Current Prompt Contents

The v1 prompt (`v1_default`) includes:
- **Platform context**: What WagerProof is, the agent's role
- **Sports definitions**: NFL, CFB, NBA, NCAAB explained
- **Full personality parameter reference**: All 31 params with scales and meanings
- **Sport-specific data availability notes**: Which params apply to which sports
- **Custom insights reference**: How to interpret the 4 free-text fields
- **Game data field guides**: Per-sport field definitions (vegas lines, weather, team stats, trends, etc.)
- **Data availability matrix**: What each sport has/doesn't have
- **Pick quality rules**: Must reference real data, no fabrication
- **Bet selection rules**: game_id matching, selection format, odds format, confidence scale
- **Volume/discipline rules**: Respect limits, cross-sport picks, no duplicate bet types
- **Output format specification**: Exact JSON schema required

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
// In generate-avatar-picks edge function (simplified)
async function generatePicks(agentId: string) {
  // 1. Fetch Payload 1: Agent Personality
  const profile = await supabaseClient
    .from('avatar_profiles').select('*').eq('id', agentId).single();

  // 2. Fetch Payload 3: Remote System Prompt Template
  const { data: promptRow } = await supabaseClient
    .from('agent_system_prompts').select('prompt_text').eq('is_active', true).single();
  const remotePromptTemplate = promptRow?.prompt_text || null;

  // 3. Build Payload 2: Game Data (filtered by agent's sports)
  for (const sport of profile.preferred_sports) {
    const { games, formattedGames } = await fetchGamesForSport(cfbClient, sport, today);
    allGamesData.push({ sport, games, formattedGames });
  }

  // 4. Build final system prompt (template + personality + constraints)
  //    promptBuilder.ts replaces {{PLACEHOLDERS}} in the remote template
  //    Falls back to hardcoded prompt if no remote template found
  const systemPrompt = buildSystemPrompt(profile, profile.preferred_sports, remotePromptTemplate);

  // 5. Build user prompt (full game data payload)
  const userPrompt = buildUserPrompt(combinedGames, 'MULTI', today);

  // 6. Call OpenAI with structured output
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_schema', json_schema: AVATAR_PICKS_JSON_SCHEMA },
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  // 7. Validate, insert picks, update timestamps
  const aiResponse = JSON.parse(response.choices[0].message.content);
  await savePicks(agentId, aiResponse.picks);
  return aiResponse;
}
```
