// Tests for the /v1/responses transport: what it puts on the wire, and that a
// reasoning item survives a full round trip back into input[].
//
// No network. globalThis.fetch is replaced with a scripted fake, so no API key
// exists and no request ever leaves the process.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResponsesTransport, toResponsesInput, toResponsesToolDefs } from "./responsesTransport";
import type { ConversationItem, NeutralToolDefinition, TurnResult } from "./transport";
import {
  respArgsDone,
  respCompleted,
  respCreated,
  respFunctionCallItem,
  respOutputItemAdded,
  respOutputItemDone,
  respReasoningItem,
  respReasoningSummaryDelta,
  respUsage,
  sseStream,
  type SseEvent,
} from "./__fixtures__/sseStream";

const TOOLS: NeutralToolDefinition[] = [
  { name: "get_props", description: "Fetch props", parameters: { type: "object", properties: { game_ids: { type: "array", items: { type: "string" } } } } },
  { name: "submit_picks", description: "Finalize", parameters: { type: "object", properties: { picks: { type: "array" } } } },
];

/** Replaces fetch with a queue of scripted SSE responses and records every
 *  parsed request body. */
function scriptFetch(responses: SseEvent[][]) {
  const bodies: any[] = [];
  const queue = [...responses];
  const fake = vi.fn(async (_url: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    const events = queue.shift();
    if (!events) throw new Error("fake fetch: no scripted response left");
    return new Response(sseStream(events, { chunkSize: Infinity }), { status: 200 });
  });
  vi.stubGlobal("fetch", fake);
  return { bodies, fake };
}

function send(transport: ReturnType<typeof createResponsesTransport>, conversation: ConversationItem[], forceToolName: string | null = null): Promise<TurnResult> {
  return transport.sendTurn({
    conversation,
    tools: TOOLS,
    forceToolName,
    maxOutputTokens: 24_000,
    signal: new AbortController().signal,
  });
}

function makeTransport(model = "gpt-5.6-luna") {
  return createResponsesTransport({ model, apiKey: "test-key-not-real", url: "https://api.openai.example/v1/responses" });
}

const SEED: ConversationItem[] = [
  { kind: "system", text: "SYSTEM PROMPT" },
  { kind: "user", text: "Generate today's picks." },
  // The loop's synthesized slate round-trip: a fabricated call for a tool that
  // is NOT in the tools array, with a non-OpenAI-shaped call_id.
  { kind: "assistant", text: null, toolCalls: [{ id: "slate_0", name: "get_slate", arguments: "{}" }], reasoning: { text: "I need today's slate." } },
  { kind: "toolResult", callId: "slate_0", content: '{"games":[]}' },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.V3_REASONING_EFFORT;
});

describe("toResponsesInput", () => {
  it("renders the neutral conversation as a flat, ordered input[]", () => {
    const input = toResponsesInput(SEED) as any[];
    expect(input).toEqual([
      { role: "system", content: "SYSTEM PROMPT" },
      { role: "user", content: "Generate today's picks." },
      // Flat function_call: name/arguments on the item, no function:{} wrapper,
      // no `id` (only meaningful when echoing an item the API returned).
      { type: "function_call", call_id: "slate_0", name: "get_slate", arguments: "{}" },
      // No role, no name — call_id is the whole correlation.
      { type: "function_call_output", call_id: "slate_0", output: '{"games":[]}' },
    ]);
  });

  it("echoes a provider reasoning payload verbatim instead of rebuilding it", () => {
    const reasoningItem = respReasoningItem({ id: "rs_1", summary: "thinking", encrypted: "gAAAAopaque" });
    const callItem = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });
    const input = toResponsesInput([
      { kind: "user", text: "go" },
      {
        kind: "assistant",
        text: null,
        toolCalls: [{ id: "call_1", name: "get_props", arguments: "{}" }],
        reasoning: { text: "thinking", raw: [reasoningItem, callItem] },
      },
      { kind: "toolResult", callId: "call_1", content: "{}" },
    ]) as any[];

    // Reasoning item FIRST and byte-identical (encrypted_content is the payload
    // the model actually consumes; the summary is a lossy rendering).
    expect(input[1]).toBe(reasoningItem);
    expect(input[2]).toBe(callItem);
    // Exactly one function_call and one output — no duplicate rebuilt from
    // toolCalls, which would orphan an output and 400.
    expect(input.filter((i) => i.type === "function_call")).toHaveLength(1);
    expect(input[3]).toEqual({ type: "function_call_output", call_id: "call_1", output: "{}" });
  });

  it("falls back to a rebuilt assistant message when there is no raw payload", () => {
    const input = toResponsesInput([
      { kind: "assistant", text: "here you go", toolCalls: [{ id: "call_9", name: "submit_picks", arguments: "{}" }], reasoning: null },
    ]) as any[];
    expect(input).toEqual([
      { role: "assistant", content: "here you go" },
      { type: "function_call", call_id: "call_9", name: "submit_picks", arguments: "{}" },
    ]);
  });
});

describe("toResponsesToolDefs", () => {
  it("emits the FLAT tool shape with strict explicitly off", () => {
    // strict:true would 400 the whole tools array — the V3 pick schemas have
    // optional properties and set no additionalProperties:false.
    expect(toResponsesToolDefs(TOOLS)[0]).toEqual({
      type: "function",
      name: "get_props",
      description: "Fetch props",
      parameters: TOOLS[0].parameters,
      strict: false,
    });
  });
});

describe("responsesTransport — request body", () => {
  beforeEach(() => {
    process.env.V3_REASONING_EFFORT = "xhigh";
  });

  it("sends reasoning effort, stateless persistence flags and max_output_tokens", async () => {
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });
    const { bodies } = scriptFetch([[respOutputItemDone(0, call), respCompleted([call], respUsage(10, 20))]]);

    await send(makeTransport(), SEED);

    const body = bodies[0];
    expect(body.model).toBe("gpt-5.6-luna");
    // The whole point of the port: a real effort alongside function tools.
    expect(body.reasoning).toEqual({ effort: "xhigh", summary: "auto", context: "all_turns" });
    // Stateless + encrypted reasoning: nothing retained server-side.
    expect(body.store).toBe(false);
    expect(body.include).toEqual(["reasoning.encrypted_content"]);
    // Renamed from max_completion_tokens; covers reasoning tokens too.
    expect(body.max_output_tokens).toBe(24_000);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.max_tokens).toBeUndefined();
    // stream_options has no Responses equivalent (usage rides the terminal event).
    expect(body.stream_options).toBeUndefined();
    expect(body.messages).toBeUndefined();
    expect(Array.isArray(body.input)).toBe(true);
    expect(body.tool_choice).toBe("auto");
  });

  it("forces the terminal submit with the FLAT tool_choice shape", async () => {
    // Chat Completions' {type:'function',function:{name}} 400s here — and this
    // is the final turn of every forced run, after the budget is already spent.
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "submit_picks", args: "{}" });
    const { bodies } = scriptFetch([[respOutputItemDone(0, call), respCompleted([call], respUsage(1, 1))]]);

    await send(makeTransport(), SEED, "submit_picks");
    expect(bodies[0].tool_choice).toEqual({ type: "function", name: "submit_picks" });
  });

  it("omits the reasoning param for non-reasoning models", async () => {
    const { bodies } = scriptFetch([[respCompleted([], respUsage(1, 1))]]);
    await send(makeTransport("gpt-4.1-mini"), SEED);
    expect(bodies[0].reasoning).toBeUndefined();
  });

  it("includes prompt_cache_key only when the run supplies one", async () => {
    const { bodies } = scriptFetch([[respCompleted([], respUsage(1, 1))], [respCompleted([], respUsage(1, 1))]]);
    await send(makeTransport(), SEED);
    expect(bodies[0].prompt_cache_key).toBeUndefined();

    const keyed = createResponsesTransport({ model: "gpt-5.6-luna", apiKey: "k", url: "https://api.openai.example/v1/responses", promptCacheKey: "ledger-run-42" });
    await send(keyed, SEED);
    expect(bodies[1].prompt_cache_key).toBe("ledger-run-42");
  });

  it("declares forced tool choice as supported", () => {
    expect(makeTransport().capabilities.forcedToolChoice).toBe(true);
  });
});

describe("responsesTransport — reasoning round trip", () => {
  it("carries turn 1's reasoning item into turn 2's input[] unchanged", async () => {
    // This is the migration's entire justification: on Chat Completions the
    // reasoning is discarded every turn and there is no way to send it back.
    const reasoningItem = respReasoningItem({ id: "rs_1", summary: "Padres bullpen is rested.", encrypted: "gAAAAAB-opaque-blob==" });
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: '{"game_ids":["g1"]}' });
    const finalCall = respFunctionCallItem({ id: "fc_2", callId: "call_2", name: "submit_picks", args: '{"picks":[]}' });

    const { bodies } = scriptFetch([
      [
        ...respCreated(),
        respOutputItemAdded(0, { type: "reasoning", id: "rs_1", summary: [], status: "in_progress" }),
        respReasoningSummaryDelta("rs_1", 0, "Padres bullpen is rested."),
        respOutputItemDone(0, reasoningItem),
        respOutputItemAdded(1, { ...call, arguments: "", status: "in_progress" }),
        respArgsDone("fc_1", 1, "get_props", '{"game_ids":["g1"]}'),
        respOutputItemDone(1, call),
        respCompleted([reasoningItem, call], respUsage(500, 3000, 2800)),
      ],
      [respOutputItemDone(0, finalCall), respCompleted([finalCall], respUsage(900, 400, 100))],
    ]);

    const transport = makeTransport();
    const conversation: ConversationItem[] = [...SEED];
    const turn1 = await send(transport, conversation);

    expect(turn1.toolCalls).toEqual([{ id: "call_1", name: "get_props", arguments: '{"game_ids":["g1"]}' }]);
    expect(turn1.usage).toEqual({ inputTokens: 500, outputTokens: 3000, reasoningTokens: 2800 });

    // Exactly what the loop does after a tool-calling turn.
    conversation.push({ kind: "assistant", text: turn1.textContent, toolCalls: turn1.toolCalls, reasoning: turn1.reasoning });
    conversation.push({ kind: "toolResult", callId: "call_1", content: '{"props":[]}' });
    await send(transport, conversation);

    const input = bodies[1].input;
    const echoedReasoning = input.find((i: any) => i.type === "reasoning");
    expect(echoedReasoning).toEqual(reasoningItem);
    expect(echoedReasoning.encrypted_content).toBe("gAAAAAB-opaque-blob==");
    // Order is load-bearing: the reasoning item must still precede the
    // function_call it belongs to, which must precede its output.
    const kinds = input.map((i: any) => i.type ?? `role:${i.role}`);
    expect(kinds.slice(-3)).toEqual(["reasoning", "function_call", "function_call_output"]);
    // Every function_call in input[] has exactly one matching output, or the
    // request 400s with "No tool output found for function call".
    const callIds = input.filter((i: any) => i.type === "function_call").map((i: any) => i.call_id);
    const outputIds = input.filter((i: any) => i.type === "function_call_output").map((i: any) => i.call_id);
    expect(callIds.sort()).toEqual(outputIds.sort());
  });
});

describe("responsesTransport — failure paths", () => {
  it("surfaces a stream-level error as a throw, not an empty turn", async () => {
    scriptFetch([[...respCreated(), { event: "error", data: { type: "error", code: "server_error", message: "upstream exploded", param: null } }]]);
    await expect(send(makeTransport(), SEED)).rejects.toThrow(/upstream exploded/);
  });

  it("does not retry a plain 400", async () => {
    const fake = vi.fn(async () => new Response("bad request: unknown parameter", { status: 400 }));
    vi.stubGlobal("fetch", fake);
    await expect(send(makeTransport(), SEED)).rejects.toThrow(/LLM 400/);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("never downgrades the reasoning effort — an effort-rejection 400 surfaces", async () => {
    // Unlike the Chat transport, this wire has NO downgrade path: reasoning +
    // function tools is the supported combination here, so a 400 is either a
    // plumbing defect or an effort this model lacks. Silently stepping down
    // would leave the port "working" while delivering none of its benefit.
    // V3_REASONING_EFFORT is the lever if luna turns out not to take xhigh.
    process.env.V3_REASONING_EFFORT = "xhigh";
    const fake = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Unsupported value: 'reasoning.effort' does not support 'xhigh' with this model" } }), { status: 400 }));
    vi.stubGlobal("fetch", fake);
    await expect(send(makeTransport(), SEED)).rejects.toThrow(/LLM 400/);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("does NOT swallow a 400 that mentions reasoning", async () => {
    // The classic bring-up 400 ("reasoning item without its required following
    // item") must surface as a plumbing bug, not cost the run its effort.
    const fake = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Item of type 'reasoning' was provided without its required following item." } }), { status: 400 }));
    vi.stubGlobal("fetch", fake);
    await expect(send(makeTransport(), SEED)).rejects.toThrow(/LLM 400/);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx within the turn", async () => {
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "submit_picks", args: "{}" });
    let n = 0;
    const fake = vi.fn(async () => {
      if (n++ === 0) return new Response("upstream busy", { status: 503 });
      return new Response(sseStream([respOutputItemDone(0, call), respCompleted([call], respUsage(1, 1))], { chunkSize: Infinity }), { status: 200 });
    });
    vi.stubGlobal("fetch", fake);
    const res = await send(makeTransport(), SEED);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(res.toolCalls).toHaveLength(1);
  });

  it("rethrows immediately once the turn's signal is aborted", async () => {
    // Swallowing the abort turns a graceful timeout-and-finalize into a hard
    // failure and three full-cost Trigger.dev retries of the whole run.
    const ctrl = new AbortController();
    const fake = vi.fn(async () => {
      ctrl.abort();
      throw new Error("fetch failed: terminated");
    });
    vi.stubGlobal("fetch", fake);
    await expect(
      makeTransport().sendTurn({ conversation: SEED, tools: TOOLS, forceToolName: null, maxOutputTokens: 100, signal: ctrl.signal }),
    ).rejects.toThrow(/terminated/);
    expect(fake).toHaveBeenCalledTimes(1);
  });
});
