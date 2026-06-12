// Multi-provider agent loop for WagerBot (parallel to wagerbot-chat/agent.ts).
//
// Uses the OpenAI **Chat Completions** wire format, which both OpenAI and
// DeepSeek speak natively (DeepSeek exposes an OpenAI-shaped endpoint). One loop
// serves both providers — only base URL + key + model id differ (see providers.ts).
//
// The SSE contract emitted to the client is byte-identical to wagerbot-chat:
// text is forwarded as `{choices:[{delta:{content}}]}` chunks (what the iOS
// parser already reads), tools via wagerbot.tool_start/tool_end, game_cards via
// wagerbot.game_cards, widgets/follow-ups via the tools' own ctx.emit. So the
// existing iOS rendering needs no changes.
//
// Difference vs wagerbot-chat: the Responses API's built-in web_search is NOT
// available in Chat Completions, so this loop has no web search (see index.ts
// system prompt). Adding a provider-agnostic web_search *tool* is the seam.

import type { SSESink } from "./sse.ts";
import { runTool, type ToolContext, type ToolDefinition } from "./tools/registry.ts";
import type { ProviderConfig } from "./providers.ts";

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxTurns: number;
  maxTokens?: number;
}

// Chat Completions message shapes.
// reasoning_content: DeepSeek V4 thinking mode (default-on) REQUIRES each
// tool-calling assistant turn's CoT passed back on subsequent requests, or it
// 400s. Only attached for deepseek models — OpenAI must never see the field.
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[]; reasoning_content?: string }
  | { role: "tool"; tool_call_id: string; content: string };

interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface PendingToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

export async function runAgentLoop(opts: {
  config: AgentConfig;
  messages: ChatMessage[];
  sink: SSESink;
  toolContext: ToolContext;
  provider: ProviderConfig;
  apiKey: string;
}): Promise<{
  finalContent: string;
  allAssistantText: string;
  turns: number;
  blocks: any[];
}> {
  const { config, sink, provider, apiKey } = opts;
  let allAssistantText = "";
  const blocks: any[] = [];

  // present_analysis reads accumulated blocks via getBlocks().
  const toolContext: ToolContext = { ...opts.toolContext, getBlocks: () => blocks };

  // Chat Completions tool schema: { type:"function", function:{ name, description, parameters } }
  const tools = config.tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const conversation: ChatMessage[] = [
    { role: "system", content: config.systemPrompt },
    ...opts.messages,
  ];

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: conversation,
      tools,
      tool_choice: "auto",
      stream: true,
    };
    if (config.maxTokens) requestBody.max_tokens = config.maxTokens;

    const upstream = await fetch(provider.chatCompletionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => "");
      sink.emit("wagerbot.error", {
        code: "llm_upstream",
        status: upstream.status,
        message: errBody.slice(0, 500),
      });
      throw new Error(`${provider.id} ${upstream.status}: ${errBody.slice(0, 200)}`);
    }

    const result = await consumeChatStream(upstream.body, sink);

    if (result.textContent) {
      if (allAssistantText.length > 0) allAssistantText += " ";
      allAssistantText += result.textContent;
      blocks.push({ type: "text", text: result.textContent });
    }

    // No tool calls → done.
    if (result.toolCalls.length === 0) {
      return {
        finalContent: result.textContent ?? "",
        allAssistantText,
        turns: turn + 1,
        blocks,
      };
    }

    // Record the assistant tool-call turn so the provider sees its own calls next turn.
    conversation.push({
      role: "assistant",
      content: result.textContent || null,
      tool_calls: result.toolCalls.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.arguments },
      })),
      ...(config.model.startsWith("deepseek") ? { reasoning_content: result.reasoning ?? "" } : {}),
    });

    for (const call of result.toolCalls) {
      blocks.push({ type: "tool_use", id: call.id, name: call.name, arguments: call.arguments });
    }

    // Execute all tool calls in parallel; append a `tool` message per result.
    const toolMessages = await Promise.all(
      result.toolCalls.map(async (call): Promise<ChatMessage> => {
        const startedAt = Date.now();
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(call.arguments || "{}");
        } catch { /* malformed JSON from model */ }

        sink.emit("wagerbot.tool_start", { id: call.id, name: call.name, arguments: parsedArgs });

        try {
          const out = await runTool(call.name, parsedArgs, toolContext);
          const ms = Date.now() - startedAt;
          const resultStr = typeof out === "string" ? out : JSON.stringify(out);
          sink.emit("wagerbot.tool_end", {
            id: call.id,
            name: call.name,
            ms,
            ok: true,
            result_summary: summarize(resultStr),
          });

          blocks.push({ type: "tool_result", tool_call_id: call.id, content: resultStr });

          if (out && typeof out === "object" && "game_cards" in (out as any)) {
            const cards = (out as any).game_cards;
            blocks.push({ type: "game_cards", cards });
            sink.emit("wagerbot.game_cards", { cards });
          }
          if (out && typeof out === "object" && "chat_widgets" in (out as any)) {
            const widgets = (out as any).chat_widgets;
            if (Array.isArray(widgets) && widgets.length > 0) {
              blocks.push({ type: "chat_widgets", widgets });
            }
          }

          // V2 rich components from present_components — persist as a block so
          // the thread rehydrates with the components (wagerbot.app_components
          // was already emitted live by the tool via ctx.emit).
          if (out && typeof out === "object" && "app_components" in (out as any)) {
            const comps = (out as any).app_components;
            if (Array.isArray(comps) && comps.length > 0) {
              blocks.push({
                type: "app_components",
                summary: (out as any).summary ?? "",
                components: comps,
              });
            }
          }

          return { role: "tool", tool_call_id: call.id, content: compactToolOutput(out, resultStr) };
        } catch (e) {
          const ms = Date.now() - startedAt;
          const message = e instanceof Error ? e.message : String(e);
          sink.emit("wagerbot.tool_end", {
            id: call.id,
            name: call.name,
            ms,
            ok: false,
            result_summary: message.slice(0, 200),
          });
          blocks.push({ type: "tool_result", tool_call_id: call.id, content: `Error: ${message}` });
          return { role: "tool", tool_call_id: call.id, content: `Error: ${message}` };
        }
      }),
    );

    for (const m of toolMessages) conversation.push(m);
  }

  sink.emit("wagerbot.error", {
    code: "max_turns",
    message: `Stopped after ${config.maxTurns} tool round-trips`,
  });
  return { finalContent: "", allAssistantText, turns: config.maxTurns, blocks };
}

// ---- Chat Completions stream consumer --------------------------------------

interface StreamResult {
  textContent: string | null;
  /** Accumulated thinking-mode CoT — passed back on deepseek tool-call turns. */
  reasoning: string | null;
  toolCalls: PendingToolCall[];
}

async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  sink: SSESink,
): Promise<StreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let textContent = "";
  let reasoning = "";
  let streamError: string | null = null;
  // DeepSeek thinking mode streams reasoning_content before the answer; we
  // surface it as a thinking stream and close it (thinking_done) once the answer
  // begins so the iOS client collapses the thinking block. We ALSO accumulate it
  // — V4 requires it passed back on tool-calling turns.
  let reasoningActive = false;
  // Tool calls accumulate by their stream index; id/name arrive once, args stream.
  const toolCallsByIndex: Record<number, PendingToolCall> = {};

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line.startsWith("data:")) continue;

      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;

      let data: any;
      try { data = JSON.parse(dataStr); } catch { continue; }

      if (data?.error) {
        streamError = data.error?.message || JSON.stringify(data.error).slice(0, 200);
        continue;
      }

      const choice = data?.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (!delta) continue;

      // Reasoning tokens (DeepSeek thinking mode) → thinking stream + capture.
      if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
        reasoningActive = true;
        reasoning += delta.reasoning_content;
        sink.emit("wagerbot.thinking_delta", { text: delta.reasoning_content });
      }

      // Text → forward as an OpenAI-shaped chunk the iOS client already parses.
      if (typeof delta.content === "string" && delta.content) {
        if (reasoningActive) {
          sink.emit("wagerbot.thinking_done", { summary: "" });
          reasoningActive = false;
        }
        textContent += delta.content;
        const chunk = { choices: [{ delta: { content: delta.content } }] };
        sink.forwardRaw(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      // Tool-call fragments.
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === "number" ? tc.index : 0;
          const entry =
            toolCallsByIndex[idx] ?? (toolCallsByIndex[idx] = { index: idx, id: "", name: "", arguments: "" });
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (typeof tc.function?.arguments === "string") entry.arguments += tc.function.arguments;
        }
      }
    }
  }

  if (reasoningActive) sink.emit("wagerbot.thinking_done", { summary: "" });
  if (streamError) throw new Error(`LLM stream failed: ${streamError}`);

  const toolCalls = Object.values(toolCallsByIndex)
    .filter((c) => c.name)
    .map((c) => ({ ...c, id: c.id || `call_${c.index}` }));

  return { textContent: textContent || null, reasoning: reasoning || null, toolCalls };
}

// ---- helpers (parallel copies of wagerbot-chat/agent.ts) -------------------

function summarize(out: string): string {
  if (!out) return "";
  return out.length > 200 ? out.slice(0, 200) + "..." : out;
}

/** Compact tool output for model context. Strips game_cards/raw_game (kept in
 *  blocks for present_analysis) and reduces each game to essential fields.
 *  Target: <8K chars per tool output. Mirrors wagerbot-chat/agent.ts. */
function compactToolOutput(out: unknown, fullStr: string): string {
  if (typeof out !== "object" || out === null) {
    return fullStr.length > 8000 ? fullStr.slice(0, 8000) + "...(truncated)" : fullStr;
  }
  try {
    const obj = out as Record<string, unknown>;
    const { game_cards: _gc, ...rest } = obj;
    if (Array.isArray(rest.games)) {
      rest.games = (rest.games as any[]).map((g: any) => ({
        game_id: g.game_id,
        matchup: g.matchup,
        game_date: g.game_date,
        vegas_lines: g.vegas_lines,
        model_predictions: g.model_predictions,
        betting_trends: g.betting_trends
          ? {
              home_ats_pct: g.betting_trends?.home?.ats_pct,
              away_ats_pct: g.betting_trends?.away?.ats_pct,
              home_over_pct: g.betting_trends?.home?.over_pct,
              away_over_pct: g.betting_trends?.away?.over_pct,
              home_streak: g.betting_trends?.home?.win_streak,
              away_streak: g.betting_trends?.away?.win_streak,
            }
          : undefined,
        injuries: g.injuries
          ? {
              away: g.injuries?.away?.map((i: any) => `${i.player} (${i.status})`) ?? null,
              home: g.injuries?.home?.map((i: any) => `${i.player} (${i.status})`) ?? null,
            }
          : undefined,
        game_key: g.game_key,
        markets: g.markets,
      }));
    }
    const compacted = JSON.stringify(rest);
    return compacted.length > 8000 ? compacted.slice(0, 8000) + "...(truncated)" : compacted;
  } catch {
    return fullStr.length > 8000 ? fullStr.slice(0, 8000) + "...(truncated)" : fullStr;
  }
}
