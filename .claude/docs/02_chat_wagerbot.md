# WagerBot Chat System

> Last verified: April 2026

## Overview

WagerBot is an agentic AI chat that provides sports betting analysis, predictions, and insights. It uses a Supabase Edge Function running an OpenAI Responses API agent loop with 10 custom data tools + built-in web search. Responses stream to the mobile client via Server-Sent Events (SSE).

## Architecture

```
Mobile App (WagerBotChat.tsx)
  │  HTTP POST + JWT (user_message, thread_id)
  ▼
Edge Function: wagerbot-chat/index.ts
  │  Auth → Resolve thread → Persist user message
  ▼
Agent Loop: wagerbot-chat/agent.ts
  │  OpenAI Responses API (gpt-4o, streaming)
  │  ← model requests tools → execute in parallel
  │  ← model generates text → stream to client
  ▼
SSE Stream → Mobile App
  │  wagerbot.* events (tool status, follow-ups, thread info)
  │  + text deltas (streamed word-by-word)
  ▼
Persist assistant message → Auto-title thread
```

## Edge Function: `wagerbot-chat`

**Endpoint:** `POST /functions/v1/wagerbot-chat`

### Request
```json
{
  "user_message": "What are the best NBA bets today?",
  "thread_id": "uuid-or-null"
}
```
Headers: `Authorization: Bearer <user_jwt>`

### Response
SSE stream with two event types:

**1. Text deltas** (forwarded from OpenAI):
```
data: {"choices":[{"delta":{"content":"The model..."}}]}
```

**2. WagerBot events** (custom):

| Event | Data | Purpose |
|-------|------|---------|
| `wagerbot.thread` | `{ thread_id, created }` | Thread ID for new/existing |
| `wagerbot.tool_start` | `{ id, name, arguments }` | Tool execution started |
| `wagerbot.tool_end` | `{ id, name, ms, ok, result_summary }` | Tool completed |
| `wagerbot.follow_ups` | `{ questions: string[] }` | Suggested next questions |
| `wagerbot.message_persisted` | `{ role }` | Message saved to DB |
| `wagerbot.thread_titled` | `{ thread_id, title }` | Auto-generated title |
| `wagerbot.error` | `{ code, message }` | Error occurred |

### Pipeline
1. Authenticate JWT via `supabase.auth.getUser(jwt)`
2. Resolve thread (create new or verify ownership)
3. Load message history from `chat_messages` table
4. Persist user message immediately
5. Run agent loop (streams SSE back to client)
6. Persist assistant response with `blocks` JSONB
7. Auto-title new threads (fire-and-forget background task)

## Agent Loop

**File:** `wagerbot-chat/agent.ts`

- **API:** OpenAI Responses API (`/v1/responses`)
- **Model:** gpt-4o
- **Max tokens:** 4096
- **Max tool turns:** 8
- **Streaming:** Yes, via SSE
- **Multi-turn:** Uses `previous_response_id` for tool result chaining

The loop:
1. Sends request with `instructions` (system prompt) + `input` (conversation)
2. Streams response, forwarding text deltas to client
3. If model calls functions → execute all in parallel → submit results → loop
4. If model outputs text → done, return to index.ts for persistence

## Tool Registry

**File:** `wagerbot-chat/tools/registry.ts`

Adding a tool: create `tools/<name>.ts` exporting `tool: ToolDefinition`, import and register in `ALL_TOOLS`.

### Custom Tools (10)

| Tool | Sport | Data Source (CFB Supabase) | Key Data |
|------|-------|---------------------------|----------|
| `get_nba_predictions` | NBA | `nba_input_values_view` + `nba_predictions` | Team ratings, L3/L5 trends, shooting, streaks, injuries |
| `get_nfl_predictions` | NFL | `nfl_predictions_epa` | Model predictions, weather, public betting splits |
| `get_cfb_predictions` | CFB | `cfb_live_weekly_inputs` | Model predictions, weather, public betting |
| `get_ncaab_predictions` | NCAAB | `v_cbb_input_values` + `ncaab_predictions` | Team ratings, rankings, seeds, context flags |
| `get_mlb_predictions` | MLB | `mlb_games_today` + `mlb_game_signals` | Statcast signals, model predictions, weather |
| `get_polymarket_odds` | All | `polymarket_markets` (Main Supabase) | Market odds for spread/ML/total |
| `get_game_detail` | All | Sport-specific tables | Deep dive on single matchup |
| `search_games` | All | All sport tables | Cross-league team/date search |
| `get_editor_picks` | All | `editor_picks` (Main Supabase) | Published expert picks |
| `suggest_follow_ups` | — | — | Emits 3-5 follow-up questions via SSE |

### Built-in Tool (1)

| Tool | Source | Purpose |
|------|--------|---------|
| `web_search` | OpenAI built-in | Breaking news, injuries, context not in DB |

### Tool Context

Each tool receives:
```typescript
interface ToolContext {
  supabase: SupabaseClient;      // Main DB (service-role, no RLS)
  cfbSupabase: SupabaseClient;   // Sports data DB
  userId: string;
  threadId: string;
  emit: (event, data) => void;   // Emit custom SSE events
}
```

## Database Schema

### `chat_threads`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Thread ID |
| `user_id` | UUID FK | Owner (auth.users) |
| `title` | TEXT | Auto-generated title |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `chat_messages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Message ID |
| `thread_id` | UUID FK | Parent thread |
| `role` | TEXT | "user", "assistant", or "tool" |
| `content` | TEXT | Plain text (legacy compat) |
| `blocks` | JSONB | ContentBlock array (new format) |
| `created_at` | TIMESTAMPTZ | |

### `wagerbot_chat_prompts` (future use)
Remote-configurable system prompts. Not currently used — prompt is hardcoded in `index.ts`.

### RLS Policies
- `chat_threads`: Users can CRUD own threads only
- `chat_messages`: Access inherited via thread ownership join
- Edge function uses service-role for writes (bypasses RLS)

## Mobile Client

### Service Layer
**`wagerproof-mobile/services/wagerBotChatService.ts`**
- Uses `expo/fetch` for ReadableStream support (React Native's built-in fetch lacks streaming)
- Gets JWT from `supabase.auth.getSession()`
- Parses SSE stream into typed `WagerBotSSEEvent` callbacks
- Also exports `loadThread()` for loading message history

### Type Definitions
**`wagerproof-mobile/types/chatTypes.ts`**
- `ContentBlock`: text | tool_use | follow_ups
- `ChatMessage`: id, role, blocks[], timestamp
- `WagerBotSSEEvent`: union of all event types
- `TOOL_DISPLAY_NAMES` / `TOOL_ICONS`: UI rendering maps

### Components
**`wagerproof-mobile/components/WagerBotChat.tsx`** — Main chat container
- Welcome screen with suggested prompts
- Message history drawer (swipe to delete)
- Keyboard-aware input area
- Auto-scroll on new content

**`wagerproof-mobile/components/chat/`:**
| Component | Purpose |
|-----------|---------|
| `MessageBubble.tsx` | Renders ContentBlock array per message |
| `StreamingText.tsx` | Word-by-word fade-in animation during streaming |
| `ToolCallsPill.tsx` | Collapsible tool execution summary with icons |
| `FollowUpPills.tsx` | Horizontal scrollable suggestion pills |
| `ThinkingIndicator.tsx` | Lottie animation while agent is thinking |

### Screen
**`wagerproof-mobile/app/(drawer)/(tabs)/chat.tsx`**
- Pro-gated via `useProAccess()` hook
- Header with back, history, and new chat buttons

## System Prompt

The system prompt is defined in `index.ts` as `SYSTEM_PROMPT_TEMPLATE` with `{{TODAY_ET}}` placeholder injected per-request. It tells the model:
- Today's date in ET
- Available tools and when to use them
- Data availability per sport (NBA richest, NFL/CFB most limited)
- To use web_search for news/injuries not in DB
- Style: lead with pick, use markdown, cite numbers
- Always call `suggest_follow_ups` last

## Environment Variables

All set as Supabase platform secrets:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — auto-injected
- `OPENAI_API_KEY` — GPT-4o access
- `CFB_SUPABASE_URL`, `CFB_SUPABASE_ANON_KEY` — sports data instance

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/wagerbot-chat/index.ts` | Edge function entry, auth, thread management |
| `supabase/functions/wagerbot-chat/agent.ts` | Responses API agent loop with streaming |
| `supabase/functions/wagerbot-chat/sse.ts` | SSE writer (forwardRaw + emit) |
| `supabase/functions/wagerbot-chat/tools/registry.ts` | Tool registry and executor |
| `supabase/functions/wagerbot-chat/tools/*.ts` | Individual tool implementations |
| `wagerproof-mobile/services/wagerBotChatService.ts` | Mobile SSE streaming client |
| `wagerproof-mobile/types/chatTypes.ts` | ContentBlock types, SSE events, tool maps |
| `wagerproof-mobile/components/WagerBotChat.tsx` | Main chat UI component |
| `wagerproof-mobile/components/chat/*.tsx` | Message rendering sub-components |
| `supabase/migrations/20260409000003_wagerbot_chat_blocks.sql` | blocks column + prompts table |
