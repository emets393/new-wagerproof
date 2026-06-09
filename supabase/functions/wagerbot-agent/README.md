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

## Providers (`providers.ts`)
| model | provider | endpoint | key env |
|-------|----------|----------|---------|
| `gpt-4o`, `gpt-4o-mini` | openai | `api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` |
| `deepseek-chat`, `deepseek-reasoner` | deepseek | `api.deepseek.com/v1/chat/completions` | `DEEPSEEK_API_KEY` |

Unknown/absent `model` → defaults to `gpt-4o`. `deepseek-reasoner`'s
`reasoning_content` is surfaced as the `wagerbot.thinking_*` stream.

## Request body
```jsonc
{ "user_message": "…", "thread_id": "…optional…", "model": "deepseek-chat" }
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
