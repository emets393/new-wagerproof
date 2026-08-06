// Tests for the /v1/responses stream consumer.
//
// The failure this file exists to prevent: a parser that doesn't understand the
// wire returns {toolCalls: [], usage: null} and the loop reads that as "the
// model answered without a tool" — a GREEN run with zero picks and nothing
// thrown anywhere. So every test asserts on toolCalls / usage / finish, never
// merely on "no error".

import { describe, expect, it, vi } from "vitest";
import { consumeResponsesStream } from "./consumeResponsesStream";
import {
  rawStream,
  respArgsDelta,
  respArgsDone,
  respCompleted,
  respCreated,
  respEvent,
  respFailed,
  respFunctionCallItem,
  respIncomplete,
  respMessageItem,
  respOutputItemAdded,
  respOutputItemDone,
  respReasoningItem,
  respReasoningSummaryDelta,
  respStreamError,
  respTextDelta,
  respUsage,
  sseStream,
  sseText,
  streamFromParts,
} from "./__fixtures__/sseStream";

// A parser that buffers correctly gives identical output at every chunk size.
// 1 byte is maximally hostile, 7 is an odd offset, Infinity is one chunk.
const CHUNK_SIZES = [1, 7, Infinity];

describe("consumeResponsesStream — function calls", () => {
  it.each(CHUNK_SIZES)("harvests a single tool call, correlating by call_id not item id (chunkSize=%s)", async (chunkSize) => {
    const args = '{"game_ids":["g1"]}';
    const item = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_matchup", args });
    const res = await consumeResponsesStream(
      sseStream(
        [
          ...respCreated(),
          respOutputItemAdded(0, { ...item, arguments: "", status: "in_progress" }),
          respArgsDelta("fc_1", 0, args),
          respArgsDone("fc_1", 0, "get_matchup", args),
          respOutputItemDone(0, item),
          respCompleted([item], respUsage(100, 50)),
        ],
        { chunkSize },
      ),
    );

    // call_id is what must be echoed on the function_call_output; fc_ is not.
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "get_matchup", arguments: args }]);
    expect(res.finish).toBe("tool_calls");
    expect(res.usage).toEqual({ inputTokens: 100, outputTokens: 50, reasoningTokens: 0 });
  });

  it.each(CHUNK_SIZES)("keeps multiple concurrent tool calls separate (chunkSize=%s)", async (chunkSize) => {
    // Parallel calls are sibling items at different output_index values. Their
    // argument deltas INTERLEAVE and carry only item_id — accumulating by array
    // index (the Chat Completions rule) would merge them into one blob.
    const a = respFunctionCallItem({ id: "fc_a", callId: "call_a", name: "get_matchup", args: '{"game_ids":["g1"]}' });
    const b = respFunctionCallItem({ id: "fc_b", callId: "call_b", name: "get_props", args: '{"game_ids":["g2"]}' });
    const c = respFunctionCallItem({ id: "fc_c", callId: "call_c", name: "get_trends", args: '{"game_ids":["g3"]}' });

    const res = await consumeResponsesStream(
      sseStream(
        [
          ...respCreated(),
          respOutputItemAdded(0, { ...a, arguments: "", status: "in_progress" }),
          respOutputItemAdded(1, { ...b, arguments: "", status: "in_progress" }),
          respOutputItemAdded(2, { ...c, arguments: "", status: "in_progress" }),
          respArgsDelta("fc_a", 0, '{"game_ids"'),
          respArgsDelta("fc_b", 1, '{"game_ids"'),
          respArgsDelta("fc_c", 2, '{"game_ids"'),
          respArgsDelta("fc_b", 1, ':["g2"]}'),
          respArgsDelta("fc_a", 0, ':["g1"]}'),
          respArgsDelta("fc_c", 2, ':["g3"]}'),
          respOutputItemDone(0, a),
          respOutputItemDone(1, b),
          respOutputItemDone(2, c),
          respCompleted([a, b, c], respUsage(10, 20)),
        ],
        { chunkSize },
      ),
    );

    expect(res.toolCalls).toEqual([
      { id: "call_a", name: "get_matchup", arguments: '{"game_ids":["g1"]}' },
      { id: "call_b", name: "get_props", arguments: '{"game_ids":["g2"]}' },
      { id: "call_c", name: "get_trends", arguments: '{"game_ids":["g3"]}' },
    ]);
  });

  it("reassembles arguments split mid-JSON-string across a chunk boundary", async () => {
    const args = '{"picks":[{"reasoning":"Splitting \\"here\\" mid-string"}]}';
    const item = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "submit_picks", args });
    const wire = sseText([
      respOutputItemAdded(0, { ...item, arguments: "", status: "in_progress" }),
      respArgsDelta("fc_1", 0, args),
      respOutputItemDone(0, item),
      respCompleted([item], respUsage(1, 1)),
    ]);
    // Deliberate boundary inside the arguments string, past the escaped quotes.
    const cut = wire.indexOf("Splitting") + 12;
    const res = await consumeResponsesStream(streamFromParts([wire.slice(0, cut), wire.slice(cut)]));

    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0].arguments).toBe(args);
    expect(JSON.parse(res.toolCalls[0].arguments)).toEqual({ picks: [{ reasoning: 'Splitting "here" mid-string' }] });
  });

  it("falls back to reassembled deltas when the terminal item carries no arguments", async () => {
    // Defensive: output_item.done is the documented source of truth, but a turn
    // that only ever streamed deltas must still produce a usable tool call.
    const res = await consumeResponsesStream(
      sseStream([
        respOutputItemAdded(0, { type: "function_call", id: "fc_1", call_id: "call_1", name: "get_props", arguments: "", status: "in_progress" }),
        respArgsDelta("fc_1", 0, '{"game_ids":'),
        respArgsDelta("fc_1", 0, '["g1"]}'),
        respCompleted([{ type: "function_call", id: "fc_1", call_id: "call_1", name: "get_props" }], respUsage(5, 5)),
      ]),
    );
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "get_props", arguments: '{"game_ids":["g1"]}' }]);
  });

  it("prefers streamed deltas over an EMPTY arguments string on the terminal item", async () => {
    // "" is a string, so a naive `typeof item.arguments === "string" ? … : deltas`
    // lets it beat the fallback and throws away arguments that actually streamed.
    const args = '{"picks":[{"game_id":"g1"}]}';
    const res = await consumeResponsesStream(
      sseStream([
        respOutputItemAdded(0, { type: "function_call", id: "fc_1", call_id: "call_1", name: "submit_picks", arguments: "", status: "in_progress" }),
        respArgsDelta("fc_1", 0, args),
        // Terminal item still carries "" (observed when the turn is cut short).
        respIncomplete(
          [{ type: "function_call", id: "fc_1", call_id: "call_1", name: "submit_picks", arguments: "", status: "incomplete" }],
          "max_output_tokens",
          respUsage(9000, 40000, 39800),
        ),
      ]),
    );
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "submit_picks", arguments: args }]);
  });

  it("surfaces a blank-argument submit_picks as \"\", never as \"{}\"", async () => {
    // A turn cut off after the item opened but before ANY argument token. The
    // call must survive (echo pairing) but its arguments must stay EMPTY: the
    // loop treats "" as malformed, whereas "{}" parses clean and submitPicks
    // reads it as a valid zero-pick submission that ends the run green.
    const res = await consumeResponsesStream(
      sseStream([
        respOutputItemAdded(0, { type: "function_call", id: "fc_1", call_id: "call_1", name: "submit_picks", arguments: "", status: "in_progress" }),
        respIncomplete(
          [{ type: "function_call", id: "fc_1", call_id: "call_1", name: "submit_picks", arguments: "", status: "incomplete" }],
          "max_output_tokens",
          respUsage(9000, 40000, 40000),
        ),
      ]),
    );
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "submit_picks", arguments: "" }]);
    expect(res.finish).toBe("truncated");
  });

  it("keeps a truncated function_call rather than dropping it", async () => {
    // Every echoed function_call must get a matching function_call_output or the
    // NEXT request 400s. Dropping an unparseable one would orphan it.
    const partial = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "submit_picks", args: '{"picks":[{"game', status: "incomplete" });
    const res = await consumeResponsesStream(
      sseStream([
        respOutputItemAdded(0, { ...partial, arguments: "" }),
        respArgsDelta("fc_1", 0, '{"picks":[{"game'),
        respIncomplete([partial], "max_output_tokens", respUsage(9000, 24000, 23800)),
      ]),
    );
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "submit_picks", arguments: '{"picks":[{"game' }]);
    expect(() => JSON.parse(res.toolCalls[0].arguments)).toThrow();
    expect(res.finish).toBe("truncated");
  });
});

describe("consumeResponsesStream — text", () => {
  it.each(CHUNK_SIZES)("accumulates output_text deltas (chunkSize=%s)", async (chunkSize) => {
    const msg = respMessageItem({ id: "msg_1", text: "Hello, world", phase: "final_answer" });
    const res = await consumeResponsesStream(
      sseStream(
        [
          ...respCreated(),
          respOutputItemAdded(0, { ...msg, content: [] }),
          respTextDelta("msg_1", 0, "Hello, "),
          respTextDelta("msg_1", 0, "world"),
          respEvent("response.output_text.done", { item_id: "msg_1", output_index: 0, content_index: 0, text: "Hello, world", logprobs: [] }),
          respOutputItemDone(0, msg),
          respCompleted([msg], respUsage(3, 4)),
        ],
        { chunkSize },
      ),
    );
    expect(res.textContent).toBe("Hello, world");
    expect(res.toolCalls).toEqual([]);
    expect(res.finish).toBe("stop");
  });

  it("recovers text from the terminal output when no deltas streamed", async () => {
    const msg = respMessageItem({ id: "msg_1", text: "no deltas here" });
    const res = await consumeResponsesStream(sseStream([respCompleted([msg], respUsage(1, 1))]));
    expect(res.textContent).toBe("no deltas here");
  });

  it("surfaces a refusal as the turn's text instead of an empty turn", async () => {
    const res = await consumeResponsesStream(
      sseStream([
        respEvent("response.refusal.delta", { item_id: "msg_1", output_index: 0, content_index: 0, delta: "I can't " }),
        respEvent("response.refusal.done", { item_id: "msg_1", output_index: 0, content_index: 0, refusal: "I can't help with that." }),
        respCompleted([], respUsage(1, 1)),
      ]),
    );
    expect(res.textContent).toBe("I can't help with that.");
    expect(res.toolCalls).toEqual([]);
  });

  it("returns null rather than empty string when nothing was said", async () => {
    const res = await consumeResponsesStream(sseStream([respCompleted([], respUsage(1, 1))]));
    expect(res.textContent).toBeNull();
    expect(res.reasoning).toBeNull();
  });
});

describe("consumeResponsesStream — reasoning capture", () => {
  it.each(CHUNK_SIZES)("keeps the reasoning item verbatim for echo, and its summary as audit text (chunkSize=%s)", async (chunkSize) => {
    const reasoningItem = respReasoningItem({ id: "rs_1", summary: "Checking the MLB slate.", encrypted: "gAAAAABopaque==" });
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });

    const res = await consumeResponsesStream(
      sseStream(
        [
          ...respCreated(),
          respOutputItemAdded(0, { type: "reasoning", id: "rs_1", summary: [], status: "in_progress" }),
          respReasoningSummaryDelta("rs_1", 0, "Checking the "),
          respReasoningSummaryDelta("rs_1", 0, "MLB slate."),
          respOutputItemDone(0, reasoningItem),
          respOutputItemAdded(1, { ...call, arguments: "", status: "in_progress" }),
          respArgsDone("fc_1", 1, "get_props", "{}"),
          respOutputItemDone(1, call),
          respCompleted([reasoningItem, call], respUsage(200, 900, 850)),
        ],
        { chunkSize },
      ),
    );

    expect(res.reasoning?.text).toBe("Checking the MLB slate.");
    // raw is the provider's own output[] — reasoning FIRST, then the call it
    // justifies. Reordering or dropping either is a 400 on the next request.
    expect(res.reasoning?.raw).toEqual([reasoningItem, call]);
    expect((res.reasoning?.raw as any[])[0].encrypted_content).toBe("gAAAAABopaque==");
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "get_props", arguments: "{}" }]);
  });

  it("tolerates a turn with no reasoning item at all", async () => {
    // Effort "none"/"minimal" may emit no reasoning item; the loop must not care.
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "submit_picks", args: "{}" });
    const res = await consumeResponsesStream(sseStream([respOutputItemDone(0, call), respCompleted([call], respUsage(1, 1))]));
    expect(res.reasoning?.text).toBeNull();
    expect(res.reasoning?.raw).toEqual([call]);
    expect(res.toolCalls).toHaveLength(1);
  });

  it("accepts raw reasoning_text deltas as well as summary deltas", async () => {
    // UNCERTAINTY (wire contract): whether luna emits reasoning_text.* or only
    // reasoning_summary_text.* is undocumented. Handle both, require neither.
    const item = respReasoningItem({ id: "rs_1", encrypted: "blob" });
    const res = await consumeResponsesStream(
      sseStream([
        respEvent("response.reasoning_text.delta", { item_id: "rs_1", output_index: 0, content_index: 0, delta: "raw cot" }),
        respOutputItemDone(0, item),
        respCompleted([item], respUsage(1, 1)),
      ]),
    );
    expect(res.reasoning?.text).toBe("raw cot");
  });
});

describe("consumeResponsesStream — terminal signals", () => {
  it("maps response.incomplete/max_output_tokens onto the TRUNCATED finish signal", async () => {
    // If this ever regresses to "stop", a run that burned its cap on reasoning
    // ends green with zero picks and no error anywhere.
    const res = await consumeResponsesStream(
      sseStream([...respCreated(), respIncomplete([], "max_output_tokens", respUsage(12000, 24000, 24000))]),
    );
    expect(res.finish).toBe("truncated");
    expect(res.toolCalls).toEqual([]);
    expect(res.usage).toEqual({ inputTokens: 12000, outputTokens: 24000, reasoningTokens: 24000 });
  });

  it("treats a content_filter incomplete as truncated too, and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await consumeResponsesStream(sseStream([respIncomplete([], "content_filter")]));
    expect(res.finish).toBe("truncated");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("tolerates an incomplete response with no reason field", async () => {
    const res = await consumeResponsesStream(
      sseStream([
        respEvent("response.incomplete", { response: { id: "r", status: "incomplete", output: [], usage: respUsage(1, 1) } }),
      ]),
    );
    expect(res.finish).toBe("truncated");
  });

  it("throws on response.failed rather than returning an empty success", async () => {
    await expect(
      consumeResponsesStream(sseStream([...respCreated(), respFailed("server_error", "the model blew up")])),
    ).rejects.toThrow(/the model blew up/);
  });

  it("throws on the bare 'error' event (type is 'error', not 'response.error')", async () => {
    await expect(
      consumeResponsesStream(sseStream([...respCreated(), respStreamError("rate limit exceeded", "rate_limit")])),
    ).rejects.toThrow(/rate limit exceeded/);
  });

  it("throws when the stream just ends with no terminal event", async () => {
    // Observed-possible on cancellation. Silence here would be a green zero-pick run.
    await expect(
      consumeResponsesStream(sseStream([...respCreated(), respTextDelta("msg_1", 0, "half a thought")])),
    ).rejects.toThrow(/without a terminal event/);
  });
});

describe("consumeResponsesStream — usage", () => {
  it("reports reasoning tokens as a breakdown of outputTokens, never an addition", async () => {
    const res = await consumeResponsesStream(sseStream([respCompleted([], respUsage(1000, 5000, 4200))]));
    expect(res.usage).toEqual({ inputTokens: 1000, outputTokens: 5000, reasoningTokens: 4200 });
    // The governor bridge sums inputTokens+outputTokens; double-counting
    // reasoning would trip the token ceiling at roughly half the intended spend.
    expect(res.usage!.reasoningTokens).toBeLessThanOrEqual(res.usage!.outputTokens);
  });

  it("returns null usage when the terminal event carries none", async () => {
    const res = await consumeResponsesStream(
      sseStream([respEvent("response.completed", { response: { id: "r", status: "completed", output: [] } })]),
    );
    expect(res.usage).toBeNull();
  });
});

describe("consumeResponsesStream — wire robustness", () => {
  it("ignores unknown event types instead of throwing", async () => {
    // OpenAI adds events without a version bump; throwing on one takes
    // generation down for everyone.
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });
    const res = await consumeResponsesStream(
      sseStream([
        respEvent("response.web_search_call.in_progress", { item_id: "ws_1", output_index: 0 }),
        respEvent("response.some_future_thing.delta", { item_id: "x", delta: "?" }),
        respOutputItemDone(0, call),
        respCompleted([call], respUsage(1, 1)),
      ]),
    );
    expect(res.toolCalls).toHaveLength(1);
  });

  it("tolerates the obfuscation padding field on delta events", async () => {
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });
    const wire = sseText([
      { event: "response.function_call_arguments.delta", data: { type: "response.function_call_arguments.delta", item_id: "fc_1", output_index: 0, delta: "{}", obfuscation: "aZ9qX2" } },
      respOutputItemDone(0, call),
      respCompleted([call], respUsage(1, 1)),
    ]);
    const res = await consumeResponsesStream(rawStream(wire, { chunkSize: 3 }));
    expect(res.toolCalls).toHaveLength(1);
  });

  it("skips unparseable frames and CRLF line endings", async () => {
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });
    const wire =
      "event: response.output_item.done\r\n" +
      `data: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: call })}\r\n\r\n` +
      "data: {not json at all\r\n\r\n" +
      ": a comment line\r\n\r\n" +
      `data: ${JSON.stringify({ type: "response.completed", response: { id: "r", status: "completed", output: [call], usage: respUsage(1, 1) } })}\r\n\r\n`;
    const res = await consumeResponsesStream(rawStream(wire));
    expect(res.toolCalls).toHaveLength(1);
    expect(res.usage).not.toBeNull();
  });

  it("flushes a terminal frame that has no trailing newline", async () => {
    // Deliberate divergence from consumeChatStreamV3, which drops it: here the
    // dropped frame would be the ONLY terminal event.
    const call = respFunctionCallItem({ id: "fc_1", callId: "call_1", name: "get_props", args: "{}" });
    const wire = sseText([respOutputItemDone(0, call), respCompleted([call], respUsage(2, 3))]).trimEnd();
    const res = await consumeResponsesStream(rawStream(wire));
    expect(res.toolCalls).toHaveLength(1);
    expect(res.usage).toEqual({ inputTokens: 2, outputTokens: 3, reasoningTokens: 0 });
  });

  it("survives a boundary that splits a multi-byte UTF-8 character", async () => {
    const msg = respMessageItem({ id: "msg_1", text: "über — 🎯" });
    const res = await consumeResponsesStream(
      sseStream([respTextDelta("msg_1", 0, "über — 🎯"), respCompleted([msg], respUsage(1, 1))], { chunkSize: 1 }),
    );
    expect(res.textContent).toBe("über — 🎯");
  });
});
