// Synthetic SSE stream builder for the V3 loop's stream consumers
// (consumeChatStreamV3 today, the /v1/responses parser next).
//
// The whole point is chunk-boundary control: a real provider splits SSE frames
// at arbitrary byte offsets, so a parser that only works when one chunk == one
// event passes tests and fails in prod. `chunkSize` lets a test slice the same
// wire bytes at 1 byte, 7 bytes, or whole-event granularity and assert the
// result is identical.

/** One SSE frame. `data` is JSON-encoded unless it is already a string
 *  sentinel like "[DONE]" (pass `raw: true` for that). */
export interface SseEvent {
  data: unknown;
  /** Emit `data` verbatim instead of JSON.stringify-ing it (e.g. "[DONE]"). */
  raw?: boolean;
  /** SSE `event:` name — used by /v1/responses, ignored by Chat Completions. */
  event?: string;
}

/** Serialize events to the exact bytes a provider would put on the wire. */
export function sseText(events: SseEvent[]): string {
  return events
    .map((e) => {
      const payload = e.raw ? String(e.data) : JSON.stringify(e.data);
      const head = e.event ? `event: ${e.event}\n` : "";
      return `${head}data: ${payload}\n\n`;
    })
    .join("");
}

/**
 * Build a ReadableStream<Uint8Array> of `events`, split into fixed-size byte
 * chunks. `chunkSize` defaults to 1 so events are split across boundaries by
 * default — the failure mode we actually care about locking down. Pass
 * `Infinity` for a single-chunk stream.
 */
export function sseStream(
  events: SseEvent[],
  opts: { chunkSize?: number } = {},
): ReadableStream<Uint8Array> {
  return chunkedStream(sseText(events), opts.chunkSize ?? 1);
}

/** Same as sseStream but takes pre-serialized wire text, for malformed-frame
 *  cases (bad JSON, stray lines, \r\n) that the typed builder can't express. */
export function rawStream(
  text: string,
  opts: { chunkSize?: number } = {},
): ReadableStream<Uint8Array> {
  return chunkedStream(text, opts.chunkSize ?? 1);
}

/** Stream arbitrary text at explicit split points, so a test can place a
 *  boundary mid-token (e.g. inside a JSON argument string) deliberately. */
export function streamFromParts(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
}

function chunkedStream(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  const size = Number.isFinite(chunkSize) ? Math.max(1, Math.floor(chunkSize)) : bytes.length;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) {
        controller.enqueue(bytes.slice(i, i + size));
      }
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Chat Completions chunk builders — keep test bodies about behavior, not shape.
// ---------------------------------------------------------------------------

/** A `choices[0].delta` chunk. */
export function chatDelta(
  delta: Record<string, unknown>,
  extra: { finish_reason?: string | null } = {},
): SseEvent {
  return {
    data: {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta, finish_reason: extra.finish_reason ?? null }],
    },
  };
}

/** The usage-only final chunk: empty `choices`, usage present. Providers emit
 *  this only when the request sets stream_options:{include_usage:true}. */
export function chatUsage(prompt_tokens: number, completion_tokens: number): SseEvent {
  return {
    data: {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [],
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
      },
    },
  };
}

/** One tool-call delta fragment. Providers stream `id`/`name` on the first
 *  fragment for an index and only `arguments` thereafter. */
export function chatToolCallDelta(
  index: number,
  frag: { id?: string; name?: string; args?: string },
): SseEvent {
  const tc: Record<string, unknown> = { index };
  if (frag.id) tc.id = frag.id;
  const fn: Record<string, unknown> = {};
  if (frag.name) fn.name = frag.name;
  if (frag.args !== undefined) fn.arguments = frag.args;
  if (Object.keys(fn).length) tc.function = fn;
  return chatDelta({ tool_calls: [tc] });
}

export const DONE: SseEvent = { data: "[DONE]", raw: true };

// ---------------------------------------------------------------------------
// /v1/responses event builders.
//
// Responses is named-event SSE: every frame carries an `event:` header AND a
// `type` field inside the JSON. The builders emit both, so a parser keying off
// either one sees a realistic frame. `sequence_number` is present because the
// wire has it; nothing consumes it.
// ---------------------------------------------------------------------------

let respSeq = 0;

/** Generic Responses frame: `event: <type>` + a data payload carrying `type`. */
export function respEvent(type: string, payload: Record<string, unknown> = {}): SseEvent {
  return { event: type, data: { type, sequence_number: respSeq++, ...payload } };
}

/** A function_call output item. `id` (fc_) and `call_id` (call_) are DIFFERENT
 *  values on the wire — tests rely on that to catch a parser echoing the wrong one. */
export function respFunctionCallItem(opts: {
  id: string;
  callId: string;
  name: string;
  args?: string;
  status?: "in_progress" | "completed" | "incomplete";
}): Record<string, unknown> {
  return {
    type: "function_call",
    id: opts.id,
    call_id: opts.callId,
    name: opts.name,
    arguments: opts.args ?? "",
    status: opts.status ?? "completed",
  };
}

/** A reasoning output item. `encrypted_content` is the opaque blob that must
 *  survive a round trip byte-for-byte. */
export function respReasoningItem(opts: {
  id: string;
  summary?: string;
  encrypted?: string | null;
  status?: string;
}): Record<string, unknown> {
  return {
    type: "reasoning",
    id: opts.id,
    summary: opts.summary ? [{ type: "summary_text", text: opts.summary }] : [],
    encrypted_content: opts.encrypted ?? null,
    status: opts.status ?? "completed",
  };
}

/** An assistant message output item. */
export function respMessageItem(opts: { id: string; text: string; phase?: string }): Record<string, unknown> {
  return {
    type: "message",
    id: opts.id,
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: opts.text, annotations: [] }],
    ...(opts.phase ? { phase: opts.phase } : {}),
  };
}

export function respOutputItemAdded(outputIndex: number, item: Record<string, unknown>): SseEvent {
  return respEvent("response.output_item.added", { output_index: outputIndex, item });
}

export function respOutputItemDone(outputIndex: number, item: Record<string, unknown>): SseEvent {
  return respEvent("response.output_item.done", { output_index: outputIndex, item });
}

/** Argument deltas carry item_id ONLY — no name, no call_id. */
export function respArgsDelta(itemId: string, outputIndex: number, delta: string): SseEvent {
  return respEvent("response.function_call_arguments.delta", { item_id: itemId, output_index: outputIndex, delta });
}

export function respArgsDone(itemId: string, outputIndex: number, name: string, args: string): SseEvent {
  return respEvent("response.function_call_arguments.done", { item_id: itemId, output_index: outputIndex, name, arguments: args });
}

export function respTextDelta(itemId: string, outputIndex: number, delta: string): SseEvent {
  return respEvent("response.output_text.delta", { item_id: itemId, output_index: outputIndex, content_index: 0, delta, logprobs: [] });
}

export function respReasoningSummaryDelta(itemId: string, outputIndex: number, delta: string): SseEvent {
  return respEvent("response.reasoning_summary_text.delta", { item_id: itemId, output_index: outputIndex, summary_index: 0, delta });
}

export function respUsage(inputTokens: number, outputTokens: number, reasoningTokens = 0): Record<string, unknown> {
  return {
    input_tokens: inputTokens,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    output_tokens: outputTokens,
    // Reasoning tokens are a BREAKDOWN of output_tokens, not an addition to it.
    output_tokens_details: { reasoning_tokens: reasoningTokens },
    total_tokens: inputTokens + outputTokens,
  };
}

export function respCompleted(output: Record<string, unknown>[], usage?: Record<string, unknown>): SseEvent {
  return respEvent("response.completed", {
    response: { id: "resp_test", status: "completed", output, usage: usage ?? respUsage(0, 0), incomplete_details: null },
  });
}

export function respIncomplete(
  output: Record<string, unknown>[],
  reason: "max_output_tokens" | "content_filter" = "max_output_tokens",
  usage?: Record<string, unknown>,
): SseEvent {
  return respEvent("response.incomplete", {
    response: { id: "resp_test", status: "incomplete", output, usage: usage ?? respUsage(0, 0), incomplete_details: { reason } },
  });
}

export function respFailed(code: string, message: string): SseEvent {
  return respEvent("response.failed", {
    response: { id: "resp_test", status: "failed", output: [], error: { code, message } },
  });
}

/** TERMINAL stream-level error. The type is the bare string "error", NOT
 *  "response.error" — a handler switching only on "response.*" hangs on it. */
export function respStreamError(message: string, code: string | null = null): SseEvent {
  return respEvent("error", { code, message, param: null });
}

/** The lifecycle preamble every real stream opens with. */
export function respCreated(): SseEvent[] {
  return [
    respEvent("response.created", { response: { id: "resp_test", status: "in_progress", output: [] } }),
    respEvent("response.in_progress", { response: { id: "resp_test", status: "in_progress", output: [] } }),
  ];
}
