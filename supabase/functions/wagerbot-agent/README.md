# wagerbot-agent — multi-provider WagerBot chat (parallel to wagerbot-chat)

A **parallel, opt-in** edge function that runs the WagerBot agentic chat on
**multiple LLM providers**. The production `wagerbot-chat` function is left
completely untouched; this one exists alongside it so we can add providers and
iterate without risking the live chat.

## Why a separate function
- `wagerbot-chat` uses the OpenAI **Responses API** (with built-in `web_search`).
- DeepSeek (and most providers) speak the OpenAI **Chat Completions** format.
- Rather than fork the working loop, this function reimplements the loop in Chat
  Completions form so **one loop serves OpenAI and DeepSeek** (and any other
  OpenAI-compatible provider) — selected per request by `model`.

## What's identical to wagerbot-chat (so iOS is unchanged)
- Auth (Supabase JWT), thread/message persistence (`chat_threads` /
  `chat_messages`), and the **exact same SSE contract**: text is forwarded as
  `{choices:[{delta:{content}}]}` chunks; tools via `wagerbot.tool_start` /
  `wagerbot.tool_end`; `wagerbot.game_cards`; widgets/follow-ups via the tools'
  own `ctx.emit`; `wagerbot.thread` / `message_persisted` / `thread_titled` /
  `error`.
- The **tool set is a verbatim copy** of `wagerbot-chat/tools/` (the "parallel
  set of tools" — copy first, evolve freely without touching the live chat).
  Exception: `present_analysis` (legacy V1 widgets) is copied but NOT registered
  — it competed with `present_components` (both descriptions say "REQUIRED") and
  models picked the legacy one, rendering raw key-value cards. This chat renders
  `app_components` exclusively.
- One V2-only tool beyond the copy: `get_mlb_player_props` — the Props tab's
  data path (CFB `mlb_games_today` + `get_mlb_player_props_l10` RPC), computing
  L10 hit rate vs odds-implied probability per alternate line and returning the
  ranked edges. Prompt directs prop questions to it (MLB only) and pairs answers
  with the matching `game` card (the matchup sheet's Player Props widget carries
  the full per-game list; the standalone pitcher-matchups tool was retired).

## Providers (`providers.ts`)
| model | provider | endpoint | key env |
|-------|----------|----------|---------|
| `gpt-4o`, `gpt-4o-mini` | openai | `api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` |
| `deepseek-v4-flash`, `deepseek-v4-pro` | deepseek | `api.deepseek.com/v1/chat/completions` | `DEEPSEEK_API_KEY` |

Unknown/absent `model` → defaults to `gpt-4o`. DeepSeek V4 models run in
thinking mode by default: `reasoning_content` is surfaced as the
`wagerbot.thinking_*` stream AND passed back on tool-calling assistant turns
(V4 API requirement — omitting it is an HTTP 400). Thread titling disables
thinking (`thinking: {type:"disabled"}`). The old `deepseek-chat`/`-reasoner`
aliases are retired by DeepSeek after 2026-07-24 and no longer allowlisted.

## Request body
```jsonc
{ "user_message": "…", "thread_id": "…optional…", "model": "deepseek-v4-flash" }
```
`model` is optional (defaults to gpt-4o). iOS only sends it when a DEBUG model is
picked; otherwise iOS calls `wagerbot-chat` as before.

## Known gap vs wagerbot-chat
- **No built-in web search.** The Responses API's `web_search` tool has no Chat
  Completions equivalent. To restore it across providers, add a provider-agnostic
  `web_search` tool (e.g. Tavily/Serper/Brave) to the copied tool set and register
  it in `tools/registry.ts`. Until then this function answers from the data tools
  only. (The system prompt here omits the web_search protocol.)

## Deploy
```bash
supabase functions deploy wagerbot-agent
supabase secrets set DEEPSEEK_API_KEY=sk-...    # OpenAI key already configured
```
Shares all existing secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CFB_SUPABASE_URL`, `CFB_SUPABASE_ANON_KEY`,
`OPENAI_API_KEY`).

## iOS wiring
- Debug picker: chat ellipsis menu → "Model (debug)" (`WagerBotChatView`, DEBUG).
- Selection persists via `WagerBotModelSelection` (App Group defaults).
- `WagerBotChatService` routes to this function (and sends `model`) only when a
  non-default model is selected; release builds always use `wagerbot-chat`.

## Future convergence
The copied tools should eventually converge onto `@wagerproof/tool-core` (the
shared MCP backbone) so chat, the connector, and agent generation share one tool
definition. Kept separate for now per the "don't break current functionality"
constraint.
