# WagerBot Chat — Tools & System Prompt Reference

> Edge function: `supabase/functions/wagerbot-chat/`
> Tool files: `supabase/functions/wagerbot-chat/tools/`

## Tools Overview

| # | Tool | File | When to Use |
|---|------|------|-------------|
| 1 | `get_nba_predictions` | `get_nba_predictions.ts` | Any NBA analysis |
| 2 | `get_nfl_predictions` | `get_nfl_predictions.ts` | Any NFL analysis |
| 3 | `get_cfb_predictions` | `get_cfb_predictions.ts` | Any CFB analysis |
| 4 | `get_ncaab_predictions` | `get_ncaab_predictions.ts` | Any NCAAB analysis |
| 5 | `get_mlb_predictions` | `get_mlb_predictions.ts` | Any MLB analysis |
| 6 | `get_polymarket_odds` | `get_polymarket_odds.ts` | Market consensus comparison |
| 7 | `get_game_detail` | `get_game_detail.ts` | Deep dive on a specific matchup |
| 8 | `search_games` | `search_games.ts` | Find which league a team plays in |
| 9 | `get_editor_picks` | `get_editor_picks.ts` | Only when user asks about editor/expert picks |
| 10 | `suggest_follow_ups` | `suggest_follow_ups.ts` | Mandatory last step of every response |
| 11 | `web_search` | *(built-in OpenAI)* | News, injuries, context not in DB |

---

## Tool Details

### 1. `get_nba_predictions`

**Description**: Fetch ALL NBA game predictions for a date. Returns model win probabilities, spreads, totals, team ratings, L3/L5 trends, injuries, and betting trends in one call. Call ONCE per date — returns all games.

**Parameters**:
- `date` (string, optional): Date in YYYY-MM-DD format. Defaults to today (Eastern Time).
- `team` (string, optional): Team name to filter results (e.g. 'Lakers', 'Celtics').

**Returns**: Predicted scores, win probabilities, model fair spread/total, team efficiency ratings (adj off/def/pace) with L3/L5 trends, shooting splits, rebounding, luck, consistency, betting trends (ATS%, O/U%), injuries (player name, status, avg PIE), situational data, accuracy metrics.

**Data source**: `nba_input_values_view`, `nba_predictions`, `nba_injury_report`, `nba_game_situational_trends_today`, `nba_todays_games_predictions_with_accuracy_cache` (CFB Supabase)

---

### 2. `get_nfl_predictions`

**Description**: Get NFL model predictions for the current week. Returns spread, moneyline, and over/under picks with confidence, weather data, public betting splits, and line movement.

**Parameters**:
- `team` (string, optional): Team name to filter (e.g. 'Chiefs', 'Bills').

**Returns**: Vegas lines (spread, moneyline, total), model predictions (ML/spread/O/U pick + confidence), fair spread/total, predicted scores, weather (temp, wind, precipitation), public betting splits (spread/ML/total).

**Data source**: `nfl_predictions_epa` (CFB Supabase, latest run_id)

---

### 3. `get_cfb_predictions`

**Description**: Get college football (CFB) model predictions for the current week. Returns spread, moneyline, and over/under picks with confidence.

**Parameters**:
- `team` (string, optional): Team name to filter (e.g. 'Alabama', 'Ohio State').

**Returns**: Vegas lines, model ML/spread/O/U picks with confidence, fair spread/total, weather, conference info.

**Data source**: `cfb_live_weekly_inputs` (CFB Supabase)

---

### 4. `get_ncaab_predictions`

**Description**: Get college basketball (NCAAB) model predictions. Returns predicted scores, spread/moneyline/total picks with confidence, team ratings, rankings, and context flags.

**Parameters**:
- `date` (string, optional): Date in YYYY-MM-DD format. Defaults to today (Eastern Time).
- `team` (string, optional): Team name to filter (e.g. 'Duke', 'UConn').

**Returns**: Team stats (adj offense/defense/pace with L3 trends), rankings and seeds, context (conference game, neutral site), Vegas lines, betting trends (ATS%, O/U%), model predictions (win probs, score predictions, fair spread/total).

**Data source**: `v_cbb_input_values`, `ncaab_predictions` (CFB Supabase, latest run_id)

---

### 5. `get_mlb_predictions`

**Description**: Get MLB model predictions. Returns starting pitchers, moneyline/spread/total predictions, Statcast-based signals, park factors, and weather.

**Parameters**:
- `date` (string, optional): Date in YYYY-MM-DD format. Defaults to today (Eastern Time).
- `team` (string, optional): Team name to filter (e.g. 'Yankees', 'Dodgers').

**Returns**: Starting pitchers (away/home with confirmation status), Vegas lines, model predictions (ML home/away win prob, edges, O/U direction/edge, fair total), weather (temp, wind speed/direction, sky), signal strength (strong/moderate for ML and O/U), parsed game signals (pitcher, bullpen, batting, schedule, weather, park).

**Data source**: `mlb_games_today`, `mlb_game_signals` (CFB Supabase)

---

### 6. `get_polymarket_odds`

**Description**: Get Polymarket prediction market odds for sports games. Returns real-money market probabilities. Useful for comparing model predictions against prediction market consensus.

**Parameters**:
- `league` (string, required): One of `nfl`, `nba`, `cfb`, `ncaab`, `mlb`.
- `team` (string, optional): Team name to filter results.

**Returns**: Questions, market type, outcome yes/no prices, volume, last updated. Grouped by game key.

**Data source**: `polymarket_markets` (Main Supabase)

---

### 7. `get_game_detail`

**Description**: Get a detailed breakdown of a specific game matchup. Combines model predictions, Polymarket odds, and all available data for one game. Use when the user asks about a specific matchup (e.g. 'Tell me about Lakers vs Celtics').

**Parameters**:
- `league` (string, required): One of `nfl`, `nba`, `cfb`, `ncaab`, `mlb`.
- `away_team` (string, required): The away team name.
- `home_team` (string, required): The home team name.
- `date` (string, optional): Date in YYYY-MM-DD format. Defaults to today.

**Returns**: Found flag, full game object (sport-specific), Polymarket array, league, date. Performs fuzzy matching on team names (handles abbreviations/substrings).

---

### 8. `search_games`

**Description**: Search for games across all sports leagues by team name. Use when the user mentions a team without specifying the league, or when you need to find which league a team plays in. Searches NFL, NBA, CFB, NCAAB, and MLB in parallel.

**Parameters**:
- `query` (string, required): Team name to search for (e.g. 'Lakers', 'Chiefs', 'Alabama').
- `date` (string, optional): Date in YYYY-MM-DD format. Defaults to today.

**Returns**: Array of `{league, matchup, game_date}`. Uses fuzzy matching.

---

### 9. `get_editor_picks`

**Description**: Get published editor/expert staff picks with reasoning and W-L tracking. ONLY call this when the user explicitly asks about editor picks, expert picks, or staff recommendations. Do NOT use this for general predictions — use the sport-specific prediction tools instead. Call once only — it returns up to 20 recent picks.

**Parameters**:
- `game_type` (string, optional): One of `nfl`, `nba`, `cfb`, `ncaab`, `mlb`.
- `result` (string, optional): One of `won`, `lost`, `push`, `pending`.

**Returns**: Pick details (bet type, pick value, best price, sportsbook, units, editor notes, result, is free pick), archived game info (away/home team, date).

**Data source**: `editors_picks` (Main Supabase, published only, limit 20)

---

### 10. `suggest_follow_ups`

**Description**: MANDATORY — call as the absolute LAST step of EVERY response, after writing final text. Provide 3 specific follow-up questions the user might ask next. Questions should be actionable, 4-12 words, phrased from the user's perspective.

**Parameters**:
- `questions` (string[], required): Exactly 3 follow-up questions.

**Behavior**: Emits `wagerbot.follow_ups` SSE event. Does NOT persist — flows through the stream as tappable suggestions in the UI.

---

### 11. `web_search` (built-in)

**Description**: OpenAI's built-in web search tool. Searches the web for news, injuries, lineup changes, trades, weather updates, or anything not available in the data tools.

**No parameters** — OpenAI handles the query construction from context.

**Added in**: `agent.ts` line 60: `tools.push({ type: "web_search" })`

---

## System Prompt Summary

The system prompt (`index.ts`, `SYSTEM_PROMPT_TEMPLATE`) covers:

1. **Identity**: WagerBot is a sharp sports betting analyst on WagerProof
2. **Date handling**: Today's date injected per-request in ET. Tools default to today.
3. **Tool usage protocol**:
   - Call each tool ONCE per question (no repeating)
   - Table mapping question types to tools
   - web_search for context/news always
   - Never call get_editor_picks for general predictions
   - suggest_follow_ups mandatory last step
4. **Analysis methodology**:
   - Value = model probability - market implied probability
   - Edge thresholds: 3% (notable), 5% (moderate), 8% (strong), 12% (exceptional)
5. **Sport-specific analysis guides**:
   - NBA: ratings, L3/L5 trends, shooting, ATS%, luck, consistency, injuries
   - MLB: xFIP, bullpen fatigue, barrel%, park factors, signal stacking, F5 bets
   - NFL/CFB: model confidence, weather, public betting splits
   - NCAAB: team ratings, rankings, conference/neutral flags
6. **Response format**: Lead with pick, bold key picks, tables for multi-game, cite numbers, be concise

---

## Architecture

```
Client (mobile/web)
    ↓ POST /wagerbot-chat
Edge Function (index.ts)
    ↓ Auth + thread resolution
    ↓ Persist user message
Agent Loop (agent.ts)
    ↓ OpenAI Responses API (gpt-4o)
    ↓ Streams SSE events
    ↓ Tool calls executed in parallel
    ↓ Max 8 turns, 4096 tokens
SSE Stream (sse.ts)
    ↓ wagerbot.* events + OpenAI deltas
Client renders ContentBlocks
```

**SSE Event Types**:
- `wagerbot.thread` — thread ID + created flag
- `wagerbot.tool_start` — tool execution begins
- `wagerbot.tool_end` — tool execution complete (with ms, ok, summary)
- `wagerbot.follow_ups` — suggested follow-up questions
- `wagerbot.thinking_delta` — reasoning text (o-series models)
- `wagerbot.thinking_done` — reasoning complete
- `wagerbot.message_persisted` — message saved to DB
- `wagerbot.thread_titled` — auto-generated thread title
- `wagerbot.error` — error with code and message
- Raw OpenAI `data:` lines — text content deltas
