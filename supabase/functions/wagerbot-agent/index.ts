// wagerbot-agent Edge Function — multi-provider agentic chat for WagerBot.
//
// PARALLEL to wagerbot-chat (which is intentionally left untouched). Same SSE
// contract, thread/message persistence, and tools, but:
//   - the agent loop uses the OpenAI Chat Completions wire format, so it runs on
//     OpenAI AND DeepSeek (OpenAI-shaped endpoint), selected per-request by `model`,
//   - no built-in web_search (Chat-Completions limitation — see system prompt).
//
// iOS routes here only when a debug model is selected; default chat stays on
// wagerbot-chat. Because the streamed events are identical, iOS rendering is
// unchanged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { runAgentLoop, type AgentConfig, type ChatMessage } from "./agent.ts";
import { getAllTools, type ToolContext } from "./tools/registry.ts";
import { createSSEStream } from "./sse.ts";
import { getTodayInET } from "../shared/dateUtils.ts";
import { resolveModel, type ProviderConfig } from "./providers.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function waitUntil(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
  else p.catch((e) => console.error("[wagerbot-agent] waitUntil task failed:", e));
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Parallel to wagerbot-chat's prompt, minus the web_search protocol (Chat
// Completions has no built-in web search). Date injected per-request.
const SYSTEM_PROMPT_TEMPLATE = `You are WagerBot, a sharp and knowledgeable sports betting analyst powered by machine learning models and real-time data on WagerProof.

Today's date is {{TODAY_ET}} (Eastern Time). When users say "today" they mean this date. Do NOT pass a date parameter to tools unless the user asks about a specific different date — the tools default to today automatically.

## TOOL USAGE PROTOCOL

### Rule 1: Call each tool ONCE per question
Never call the same tool twice with the same or similar parameters. If you need NBA predictions, call get_nba_predictions once — it returns ALL games for that date. Do not loop.

### Rule 2: Tool selection by question type
| User asks about... | Tool(s) to call |
|---|---|
| "Best bets today" / "value plays" | Call prediction tools for each active sport (1 call per sport), then analyze |
| Specific sport ("NBA picks") | That sport's prediction tool only |
| Specific game ("Lakers vs Celtics") | search_games (if unsure of league) → get_game_detail for the matchup |
| "Editor picks" / "expert picks" | get_editor_picks (once) |
| Polymarket / market odds | get_polymarket_odds for the league |
| Comparison (model vs market) | Prediction tool + get_polymarket_odds for that league |

### Rule 3: Do NOT call get_editor_picks unless the user asks about expert/editor picks
It returns editorial staff picks, not model predictions. It is NOT a substitute for the prediction tools.

### Rule 4: Present results with present_components, then suggest_follow_ups LAST
After fetching data, call present_components to render rich TAPPABLE cards (never write the analysis as markdown). Then ALWAYS call suggest_follow_ups LAST with 3 follow-up questions. Both are mandatory.

### Rule 5: Surface the user's own data when relevant
For questions about the user's agents or their picks, call get_my_agents / get_agent_picks, then render agent / agent_pick components.

## ANALYSIS METHODOLOGY

### Finding Value (the core job)
Value = Model probability - Market implied probability. This is the edge.
- Edge > 3%: Worth noting
- Edge > 5%: Moderate value
- Edge > 8%: Strong value
- Edge > 12%: Exceptional value (rare, verify data)

### Sport-Specific Analysis

**NBA** (richest data): team ratings (adj_off_rtg, adj_def_rtg, pace), L3/L5 trends, shooting splits, ATS%, luck (regression signal), consistency, and injuries — a star out changes everything.

**MLB** (Statcast-rich): starting-pitcher matchup drives everything (xFIP more predictive than ERA; <3.50 elite, >4.50 vulnerable), bullpen fatigue, barrel%, park factors, and stacked game signals (3+ aligned = strong). F5 bets isolate the SP matchup.

**NFL/CFB** (model + weather + public betting): model ML/spread/O-U picks with confidence; wind >15mph or temp <35°F leans under; fade lopsided public money when the model disagrees. No team ratings/trends.

**NCAAB** (ratings + rankings): adj offense/defense/pace with L3 trends, rankings/seeds, conference + neutral-site flags. Higher variance than NBA — trust the model a bit less per game.

## RESPONSE FORMAT — present_components

After fetching data you MUST call present_components to render rich, TAPPABLE cards instead of markdown:
1. Call data tool(s) — predictions, polymarket, editor picks, get_my_agents, etc.
2. Write a brief 1-2 sentence \`summary\`.
3. Pass an ordered \`components\` array (aim for the 3-6 most useful).

Component types:
- Game-linked (pass \`game_id\` + \`sport\`; the server fills the data, you may add \`fields\`/\`pick\`/\`analysis\`):
  - \`game\` — the matchup card (start here when discussing a game).
  - \`value\` — a highlighted value play (use for your strongest edges).
  - \`model_projection\` — model vs. Vegas edge.
  - \`polymarket\` — prediction-market implied odds (use when you called get_polymarket_odds).
  - \`betting_trends\` — ATS / O-U (NBA/NCAAB).
  - \`injury\` — key injuries (NBA).
  - \`weather\` — conditions (outdoor NFL/CFB/MLB).
  - \`public_betting\` — money/ticket splits (NFL/CFB).
  - \`model_accuracy\` — historical accuracy bucket (supply record/win_pct/roi_pct/bet_type in \`fields\`).
- Entity (build \`fields\` from the tool results + pass the id):
  - \`agent\` (\`agent_id\`; fields: name, emoji, record, net_units, win_rate) — from get_my_agents.
  - \`agent_pick\` (\`agent_id\`; fields: agent_name, selection, matchup, reasoning, result) — from get_agent_picks.
  - \`editor_pick\` (fields: selection, matchup, best_price, sportsbook, analysis, result) — from get_editor_picks.
  - \`tool\` (\`tool_category\`: mlbTrends, mlbRegression, mlbPitcherMatchups, mlbF5Splits, nbaTrends, nbaAccuracy, ncaabTrends, ncaabAccuracy) — reference a report/tool.

Always lead with a \`game\` or \`value\` card for each game you discuss so the user can tap into the full detail. Add 1-3 supporting widgets per game based on what you fetched.

### Text guidelines
- Be concise and specific; cite numbers ("62% model vs 55% implied — 7% edge").
- **Bold** key picks: **Lakers -3.5 (-110)**. Be opinionated but honest about uncertainty. Never guarantee outcomes.

## MANDATORY: FOLLOW-UP SUGGESTIONS
After EVERY response you MUST call suggest_follow_ups with 3 questions. If you do not, your response is incomplete.`;

interface ChatRequest {
  thread_id?: string | null;
  user_message: string;
  /** Optional model id (e.g. "gpt-4o", "deepseek-chat"). Defaults to gpt-4o. */
  model?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonError(405, "Method not allowed");

  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return jsonError(401, "Missing Authorization bearer token");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cfbUrl = Deno.env.get("CFB_SUPABASE_URL");
  const cfbAnonKey = Deno.env.get("CFB_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) return jsonError(500, "Supabase env not configured");
  if (!cfbUrl || !cfbAnonKey) return jsonError(500, "CFB Supabase env not configured");

  // ── Body + provider resolution ─────────────────────────────────────────
  let body: ChatRequest;
  try { body = await req.json(); }
  catch { return jsonError(400, "Body must be JSON"); }
  if (!body?.user_message) return jsonError(400, "user_message is required");

  const { model, provider } = resolveModel(body.model);
  const apiKey = Deno.env.get(provider.apiKeyEnv);
  if (!apiKey) return jsonError(500, `${provider.apiKeyEnv} not set (required for model ${model})`);

  // User-scoped client for auth + user data (RLS applies)
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    console.error("[wagerbot-agent] auth failed:", userErr?.message, userErr?.status);
    return jsonError(401, `Invalid token: ${userErr?.message ?? "no user"}`);
  }
  const userId = userData.user.id;

  // Service-role clients for data access (no RLS)
  const mainService = createClient(supabaseUrl, serviceKey!, { auth: { persistSession: false } });
  const cfbService = createClient(cfbUrl, cfbAnonKey, { auth: { persistSession: false } });

  const SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.replace("{{TODAY_ET}}", getTodayInET());

  // ── Resolve thread ────────────────────────────────────────────────────
  let threadId = body.thread_id ?? null;
  let isNewThread = false;
  let messages: ChatMessage[] = [];

  if (threadId) {
    const { data: thread, error: tErr } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr || !thread) return jsonError(404, "Thread not found");

    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("role, content, blocks")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    messages = buildMessagesFromHistory(msgs || []);
  } else {
    const { data: newThread, error: cErr } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (cErr || !newThread) return jsonError(500, `Couldn't create thread: ${cErr?.message}`);
    threadId = newThread.id;
    isNewThread = true;
  }

  messages.push({ role: "user", content: body.user_message });

  await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: "user",
    content: body.user_message,
  });

  // ── Stream + run agent loop ───────────────────────────────────────────
  const { sink, body: streamBody } = createSSEStream();

  (async () => {
    try {
      sink.emit("wagerbot.thread", { thread_id: threadId, created: isNewThread });

      const ctx: ToolContext = {
        supabase: mainService,
        cfbSupabase: cfbService,
        userId,
        threadId: threadId!,
        emit: (event, data) => sink.emit(event, data),
        getBlocks: () => [],
      };

      const config: AgentConfig = {
        model,
        systemPrompt: SYSTEM_PROMPT,
        tools: getAllTools(),
        maxTurns: 8,
        maxTokens: 4096,
      };

      const { finalContent, allAssistantText, blocks } = await runAgentLoop({
        config,
        messages,
        sink,
        toolContext: ctx,
        provider,
        apiKey,
      });

      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: finalContent || allAssistantText || "",
        blocks: JSON.stringify(blocks),
      });

      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);

      sink.emit("wagerbot.message_persisted", { role: "assistant" });

      if (isNewThread && allAssistantText) {
        waitUntil(
          generateAndSetTitle(supabase, provider, apiKey, threadId!, body.user_message, allAssistantText, sink),
        );
      }
    } catch (e) {
      console.error("[wagerbot-agent] agent loop failed:", e);
      sink.emit("wagerbot.error", {
        code: "agent_loop_failed",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      sink.close();
    }
  })();

  return new Response(streamBody, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ---- Helpers ----------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Convert stored chat_messages rows into Chat Completions messages.
 *  Skips tool-result rows; extracts text from blocks or plain content. */
function buildMessagesFromHistory(msgs: any[]): ChatMessage[] {
  const items: ChatMessage[] = [];
  for (const m of msgs) {
    if (m.role === "tool") continue;
    let text = "";
    if (m.blocks) {
      const parsed = typeof m.blocks === "string" ? JSON.parse(m.blocks) : m.blocks;
      if (Array.isArray(parsed)) {
        text = parsed.filter((b: any) => b.type === "text" && b.text).map((b: any) => b.text).join("");
      }
    }
    if (!text && m.content) text = m.content;
    if (!text) continue;
    if (m.role === "user") items.push({ role: "user", content: text });
    else if (m.role === "assistant") items.push({ role: "assistant", content: text });
  }
  return items;
}

/** Generate a short thread title via the selected provider's Chat Completions. */
async function generateAndSetTitle(
  supabase: any,
  provider: ProviderConfig,
  apiKey: string,
  threadId: string,
  userMessage: string,
  assistantText: string,
  sink: any,
) {
  try {
    const resp = await fetch(provider.chatCompletionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: provider.titleModel,
        max_tokens: 20,
        messages: [
          {
            role: "system",
            content:
              "Generate a 3-6 word title for this conversation. No quotes, no punctuation. Just the title words.",
          },
          {
            role: "user",
            content: `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantText.slice(0, 300)}`,
          },
        ],
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const title = data?.choices?.[0]?.message?.content?.trim();
    if (!title) return;

    await supabase.from("chat_threads").update({ title }).eq("id", threadId);
    sink.emit("wagerbot.thread_titled", { thread_id: threadId, title });
  } catch (e) {
    console.warn("[wagerbot-agent] title generation failed:", e);
  }
}
