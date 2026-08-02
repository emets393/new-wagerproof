// Routing: which model id gets which WIRE.
//
// This is the one assertion that catches a mis-wired run before it costs money.
// A model routed to the wrong transport does not fail loudly — the Chat parser
// finds no `choices` in a Responses stream, returns zero tool calls, and the loop
// exits green with zero picks. So assert both the declared wire AND what actually
// goes on the socket.
//
// No network: globalThis.fetch is replaced, and the "api keys" are literals.

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveProvider } from "./runV3Generation";
import type { ConversationItem, NeutralToolDefinition, Transport } from "./transport";
import {
  chatDelta,
  chatToolCallDelta,
  chatUsage,
  DONE,
  respCompleted,
  respFunctionCallItem,
  respOutputItemDone,
  respUsage,
  sseStream,
  type SseEvent,
} from "./__fixtures__/sseStream";

const TOOLS: NeutralToolDefinition[] = [
  { name: "submit_picks", description: "Finalize", parameters: { type: "object", properties: { picks: { type: "array" } } } },
];

const CONVERSATION: ConversationItem[] = [
  { kind: "system", text: "SYSTEM PROMPT" },
  { kind: "user", text: "Generate today's picks." },
  { kind: "assistant", text: null, toolCalls: [{ id: "slate_0", name: "get_slate", arguments: "{}" }], reasoning: { text: "I need today's slate." } },
  { kind: "toolResult", callId: "slate_0", content: '{"games":[]}' },
];

/** Records the URL + parsed body of the single request the transport makes. */
function captureRequest(events: SseEvent[]) {
  const seen: { url: string; body: any }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any) => {
      seen.push({ url, body: JSON.parse(init.body) });
      return new Response(sseStream(events, { chunkSize: Infinity }), { status: 200 });
    }),
  );
  return seen;
}

function send(transport: Transport) {
  return transport.sendTurn({
    conversation: CONVERSATION,
    tools: TOOLS,
    forceToolName: null,
    maxOutputTokens: 40_000,
    signal: new AbortController().signal,
  });
}

const CHAT_STREAM: SseEvent[] = [
  chatToolCallDelta(0, { id: "call_1", name: "submit_picks", args: "{}" }),
  chatDelta({}, { finish_reason: "tool_calls" }),
  chatUsage(100, 20),
  DONE,
];

const RESP_CALL = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "submit_picks", args: "{}" });
const RESP_STREAM: SseEvent[] = [respOutputItemDone(0, RESP_CALL), respCompleted([RESP_CALL], respUsage(100, 20, 15))];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.V3_REASONING_EFFORT;
});

describe("resolveProvider — transport routing", () => {
  it("routes a deepseek model to the Chat Completions transport", async () => {
    const binding = resolveProvider("deepseek-v4-flash");
    expect(binding.keyEnv).toBe("DEEPSEEK_API_KEY");

    const transport = binding.createTransport("dsk-not-real", { promptCacheKey: "run-1" });
    expect(transport.wire).toBe("chat_completions");
    // Thinking mode 400s on a named tool_choice, so the loop must force via prompt.
    expect(transport.capabilities.forcedToolChoice).toBe(false);

    const seen = captureRequest(CHAT_STREAM);
    const res = await send(transport);

    expect(seen[0].url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(Array.isArray(seen[0].body.messages)).toBe(true);
    expect(seen[0].body.input).toBeUndefined();
    // DeepSeek rejects unknown body keys — no reasoning param may reach it.
    expect(seen[0].body.reasoning).toBeUndefined();
    expect(seen[0].body.reasoning_effort).toBeUndefined();
    // V4 thinking mode needs each tool-calling turn's CoT handed back.
    expect(seen[0].body.messages[2].reasoning_content).toBe("I need today's slate.");
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "submit_picks", arguments: "{}" }]);
    expect(res.usage).toEqual({ inputTokens: 100, outputTokens: 20, reasoningTokens: 0 });
  });

  it("routes gpt-5.6-luna to the Responses transport at xhigh", async () => {
    const binding = resolveProvider("gpt-5.6-luna");
    expect(binding.keyEnv).toBe("OPENAI_API_KEY");

    const transport = binding.createTransport("sk-not-real", { promptCacheKey: "run-2" });
    expect(transport.wire).toBe("responses");
    expect(transport.capabilities.forcedToolChoice).toBe(true);

    const seen = captureRequest(RESP_STREAM);
    const res = await send(transport);

    expect(seen[0].url).toBe("https://api.openai.com/v1/responses");
    expect(Array.isArray(seen[0].body.input)).toBe(true);
    expect(seen[0].body.messages).toBeUndefined();
    // The two things the port was built for.
    expect(seen[0].body.reasoning.effort).toBe("xhigh");
    expect(seen[0].body.include).toEqual(["reasoning.encrypted_content"]);
    expect(seen[0].body.prompt_cache_key).toBe("run-2");
    // Reasoning tokens are a BREAKDOWN of outputTokens, never an addition.
    expect(res.usage).toEqual({ inputTokens: 100, outputTokens: 20, reasoningTokens: 15 });
  });

  it("routes every other OpenAI model to Responses, reasoning param or not", async () => {
    expect(resolveProvider("o4-mini").createTransport("k", { promptCacheKey: "r" }).wire).toBe("responses");

    // gpt-4.1-mini is not a reasoning model: same wire, no reasoning param.
    const transport = resolveProvider("gpt-4.1-mini").createTransport("k", { promptCacheKey: "r" });
    expect(transport.wire).toBe("responses");
    const seen = captureRequest(RESP_STREAM);
    await send(transport);
    expect(seen[0].url).toBe("https://api.openai.com/v1/responses");
    expect(seen[0].body.reasoning).toBeUndefined();
  });
});
