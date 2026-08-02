// Characterization tests for consumeChatStreamV3 — they lock in CURRENT
// behavior of the Chat Completions consumer before the /v1/responses port, so
// any change to the DeepSeek transport shows up as a failing test rather than
// a silent prod regression.

import { describe, expect, it } from "vitest";
import { consumeChatStreamV3 } from "./consumeChatStreamV3";
import {
  DONE,
  chatDelta,
  chatToolCallDelta,
  chatUsage,
  rawStream,
  sseStream,
  streamFromParts,
} from "./__fixtures__/sseStream";

// Every logical case is run at several chunk sizes: 1 byte (maximally hostile),
// 7 bytes (odd offset), and whole-stream. A parser that buffers correctly gives
// identical output at all three.
const CHUNK_SIZES = [1, 7, Infinity];

describe("consumeChatStreamV3 — text content", () => {
  it.each(CHUNK_SIZES)("accumulates content deltas (chunkSize=%s)", async (chunkSize) => {
    const res = await consumeChatStreamV3(
      sseStream(
        [
          chatDelta({ role: "assistant", content: "" }),
          chatDelta({ content: "Hello" }),
          chatDelta({ content: ", " }),
          chatDelta({ content: "world" }),
          chatDelta({}, { finish_reason: "stop" }),
          DONE,
        ],
        { chunkSize },
      ),
    );

    expect(res.textContent).toBe("Hello, world");
    expect(res.toolCalls).toEqual([]);
    expect(res.finishReason).toBe("stop");
    expect(res.reasoning).toBeNull();
  });

  it("returns null rather than empty string when no content arrives", async () => {
    const res = await consumeChatStreamV3(sseStream([chatDelta({ content: "" }), DONE]));
    expect(res.textContent).toBeNull();
    expect(res.reasoning).toBeNull();
    expect(res.usage).toBeNull();
    expect(res.finishReason).toBeNull();
  });

  it("survives a boundary that splits a multi-byte UTF-8 character", async () => {
    // TextDecoder must be in stream mode or an emoji straddling two chunks
    // decodes as replacement characters.
    const text = "über — 🎯";
    const res = await consumeChatStreamV3(
      sseStream([chatDelta({ content: text }), DONE], { chunkSize: 1 }),
    );
    expect(res.textContent).toBe(text);
  });
});

describe("consumeChatStreamV3 — tool calls", () => {
  it.each(CHUNK_SIZES)(
    "accumulates a single tool call's arguments across fragments (chunkSize=%s)",
    async (chunkSize) => {
      const res = await consumeChatStreamV3(
        sseStream(
          [
            chatToolCallDelta(0, { id: "call_abc", name: "get_games", args: "" }),
            chatToolCallDelta(0, { args: '{"sport"' }),
            chatToolCallDelta(0, { args: ':"mlb",' }),
            chatToolCallDelta(0, { args: '"limit":5}' }),
            chatDelta({}, { finish_reason: "tool_calls" }),
            DONE,
          ],
          { chunkSize },
        ),
      );

      expect(res.finishReason).toBe("tool_calls");
      expect(res.toolCalls).toEqual([
        { index: 0, id: "call_abc", name: "get_games", arguments: '{"sport":"mlb","limit":5}' },
      ]);
      expect(JSON.parse(res.toolCalls[0].arguments)).toEqual({ sport: "mlb", limit: 5 });
    },
  );

  it("keys parallel tool calls by index, not arrival order", async () => {
    // Providers interleave fragments for concurrent calls; index is the only
    // stable identity.
    const res = await consumeChatStreamV3(
      sseStream(
        [
          chatToolCallDelta(0, { id: "call_0", name: "get_games", args: '{"a' }),
          chatToolCallDelta(1, { id: "call_1", name: "get_odds", args: '{"b' }),
          chatToolCallDelta(1, { args: '":2}' }),
          chatToolCallDelta(0, { args: '":1}' }),
          chatDelta({}, { finish_reason: "tool_calls" }),
          DONE,
        ],
        { chunkSize: 3 },
      ),
    );

    expect(res.toolCalls).toEqual([
      { index: 0, id: "call_0", name: "get_games", arguments: '{"a":1}' },
      { index: 1, id: "call_1", name: "get_odds", arguments: '{"b":2}' },
    ]);
  });

  it("defaults a missing tool_call index to 0", async () => {
    const res = await consumeChatStreamV3(
      sseStream(
        [
          chatDelta({ tool_calls: [{ id: "call_x", function: { name: "submit_picks" } }] }),
          chatDelta({ tool_calls: [{ function: { arguments: "{}" } }] }),
          DONE,
        ],
        { chunkSize: 5 },
      ),
    );
    expect(res.toolCalls).toEqual([
      { index: 0, id: "call_x", name: "submit_picks", arguments: "{}" },
    ]);
  });

  it("synthesizes an id when the provider never sends one", async () => {
    const res = await consumeChatStreamV3(
      sseStream([chatToolCallDelta(2, { name: "get_games", args: "{}" }), DONE]),
    );
    expect(res.toolCalls).toEqual([
      { index: 2, id: "call_2", name: "get_games", arguments: "{}" },
    ]);
  });

  it("drops accumulated fragments that never got a function name", async () => {
    const res = await consumeChatStreamV3(
      sseStream(
        [
          chatToolCallDelta(0, { id: "call_named", name: "get_games", args: "{}" }),
          chatToolCallDelta(1, { id: "call_orphan", args: '{"dangling":true}' }),
          DONE,
        ],
        { chunkSize: 4 },
      ),
    );
    expect(res.toolCalls.map((c) => c.name)).toEqual(["get_games"]);
  });

  it("splits an argument fragment mid-JSON-string across the chunk boundary", async () => {
    // Deliberate: the boundary lands inside the escaped quote of a value, the
    // classic place a naive "parse each chunk" consumer corrupts arguments.
    const frame = (args: string) =>
      `data: ${JSON.stringify({
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: args } }] } }],
      })}\n\n`;
    const head = `data: ${JSON.stringify({
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_s", function: { name: "search" } }] },
        },
      ],
    })}\n\n`;
    const wire = head + frame('{"q":"Yankees ') + frame('vs \\"Sox\\""}');

    const res = await consumeChatStreamV3(
      streamFromParts([wire.slice(0, 40), wire.slice(40, 41), wire.slice(41, 200), wire.slice(200)]),
    );
    expect(JSON.parse(res.toolCalls[0].arguments)).toEqual({ q: 'Yankees vs "Sox"' });
  });
});

describe("consumeChatStreamV3 — DeepSeek reasoning_content", () => {
  it.each(CHUNK_SIZES)(
    "accumulates reasoning_content separately from content (chunkSize=%s)",
    async (chunkSize) => {
      const res = await consumeChatStreamV3(
        sseStream(
          [
            chatDelta({ reasoning_content: "Let me " }),
            chatDelta({ reasoning_content: "check the lines." }),
            chatDelta({ content: "Taking " }),
            chatDelta({ content: "the under." }),
            chatDelta({}, { finish_reason: "stop" }),
            DONE,
          ],
          { chunkSize },
        ),
      );

      expect(res.reasoning).toBe("Let me check the lines.");
      expect(res.textContent).toBe("Taking the under.");
    },
  );

  it("keeps reasoning when the turn ends in tool calls (V4 passes it back)", async () => {
    const res = await consumeChatStreamV3(
      sseStream([
        chatDelta({ reasoning_content: "Need the slate first." }),
        chatToolCallDelta(0, { id: "call_r", name: "get_games", args: "{}" }),
        chatDelta({}, { finish_reason: "tool_calls" }),
        DONE,
      ]),
    );
    expect(res.reasoning).toBe("Need the slate first.");
    expect(res.textContent).toBeNull();
    expect(res.toolCalls).toHaveLength(1);
  });
});

describe("consumeChatStreamV3 — usage chunk", () => {
  it.each(CHUNK_SIZES)(
    "captures the usage-only final chunk with empty choices (chunkSize=%s)",
    async (chunkSize) => {
      const res = await consumeChatStreamV3(
        sseStream(
          [
            chatDelta({ content: "hi" }),
            chatDelta({}, { finish_reason: "stop" }),
            chatUsage(1234, 567),
            DONE,
          ],
          { chunkSize },
        ),
      );

      expect(res.usage).toEqual({ prompt_tokens: 1234, completion_tokens: 567 });
      // The usage chunk must not clobber the finish_reason from the prior chunk.
      expect(res.finishReason).toBe("stop");
      expect(res.textContent).toBe("hi");
    },
  );

  it("coerces missing usage fields to 0 rather than NaN", async () => {
    const res = await consumeChatStreamV3(
      sseStream([{ data: { choices: [], usage: { prompt_tokens: 10 } } }, DONE]),
    );
    expect(res.usage).toEqual({ prompt_tokens: 10, completion_tokens: 0 });
  });

  it("leaves usage null when include_usage was not requested", async () => {
    const res = await consumeChatStreamV3(
      sseStream([chatDelta({ content: "x" }), chatDelta({}, { finish_reason: "stop" }), DONE]),
    );
    expect(res.usage).toBeNull();
  });
});

describe("consumeChatStreamV3 — finish_reason", () => {
  it("captures a length stop (token ceiling hit mid-answer)", async () => {
    const res = await consumeChatStreamV3(
      sseStream([chatDelta({ content: "truncat" }), chatDelta({}, { finish_reason: "length" }), DONE]),
    );
    expect(res.finishReason).toBe("length");
  });

  it("keeps the last non-null finish_reason seen", async () => {
    const res = await consumeChatStreamV3(
      sseStream([
        chatDelta({ content: "a" }, { finish_reason: null }),
        chatDelta({}, { finish_reason: "tool_calls" }),
        DONE,
      ]),
    );
    expect(res.finishReason).toBe("tool_calls");
  });
});

describe("consumeChatStreamV3 — framing and error handling", () => {
  it("ignores [DONE] and stops cleanly (no JSON parse of the sentinel)", async () => {
    const res = await consumeChatStreamV3(
      rawStream(`data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n`),
    );
    expect(res.textContent).toBe("ok");
  });

  it("ignores comment lines, blank lines and non-data SSE fields", async () => {
    const res = await consumeChatStreamV3(
      rawStream(
        `: keep-alive\n\nevent: message\ndata: {"choices":[{"delta":{"content":"a"}}]}\n\n\n\ndata: [DONE]\n\n`,
        { chunkSize: 3 },
      ),
    );
    expect(res.textContent).toBe("a");
  });

  it("tolerates CRLF line endings", async () => {
    const res = await consumeChatStreamV3(
      rawStream(`data: {"choices":[{"delta":{"content":"crlf"}}]}\r\n\r\ndata: [DONE]\r\n\r\n`),
    );
    expect(res.textContent).toBe("crlf");
  });

  it("skips an unparseable frame instead of throwing", async () => {
    const res = await consumeChatStreamV3(
      rawStream(
        `data: {not json\n\ndata: {"choices":[{"delta":{"content":"still here"}}]}\n\ndata: [DONE]\n\n`,
      ),
    );
    expect(res.textContent).toBe("still here");
  });

  it("throws when the provider streams an error object", async () => {
    await expect(
      consumeChatStreamV3(
        sseStream([
          chatDelta({ content: "partial" }),
          { data: { error: { message: "Insufficient Balance" } } },
          DONE,
        ]),
      ),
    ).rejects.toThrow(/LLM stream failed: Insufficient Balance/);
  });

  it("drops a trailing frame with no terminating newline", async () => {
    // Current behavior, asserted so the /v1/responses parser can choose to
    // differ deliberately rather than by accident: the consumer only processes
    // complete lines, so an unterminated final frame is discarded.
    const res = await consumeChatStreamV3(
      rawStream(
        `data: {"choices":[{"delta":{"content":"kept"}}]}\n\ndata: {"choices":[{"delta":{"content":"lost"}}]}`,
      ),
    );
    expect(res.textContent).toBe("kept");
  });
});
