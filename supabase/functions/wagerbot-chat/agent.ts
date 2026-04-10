// OpenAI Responses API agent loop for WagerBot chat.
//
// Uses the Responses API (not Chat Completions) for:
//   - Built-in web_search tool (no third-party search API needed)
//   - Streaming via SSE with typed events
//
// Instead of previous_response_id (fragile with streaming), we rebuild
// the full input array each turn with function_call + function_call_output
// items, similar to Chat Completions' message history pattern.

import type { SSESink } from "./sse.ts";
import { runTool, type ToolContext, type ToolDefinition } from "./tools/registry.ts";

const RESPONSES_API = "https://api.openai.com/v1/responses";

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxTurns: number;
  maxTokens?: number;
}

export type ResponsesInputItem =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { type: "function_call"; id: string; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

interface PendingFunctionCall {
  itemId: string;
  callId: string;
  name: string;
  arguments: string;
}

export async function runAgentLoop(opts: {
  config: AgentConfig;
  input: ResponsesInputItem[];
  sink: SSESink;
  toolContext: ToolContext;
  apiKey: string;
}): Promise<{
  finalContent: string;
  allAssistantText: string;
  turns: number;
  blocks: any[];
}> {
  const { config, sink, toolContext, apiKey } = opts;
  let allAssistantText = "";
  const blocks: any[] = [];

  // Build tools array once — custom functions + built-in web_search
  const tools: any[] = config.tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
  tools.push({ type: "web_search" });

  // Accumulate the full conversation input across turns
  const conversationInput: ResponsesInputItem[] = [...opts.input];

  for (let turn = 0; turn < config.maxTurns; turn++) {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      instructions: config.systemPrompt,
      input: conversationInput,
      tools,
      tool_choice: "auto",
      stream: true,
    };

    if (config.maxTokens) {
      requestBody.max_output_tokens = config.maxTokens;
    }

    const upstream = await fetch(RESPONSES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => "");
      sink.emit("wagerbot.error", {
        code: "openai_upstream",
        status: upstream.status,
        message: errBody.slice(0, 500),
      });
      throw new Error(`OpenAI ${upstream.status}: ${errBody.slice(0, 200)}`);
    }

    // Consume the streaming response
    const result = await consumeResponsesStream(upstream.body, sink);

    // Accumulate assistant text
    if (result.textContent) {
      if (allAssistantText.length > 0) allAssistantText += " ";
      allAssistantText += result.textContent;
      blocks.push({ type: "text", text: result.textContent });
    }

    // Record web search calls in blocks for display
    for (const ws of result.webSearchCalls) {
      blocks.push({
        type: "tool_use",
        id: ws.id,
        name: "web_search",
        arguments: "{}",
      });
    }

    // If no function calls, we're done
    if (result.functionCalls.length === 0) {
      return {
        finalContent: result.textContent ?? "",
        allAssistantText,
        turns: turn + 1,
        blocks,
      };
    }

    // Record function calls in blocks
    for (const call of result.functionCalls) {
      blocks.push({
        type: "tool_use",
        id: call.callId,
        name: call.name,
        arguments: call.arguments,
      });
    }

    // Add function_call items to conversation so OpenAI sees them on next turn
    for (const call of result.functionCalls) {
      conversationInput.push({
        type: "function_call",
        id: call.itemId,
        call_id: call.callId,
        name: call.name,
        arguments: call.arguments,
      });
    }

    // Execute all function calls in parallel
    const outputs = await Promise.all(
      result.functionCalls.map(async (call) => {
        const startedAt = Date.now();
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(call.arguments);
        } catch { /* malformed JSON from model */ }

        sink.emit("wagerbot.tool_start", {
          id: call.callId,
          name: call.name,
          arguments: parsedArgs,
        });

        try {
          const out = await runTool(call.name, parsedArgs, toolContext);
          const ms = Date.now() - startedAt;
          const resultStr = typeof out === "string" ? out : JSON.stringify(out);
          sink.emit("wagerbot.tool_end", {
            id: call.callId,
            name: call.name,
            ms,
            ok: true,
            result_summary: summarize(resultStr),
          });

          blocks.push({
            type: "tool_result",
            tool_call_id: call.callId,
            content: resultStr,
          });

          return {
            type: "function_call_output" as const,
            call_id: call.callId,
            output: resultStr,
          };
        } catch (e) {
          const ms = Date.now() - startedAt;
          const message = e instanceof Error ? e.message : String(e);
          sink.emit("wagerbot.tool_end", {
            id: call.callId,
            name: call.name,
            ms,
            ok: false,
            result_summary: message.slice(0, 200),
          });

          blocks.push({
            type: "tool_result",
            tool_call_id: call.callId,
            content: `Error: ${message}`,
          });

          return {
            type: "function_call_output" as const,
            call_id: call.callId,
            output: `Error: ${message}`,
          };
        }
      }),
    );

    // Add function outputs to conversation for next turn
    for (const output of outputs) {
      conversationInput.push(output);
    }
  }

  // Hit the loop cap
  sink.emit("wagerbot.error", {
    code: "max_turns",
    message: `Stopped after ${config.maxTurns} tool round-trips`,
  });
  return {
    finalContent: "",
    allAssistantText,
    turns: config.maxTurns,
    blocks,
  };
}

// ---- Stream consumer -------------------------------------------------------

interface StreamResult {
  responseId: string | null;
  textContent: string | null;
  functionCalls: PendingFunctionCall[];
  webSearchCalls: Array<{ id: string }>;
}

async function consumeResponsesStream(
  body: ReadableStream<Uint8Array>,
  sink: SSESink,
): Promise<StreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let responseId: string | null = null;
  let textContent = "";

  // Accumulate function call arguments by item ID
  const functionCallMap: Record<string, PendingFunctionCall> = {};
  const webSearchCalls: Array<{ id: string }> = [];

  let currentEventName = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let lineEnd;
    while ((lineEnd = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);

      if (line.startsWith("event: ")) {
        currentEventName = line.slice(7).trim();
        continue;
      }

      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        let data: any;
        try { data = JSON.parse(dataStr); } catch { continue; }

        handleEvent(currentEventName, data, {
          sink,
          setResponseId: (id) => { responseId = id; },
          appendText: (t) => { textContent += t; },
          functionCallMap,
          webSearchCalls,
        });

        currentEventName = "";
        continue;
      }

      if (line.trim() === "") {
        currentEventName = "";
      }
    }
  }

  return {
    responseId,
    textContent: textContent || null,
    functionCalls: Object.values(functionCallMap),
    webSearchCalls,
  };
}

interface EventHandlers {
  sink: SSESink;
  setResponseId: (id: string) => void;
  appendText: (text: string) => void;
  functionCallMap: Record<string, PendingFunctionCall>;
  webSearchCalls: Array<{ id: string }>;
}

function handleEvent(eventName: string, data: any, h: EventHandlers) {
  switch (eventName) {
    case "response.created":
      if (data?.id) h.setResponseId(data.id);
      break;

    // Text streaming — forward deltas to client
    case "response.output_text.delta":
      if (data?.delta) {
        h.appendText(data.delta);
        // Forward as OpenAI-compatible format for mobile client parsing
        const chunk = { choices: [{ delta: { content: data.delta } }] };
        h.sink.forwardRaw(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      break;

    // Function call: new item added — initialize entry
    case "response.output_item.added":
      if (data?.item?.type === "function_call") {
        const item = data.item;
        h.functionCallMap[item.id] = {
          itemId: item.id,
          callId: item.call_id || item.id,
          name: item.name || "",
          arguments: "",
        };
      }
      if (data?.item?.type === "web_search_call") {
        h.webSearchCalls.push({ id: data.item.id });
        h.sink.emit("wagerbot.tool_start", {
          id: data.item.id,
          name: "web_search",
          arguments: {},
        });
      }
      break;

    // Function call: argument deltas
    case "response.function_call_arguments.delta":
      if (data?.item_id && h.functionCallMap[data.item_id]) {
        h.functionCallMap[data.item_id].arguments += data.delta || "";
      }
      break;

    // Function call: arguments complete
    case "response.function_call_arguments.done":
      if (data?.item_id && h.functionCallMap[data.item_id]) {
        if (data.call_id) h.functionCallMap[data.item_id].callId = data.call_id;
        if (data.name) h.functionCallMap[data.item_id].name = data.name;
      }
      break;

    // Output item done — authoritative call_id and name
    case "response.output_item.done":
      if (data?.item?.type === "function_call" && data.item.id && h.functionCallMap[data.item.id]) {
        if (data.item.call_id) h.functionCallMap[data.item.id].callId = data.item.call_id;
        if (data.item.name) h.functionCallMap[data.item.id].name = data.item.name;
      }
      break;

    // Web search completed
    case "response.web_search_call.completed":
      if (data?.item_id) {
        h.sink.emit("wagerbot.tool_end", {
          id: data.item_id,
          name: "web_search",
          ms: 0,
          ok: true,
          result_summary: "Web search completed",
        });
      }
      break;

    // Response lifecycle — no action needed
    case "response.completed":
    case "response.in_progress":
    case "response.queued":
    case "response.content_part.added":
    case "response.content_part.done":
    case "response.output_text.done":
      break;

    // Errors
    case "response.failed":
    case "error":
      h.sink.emit("wagerbot.error", {
        code: "openai_stream_error",
        message: data?.error?.message || JSON.stringify(data).slice(0, 200),
      });
      break;

    default:
      break;
  }
}

function summarize(out: string): string {
  if (!out) return "";
  return out.length > 200 ? out.slice(0, 200) + "..." : out;
}
