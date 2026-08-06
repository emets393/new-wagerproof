// consumeResponsesStream — streaming consumer for POST /v1/responses, the
// Responses-API counterpart to consumeChatStreamV3. Returns the SAME neutral
// TurnResult the loop already consumes (see transport.ts).
//
// Three things make this wire different from Chat Completions, and all three
// are load-bearing:
//
//  1. Tool calls are TOP-LEVEL items correlated by `item_id` / `call_id`, not
//     array positions in `delta.tool_calls[]`. Accumulating by index here would
//     silently merge parallel calls.
//  2. There is no `finish_reason`. Truncation is `response.incomplete`, and a
//     parser that fails to map it onto FinishSignal "truncated" turns a run that
//     burned its output cap into a green run with zero picks.
//  3. Reasoning must survive to the NEXT request. `response.output[]` from the
//     terminal event is the authoritative, fully-assembled item array, and the
//     docs require echoing it back verbatim — so we park it whole in
//     ReasoningCarrier.raw rather than reconstructing it from deltas.
//
// Event names and field names below come from the OpenAI Node SDK v7.3.0
// generated types (same OpenAPI spec as the streaming-events reference page).
// Unknown event types are IGNORED on purpose: OpenAI adds events without a
// version bump, and throwing on one would take generation down.

import type { FinishSignal, NeutralToolCall, NormalizedUsage, ReasoningCarrier, TurnResult } from "./transport";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

/** One in-flight top-level output item, keyed by its `item_id` (the `fc_`/`rs_`
 *  id). NOT keyed by output_index: index is presentation order, item_id is
 *  identity, and the argument-delta events carry only item_id. */
interface StreamItem {
  outputIndex: number;
  itemId: string;
  type: string;
  /** `call_id` (the `call_` value) — a DIFFERENT value from itemId, and the one
   *  that must be echoed on the matching function_call_output. */
  callId: string | null;
  name: string | null;
  /** Concatenated response.function_call_arguments.delta payloads. */
  args: string;
  /** Full arguments from function_call_arguments.done / output_item.done —
   *  preferred over `args`, which is only reassembled deltas. */
  argsDone: string | null;
  /** The finished item object from response.output_item.done, kept verbatim so
   *  reasoning `encrypted_content` can be echoed byte-for-byte. */
  final: Json | null;
}

export async function consumeResponsesStream(body: ReadableStream<Uint8Array>): Promise<TurnResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const items = new Map<string, StreamItem>();
  let textContent = "";
  let refusalText = "";
  let reasoningText = "";
  let terminalResponse: Json | null = null;
  let terminalKind: "completed" | "incomplete" | null = null;
  let fatalError: string | null = null;

  const touch = (itemId: string, outputIndex: number, type?: string): StreamItem => {
    let it = items.get(itemId);
    if (!it) {
      it = { outputIndex, itemId, type: type ?? "unknown", callId: null, name: null, args: "", argsDone: null, final: null };
      items.set(itemId, it);
    }
    if (type && it.type === "unknown") it.type = type;
    return it;
  };

  const handle = (data: Json): void => {
    const type: unknown = data?.type;
    if (typeof type !== "string") return;

    switch (type) {
      // Lifecycle. response.created carries the id (needed only for cancel) and
      // an EMPTY output array — never treat it as output.
      case "response.created":
      case "response.in_progress":
      case "response.queued":
        return;

      case "response.output_item.added": {
        const item = data.item;
        if (!item?.id) return;
        const it = touch(String(item.id), Number(data.output_index ?? 0), String(item.type ?? "unknown"));
        // Capture the item_id → call_id mapping NOW: argument-delta events carry
        // item_id only, so without this the tool result cannot be correlated.
        if (item.call_id) it.callId = String(item.call_id);
        if (item.name) it.name = String(item.name);
        return;
      }

      case "response.output_item.done": {
        const item = data.item;
        if (!item?.id) return;
        const it = touch(String(item.id), Number(data.output_index ?? 0), String(item.type ?? "unknown"));
        it.final = item;
        if (item.call_id) it.callId = String(item.call_id);
        if (item.name) it.name = String(item.name);
        // The single most reliable place to harvest a tool call's arguments.
        if (typeof item.arguments === "string") it.argsDone = item.arguments;
        return;
      }

      case "response.function_call_arguments.delta": {
        if (!data.item_id || typeof data.delta !== "string") return;
        touch(String(data.item_id), Number(data.output_index ?? 0), "function_call").args += data.delta;
        return;
      }

      case "response.function_call_arguments.done": {
        if (!data.item_id) return;
        const it = touch(String(data.item_id), Number(data.output_index ?? 0), "function_call");
        if (data.name) it.name = String(data.name);
        if (typeof data.arguments === "string") it.argsDone = data.arguments;
        return;
      }

      case "response.output_text.delta":
        if (typeof data.delta === "string") textContent += data.delta;
        return;

      case "response.refusal.delta":
        if (typeof data.delta === "string") refusalText += data.delta;
        return;

      case "response.refusal.done":
        if (typeof data.refusal === "string") refusalText = data.refusal;
        return;

      // Two independent reasoning text streams: the SUMMARY (opt-in via
      // reasoning.summary, indexed by summary_index) and raw reasoning_text
      // (only some models emit it, indexed by content_index). Handle both,
      // require neither — for the audit trace they are interchangeable.
      case "response.reasoning_summary_text.delta":
      case "response.reasoning_text.delta":
        if (typeof data.delta === "string") reasoningText += data.delta;
        return;

      case "response.completed":
      case "response.incomplete":
        terminalResponse = data.response ?? null;
        terminalKind = type === "response.completed" ? "completed" : "incomplete";
        return;

      case "response.failed": {
        // The error lives on the response object, not on the event.
        const err = data.response?.error;
        fatalError = err?.message || err?.code || "response failed";
        return;
      }

      // TERMINAL stream-level error. The type is the bare string "error", NOT
      // "response.error" — a handler that only switches on "response.*" waits
      // forever for a terminal event that never comes.
      case "error":
        fatalError = data.message || data.code || "stream error";
        return;

      default:
        // response.content_part.*, response.output_text.done,
        // response.reasoning_summary_part.*, built-in tool events, and anything
        // OpenAI adds later. Nothing here is needed to assemble a turn.
        return;
    }
  };

  const consumeLine = (rawLine: string): void => {
    const line = rawLine.trim();
    // The `event:` line duplicates the JSON's own `type`, so we key off the
    // payload and ignore the header — one fewer thing to keep in sync.
    if (!line.startsWith("data:")) return;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return;
    let data: Json;
    try { data = JSON.parse(dataStr); } catch { return; }
    handle(data);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);
      consumeLine(line);
    }
  }
  // DELIBERATE difference from consumeChatStreamV3, which drops a trailing frame
  // that has no terminating newline: here that frame could be the terminal
  // event, and dropping it would turn a completed turn into a thrown
  // "no terminal event". Flushing costs nothing.
  if (buffer) consumeLine(buffer);

  if (fatalError) throw new Error(`LLM stream failed: ${fatalError}`);
  if (!terminalKind) {
    // Four terminal events exist (completed / incomplete / failed / error) and
    // none arrived. UNCERTAINTY (wire contract): a client abort or server-side
    // cancellation may simply close the stream with no terminal event, so this
    // is reachable. Throwing beats returning an empty success, which the loop
    // would read as "model answered without a tool" and end the run green.
    throw new Error("LLM stream ended without a terminal event (no completed/incomplete/failed)");
  }

  // response.output[] is the authoritative, fully-assembled item array. Fall
  // back to what we assembled from item events only if the terminal event
  // somehow carried none.
  const streamed = [...items.values()].sort((a, b) => a.outputIndex - b.outputIndex);
  const fromTerminal: Json[] = Array.isArray(terminalResponse?.output) ? terminalResponse.output : [];
  const output: Json[] = fromTerminal.length > 0 ? fromTerminal : streamed.map(synthesizeItem);

  const toolCalls: NeutralToolCall[] = [];
  output.forEach((item, i) => {
    if (item?.type !== "function_call") return;
    const byId = item.id ? items.get(String(item.id)) : undefined;
    // "" is NOT "these are the arguments" — a turn cut off just after the item
    // opened carries an empty string, and taking it verbatim would discard
    // argument deltas that DID stream. Prefer the first non-empty source.
    const args =
      [typeof item.arguments === "string" ? item.arguments : "", byId?.argsDone ?? "", byId?.args ?? ""]
        .find((s) => s.length > 0) ?? "";
    // NEVER drop a function_call, not even one with truncated/unparseable
    // arguments or a missing name: `output` is echoed back verbatim next turn,
    // and an echoed function_call without its function_call_output is a hard
    // 400. A blank `arguments` reaches the loop as "" and the loop treats that
    // as malformed (it must NOT coerce to "{}", which submit_picks would read as
    // a valid zero-pick submission); an unknown tool name comes back as an error
    // tool result — both keep the call/output pairing intact.
    toolCalls.push({
      id: String(item.call_id ?? item.id ?? `call_${i}`),
      name: String(item.name ?? ""),
      arguments: args,
    });
  });

  if (!textContent) textContent = textFromOutput(output);
  if (!reasoningText) reasoningText = reasoningTextFromOutput(output);
  // A refusal means no tool call is coming from that item; surface it as the
  // turn's text so the audit trail and the assistant turn aren't blank.
  if (refusalText) textContent = textContent ? `${textContent}\n${refusalText}` : refusalText;

  let finish: FinishSignal;
  if (terminalKind === "incomplete") {
    const reason = terminalResponse?.incomplete_details?.reason;
    // Both documented reasons (max_output_tokens | content_filter) mean the turn
    // was CUT OFF, so both map to "truncated" — the loop then trips the circuit,
    // retries once, and fails loudly instead of ending green with zero picks.
    // `reason` is itself optional in the schema, hence the guard.
    if (reason && reason !== "max_output_tokens") {
      console.warn(`[v3] responses stream incomplete: reason=${reason}`);
    }
    finish = "truncated";
  } else {
    finish = toolCalls.length > 0 ? "tool_calls" : "stop";
  }

  const reasoning: ReasoningCarrier | null =
    output.length > 0 || reasoningText
      ? { text: reasoningText || null, ...(output.length > 0 ? { raw: output } : {}) }
      : null;

  return {
    toolCalls,
    textContent: textContent || null,
    reasoning,
    finish,
    usage: normalizeUsage(terminalResponse?.usage),
  };
}

/** Rebuild an item object from the streamed events, for the (unexpected) case
 *  where the terminal event carried no output array. Never used for reasoning
 *  echo when the real item is available — `final` is preferred precisely
 *  because encrypted_content only ever arrives on output_item.done. */
function synthesizeItem(it: StreamItem): Json {
  if (it.final) return it.final;
  if (it.type === "function_call") {
    return { type: "function_call", id: it.itemId, call_id: it.callId ?? it.itemId, name: it.name ?? "", arguments: it.argsDone ?? it.args, status: "incomplete" };
  }
  return { type: it.type, id: it.itemId };
}

function textFromOutput(output: Json[]): string {
  let out = "";
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") out += part.text;
    }
  }
  return out;
}

function reasoningTextFromOutput(output: Json[]): string {
  let out = "";
  for (const item of output) {
    if (item?.type !== "reasoning") continue;
    for (const part of item.summary ?? []) if (typeof part?.text === "string") out += part.text;
    for (const part of item.content ?? []) if (typeof part?.text === "string") out += part.text;
  }
  return out;
}

function normalizeUsage(usage: Json): NormalizedUsage | null {
  if (!usage || typeof usage !== "object") return null;
  // Field names differ from Chat Completions (input_tokens / output_tokens, not
  // prompt_/completion_). output_tokens ALREADY INCLUDES reasoning_tokens —
  // adding them would trip the governor's token ceiling at roughly half the
  // intended spend.
  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningTokens: Number(usage.output_tokens_details?.reasoning_tokens ?? 0),
  };
}
