// Transport seam for the V3 agentic loop.
//
// The loop owns the CONVERSATION and the governor; a Transport owns the WIRE.
// Everything below is provider-neutral: nothing here mentions `messages`,
// `input`, `finish_reason`, `prompt_tokens`, or an HTTP shape. That is what lets
// DeepSeek stay on /v1/chat/completions while OpenAI models move to /v1/responses
// (next stage) without the loop knowing which one it is talking to — and what
// makes "delete DeepSeek later" a one-file deletion.
//
// See chatCompletionsTransport.ts for the Chat Completions rendering of every
// type below.

import type { Usage } from "./types";

/** One tool call, flattened. Chat Completions nests this under
 *  `function:{name,arguments}`; Responses puts `name`/`arguments` on the item
 *  itself. Neither nesting belongs in the loop, so the neutral form is flat.
 *  `arguments` stays a RAW JSON STRING — a truncated turn can emit unparseable
 *  arguments, and only the loop (which owns the malformed-JSON circuit) may
 *  decide what that means. */
export interface NeutralToolCall {
  /** Correlation id echoed back on the matching tool result. Chat Completions
   *  calls it `tool_call_id`; Responses calls it `call_id` (NOT the `fc_` item
   *  id). Opaque to the loop either way. */
  id: string;
  name: string;
  arguments: string;
}

/**
 * Provider-opaque carrier for one assistant turn's reasoning.
 *
 * Two fields because the two consumers are unrelated:
 *  - `text` is HUMAN-readable CoT the loop appends to ctx.reasoningTrace for the
 *    audit ledger. Today only DeepSeek thinking mode streams it.
 *  - `raw` is whatever the provider needs handed back VERBATIM on the next
 *    request to preserve reasoning across tool turns. The loop must never read,
 *    truncate, hash or reconstruct it — it exists so /v1/responses can park its
 *    `reasoning` items (with `encrypted_content`) here and echo them byte-for-byte.
 */
export interface ReasoningCarrier {
  text: string | null;
  raw?: unknown;
}

/**
 * THE NEUTRAL CONVERSATION MODEL.
 *
 * An ordered, append-only list of items. Ordering is load-bearing: the loop
 * interleaves user repair instructions between the tool results of a single
 * assistant turn, so anything grouped "by role" or "by turn" would lose the real
 * sequence.
 *
 * Granularity is deliberately ONE ITEM PER MODEL TURN on the assistant side
 * (text + tool calls + reasoning together) rather than the finer Responses-style
 * flat item stream. That direction is the lossless one: a grouped assistant step
 * expands into [reasoning item, message item, function_call items…] in order for
 * Responses, whereas a pre-flattened array would force the Chat Completions
 * transport to re-infer which function_call items belonged to which assistant
 * message — information the wire does not carry.
 */
export type ConversationItem =
  | { kind: "system"; text: string }
  | { kind: "user"; text: string }
  | {
      kind: "assistant";
      text: string | null;
      toolCalls: NeutralToolCall[];
      /** null only for a turn that genuinely produced no reasoning. */
      reasoning: ReasoningCarrier | null;
    }
  /** Result of exactly one tool call, correlated by `callId`. Always a string:
   *  both wires require the transport-visible payload to be pre-serialized. */
  | { kind: "toolResult"; callId: string; content: string };

/** A tool the model may call. Flat, for the same reason NeutralToolCall is:
 *  Chat Completions nests under `function:{}`, Responses does not. */
export interface NeutralToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Why the turn ended, normalized.
 *
 * "truncated" is called out explicitly because it is the one signal the loop
 * MUST act on differently (trip the circuit, inject a repair instruction, fail
 * loudly if nothing was ever accepted). Chat Completions spells it
 * `finish_reason:"length"`; Responses spells it `status:"incomplete"` with
 * `incomplete_details.reason:"max_output_tokens"`. A transport that fails to map
 * its own spelling onto "truncated" turns a truncated run into a silent green
 * run with zero picks.
 */
export type FinishSignal = "tool_calls" | "stop" | "truncated" | "other";

/** Token usage, normalized. `outputTokens` is INCLUSIVE of `reasoningTokens` on
 *  both providers (reasoning bills as output) — never add the two together. */
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

/** Everything the loop learns from one model turn. */
export interface TurnResult {
  toolCalls: NeutralToolCall[];
  textContent: string | null;
  reasoning: ReasoningCarrier | null;
  finish: FinishSignal;
  /** null when the provider reported nothing — the governor's token ceiling and
   *  the run's cost ledger both go silently to zero in that case, so a transport
   *  should treat a missing usage payload as a bug in itself, not a normal path. */
  usage: NormalizedUsage | null;
}

export interface TurnRequest {
  conversation: readonly ConversationItem[];
  tools: readonly NeutralToolDefinition[];
  /** Non-null = the model MUST call this tool. Transports that cannot express a
   *  forced tool choice declare `capabilities.forcedToolChoice:false` and never
   *  receive it (the loop forces via prompt instead). */
  forceToolName: string | null;
  maxOutputTokens: number;
  /** Per-turn budget from the loop's AbortController. Must be threaded into the
   *  actual fetch: swallowing it turns a graceful timeout-and-finalize into a
   *  hard failure and three full-cost Trigger.dev retries. */
  signal: AbortSignal;
}

export interface TransportCapabilities {
  /** false for DeepSeek thinking mode, which rejects a named tool_choice (400). */
  forcedToolChoice: boolean;
}

/** Which wire a transport speaks. Observability + routing assertions ONLY — the
 *  loop must never branch on it (everything it needs is in `capabilities`), or
 *  the seam stops being a seam. */
export type TransportWire = "chat_completions" | "responses";

/** One provider binding. Constructed once per run; may hold per-run state (e.g.
 *  a reasoning-effort downgrade that must persist across turns). */
export interface Transport {
  /** Exposed only for observability (span attributes / logs). */
  readonly model: string;
  readonly wire: TransportWire;
  readonly capabilities: TransportCapabilities;
  sendTurn(req: TurnRequest): Promise<TurnResult>;
}

/** Adapter to LoopGovernor.addUsage, which still speaks Chat Completions' field
 *  names. outputTokens is already reasoning-inclusive, so there is no extra term. */
export function toGovernorUsage(u: NormalizedUsage | null): Usage | null {
  if (!u) return null;
  return { prompt_tokens: u.inputTokens, completion_tokens: u.outputTokens };
}
