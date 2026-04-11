// wagerbot-chat Edge Function — Agentic AI chat for WagerBot.
//
// Pipeline per request:
//   1. Authenticate the caller from the JWT.
//   2. Resolve thread: create one if thread_id is null, verify ownership otherwise.
//   3. Persist the new user message to chat_messages.
//   4. Run the OpenAI Responses API agent loop with tool calling + web search.
//      Streams SSE events back to the client.
//   5. Persist the assistant response to chat_messages.
//   6. Auto-title new threads via a lightweight OpenAI call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { runAgentLoop, type AgentConfig, type ResponsesInputItem } from "./agent.ts";
import { getAllTools, type ToolContext } from "./tools/registry.ts";
import { createSSEStream } from "./sse.ts";
import { getTodayInET } from "../shared/dateUtils.ts";

// EdgeRuntime.waitUntil keeps background work alive past response close
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function waitUntil(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(p);
  } else {
    p.catch((e) => console.error("[wagerbot-chat] waitUntil task failed:", e));
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Built once at cold-start, but the date is injected per-request below
const SYSTEM_PROMPT_TEMPLATE = `You are WagerBot, a sharp and knowledgeable sports betting analyst powered by machine learning models and real-time data on WagerProof.

Today's date is {{TODAY_ET}} (Eastern Time). When users say "today" they mean this date. Do NOT pass a date parameter to tools unless the user asks about a specific different date — the tools default to today automatically.

## TOOL USAGE PROTOCOL

You have data tools and web_search. Follow this protocol:

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
| News, injuries, recent events | web_search — always use this for context not in the data tools |
| Comparison (model vs market) | Prediction tool + get_polymarket_odds for that league |

### Rule 3: Use web_search for context
Always supplement data analysis with web_search for relevant context — recent injuries, lineup changes, trades, weather updates, team news. The data tools have model predictions but NOT breaking news. A 30-second web search can catch a star player being ruled out.

### Rule 4: Do NOT call get_editor_picks unless the user asks about expert/editor picks
It returns editorial staff picks, not model predictions. It is NOT a substitute for the prediction tools.

### Rule 5: Call present_analysis for game analysis, suggest_follow_ups LAST
When analyzing games, call present_analysis AFTER prediction tools to render rich visual widgets. Then ALWAYS call suggest_follow_ups LAST with 3 specific follow-up questions. Both are mandatory for game analysis responses.

## ANALYSIS METHODOLOGY

### Finding Value (the core job)
Value = Model probability - Market implied probability. This is the edge.
- Edge > 3%: Worth noting
- Edge > 5%: Moderate value
- Edge > 8%: Strong value
- Edge > 12%: Exceptional value (rare, verify data)

### Sport-Specific Analysis

**NBA** (richest data):
- Team ratings: adj_off_rtg, adj_def_rtg, pace. Higher off + lower def = better team.
- L3/L5 trends: Recent form matters. Rising adj_off_rtg_l3 = team heating up.
- Shooting splits: fg_pct, three_pct, ft_pct trends show hot/cold shooting.
- ATS%: Tracks against-the-spread performance. High ATS% = covering consistently.
- Luck metric: High luck = team outperforming underlying stats, regression likely.
- Consistency: Low consistency = volatile results, spreads riskier.
- Injuries: Check injury report — star player out changes everything.

**MLB** (Statcast-rich):
- Starting pitcher matchup drives everything. Compare xFIP (expected FIP, more predictive than ERA).
- xFIP < 3.50 = elite SP; xFIP > 4.50 = vulnerable SP.
- Luck detection: ERA much lower than xFIP = pitcher has been lucky, regression coming.
- Bullpen fatigue: bp_ip_last3d > 13 = heavy workload, blown leads risk.
- Barrel% is the best single offensive predictor.
- Park factors matter: Coors (128 index) inflates runs; Oracle suppresses.
- Game signals stack: 3+ aligned signals in same direction = strong case.
- F5 (first 5 innings) bets isolate the SP matchup when bullpens are unpredictable.

**NFL/CFB** (model + weather + public betting):
- Model gives ML/spread/O/U picks with confidence levels.
- Weather impacts totals significantly: wind > 15mph, temp < 35°F = lean under.
- Public betting splits: When 70%+ of money is on one side, consider fading if model disagrees.
- No team ratings or trends available — rely on model confidence + situational context.

**NCAAB** (ratings + rankings):
- Team ratings (adj offense/defense/pace) available with L3 trends.
- Rankings and seeds provide context for tournament/matchup quality.
- Conference game and neutral site flags affect home court advantage.
- More volatile than NBA — higher variance, trust model less on individual games.

## RESPONSE FORMAT

### Rule: Use present_analysis for game picks
When you analyze games after calling prediction tools, you MUST call present_analysis to render rich visual widgets. This replaces writing game analysis as plain markdown. The flow:
1. Call prediction tool(s) — this stores game cards in context
2. Write a brief 1-2 sentence intro as normal text
3. Call present_analysis with your top 3-5 value games, each with analysis text and optional widget types

present_analysis renders interactive cards with team logos, model projections, odds comparisons, and your analysis text — far richer than markdown. You choose which widgets to show per game:
- "matchup": Team logos, odds, game time (always useful)
- "model_projection": Model vs Vegas edge comparison (always useful for value picks)
- "polymarket": Prediction market odds (when user asked about markets or you called get_polymarket_odds)
- "public_betting": Betting splits (NFL/CFB when available)
- "betting_trends": ATS/O-U streaks (NBA/NCAAB)
- "weather": Game conditions (outdoor NFL/CFB/MLB)

Default widgets are ["matchup", "model_projection"]. IMPORTANT: Always add relevant extra widgets based on what tools you called:
- If you called get_polymarket_odds → include "polymarket" in show_widgets
- If the sport is NBA/NCAAB → include "betting_trends"
- If the sport is NFL/CFB and public betting data exists → include "public_betting"
- If the sport is NFL/CFB/MLB and outdoor game → include "weather"

### Text guidelines
- Be concise and specific
- Cite specific numbers: "Model gives 62% win prob vs. 55% implied — 7% edge"
- Use **bold** for key picks: **Lakers -3.5 (-110)**
- Be opinionated but honest about uncertainty
- Never guarantee outcomes — sports betting involves risk
- Keep text brief — the widgets carry the visual detail

## MANDATORY: FOLLOW-UP SUGGESTIONS

After EVERY response, you MUST call the suggest_follow_ups tool with 3 questions. Examples:
- "Which MLB games have the best over/under value?"
- "How does the model see the Lakers-Celtics spread?"
- "What do Polymarket odds say about tonight's games?"

If you do not call suggest_follow_ups, your response is incomplete.`;

interface ChatRequest {
  thread_id?: string | null;
  user_message: string;
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
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const cfbUrl = Deno.env.get("CFB_SUPABASE_URL");
  const cfbAnonKey = Deno.env.get("CFB_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) return jsonError(500, "Supabase env not configured");
  if (!openaiKey) return jsonError(500, "OPENAI_API_KEY not set");
  if (!cfbUrl || !cfbAnonKey) return jsonError(500, "CFB Supabase env not configured");

  // User-scoped client for auth + user data (RLS applies)
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    console.error("[wagerbot-chat] auth failed:", userErr?.message, userErr?.status);
    return jsonError(401, `Invalid token: ${userErr?.message ?? "no user"}`);
  }
  const userId = userData.user.id;

  // Service-role clients for data access (no RLS)
  const mainService = createClient(supabaseUrl, serviceKey!, {
    auth: { persistSession: false },
  });
  const cfbService = createClient(cfbUrl, cfbAnonKey, {
    auth: { persistSession: false },
  });

  // ── Body ──────────────────────────────────────────────────────────────
  let body: ChatRequest;
  try { body = await req.json(); }
  catch { return jsonError(400, "Body must be JSON"); }
  if (!body?.user_message) return jsonError(400, "user_message is required");

  // Inject today's date into the system prompt
  const SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE.replace("{{TODAY_ET}}", getTodayInET());

  // ── Resolve thread ────────────────────────────────────────────────────
  let threadId = body.thread_id ?? null;
  let isNewThread = false;

  // Build the Responses API input from conversation history
  let input: ResponsesInputItem[] = [];

  if (threadId) {
    // Verify thread ownership
    const { data: thread, error: tErr } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr || !thread) return jsonError(404, "Thread not found");

    // Load message history and convert to Responses API input format
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("role, content, blocks")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    input = buildInputFromHistory(msgs || []);
  } else {
    // Create new thread
    const { data: newThread, error: cErr } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (cErr || !newThread) return jsonError(500, `Couldn't create thread: ${cErr?.message}`);
    threadId = newThread.id;
    isNewThread = true;
  }

  // Add the new user message
  input.push({ role: "user", content: body.user_message });

  // Persist user message immediately
  await supabase.from("chat_messages").insert({
    thread_id: threadId,
    role: "user",
    content: body.user_message,
  });

  // ── Stream + run agent loop ───────────────────────────────────────────
  const { sink, body: streamBody } = createSSEStream();

  (async () => {
    try {
      sink.emit("wagerbot.thread", {
        thread_id: threadId,
        created: isNewThread,
      });

      const ctx: ToolContext = {
        supabase: mainService,
        cfbSupabase: cfbService,
        userId,
        threadId: threadId!,
        emit: (event, data) => sink.emit(event, data),
        getBlocks: () => [], // Overridden inside runAgentLoop with actual blocks
      };

      const config: AgentConfig = {
        model: "gpt-4o",
        systemPrompt: SYSTEM_PROMPT,
        tools: getAllTools(),
        maxTurns: 8,
        maxTokens: 4096,
      };

      const { finalContent, allAssistantText, blocks } = await runAgentLoop({
        config,
        input,
        sink,
        toolContext: ctx,
        apiKey: openaiKey,
      });

      // Persist the assistant response with blocks
      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: finalContent || allAssistantText || "",
        blocks: JSON.stringify(blocks),
      });

      // Bump thread updated_at
      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);

      sink.emit("wagerbot.message_persisted", {
        role: "assistant",
      });

      // Auto-title new threads (fire-and-forget)
      if (isNewThread && allAssistantText) {
        waitUntil(
          generateAndSetTitle(
            supabase,
            openaiKey,
            threadId!,
            body.user_message,
            allAssistantText,
            sink,
          ),
        );
      }
    } catch (e) {
      console.error("[wagerbot-chat] agent loop failed:", e);
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
      "Connection": "keep-alive",
    },
  });
});

// ---- Helpers ----------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
}

/** Convert stored chat_messages rows into Responses API input items.
 *  Skips tool-result messages (internal) and extracts text from blocks. */
function buildInputFromHistory(msgs: any[]): ResponsesInputItem[] {
  const items: ResponsesInputItem[] = [];

  for (const m of msgs) {
    if (m.role === "tool") continue;

    // Extract text content from blocks or plain content
    let text = "";
    if (m.blocks) {
      const parsed = typeof m.blocks === "string" ? JSON.parse(m.blocks) : m.blocks;
      if (Array.isArray(parsed)) {
        text = parsed
          .filter((b: any) => b.type === "text" && b.text)
          .map((b: any) => b.text)
          .join("");
      }
    }
    if (!text && m.content) {
      text = m.content;
    }
    if (!text) continue;

    if (m.role === "user") {
      items.push({ role: "user", content: text });
    } else if (m.role === "assistant") {
      items.push({ role: "assistant", content: text });
    }
  }

  return items;
}

/** Generate a short title for the thread using OpenAI. */
async function generateAndSetTitle(
  supabase: any,
  apiKey: string,
  threadId: string,
  userMessage: string,
  assistantText: string,
  sink: any,
) {
  try {
    // Use Responses API for title generation too
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_output_tokens: 20,
        instructions: "Generate a 3-6 word title for this conversation. No quotes, no punctuation. Just the title words.",
        input: `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantText.slice(0, 300)}`,
      }),
    });

    if (!resp.ok) return;
    const data = await resp.json();
    // Responses API returns output array with message items
    const title = data.output
      ?.find((item: any) => item.type === "message")
      ?.content
      ?.find((part: any) => part.type === "output_text")
      ?.text
      ?.trim();
    if (!title) return;

    await supabase
      .from("chat_threads")
      .update({ title })
      .eq("id", threadId);

    sink.emit("wagerbot.thread_titled", { thread_id: threadId, title });
  } catch (e) {
    console.warn("[wagerbot-chat] title generation failed:", e);
  }
}
