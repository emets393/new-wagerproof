// chatCompletionsTransport — renders the neutral conversation onto
// POST /v1/chat/completions and normalizes the streamed reply back.
//
// This is the DeepSeek transport and (until the /v1/responses port lands) also
// the OpenAI one. Everything provider-shaped that used to live in
// agenticGenerationLoop.ts is here: the request body, the reasoning_effort
// ladder + its 400-downgrade guard, the max_tokens/max_completion_tokens split,
// the transient-drop retry ladder, and every DeepSeek accommodation.
//
// It wraps consumeChatStreamV3 rather than replacing it — that parser is the
// only thing that captures the usage-only final chunk, which the governor's
// token ceiling and the run's cost ledger both depend on.

import { consumeChatStreamV3 } from "./consumeChatStreamV3";
import type { ChatMessage, StreamResult, ToolDef } from "./types";
import type {
  ConversationItem,
  FinishSignal,
  NeutralToolDefinition,
  Transport,
  TransportCapabilities,
  TurnRequest,
  TurnResult,
} from "./transport";

export interface ChatCompletionsTransportOptions {
  model: string;
  apiKey: string;
  /** Full chat/completions endpoint (provider-specific host). */
  url: string;
  /** false for DeepSeek thinking mode, which rejects a named tool_choice (400). */
  supportsForcedToolChoice: boolean;
  /** DeepSeek V4 thinking mode requires each tool-calling assistant turn's
   *  reasoning_content passed back on later requests; OpenAI must not see it. */
  passBackReasoning: boolean;
}

// Generation is the ONE surface that buys xhigh reasoning — pick quality is what
// the whole run exists for. Only OpenAI reasoning models accept the parameter;
// DeepSeek (still reachable via the debug pickers) rejects unknown body keys, so
// it must never be sent there. Override per-deploy with V3_REASONING_EFFORT.
const REASONING_EFFORT_DEFAULT = "xhigh";
const VALID_REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);

function resolveReasoningEffort(model: string): string | null {
  if (!/^(gpt-5|o\d)/.test(model)) return null; // DeepSeek + gpt-4.x take no effort param
  const override = process.env.V3_REASONING_EFFORT;
  if (override && VALID_REASONING_EFFORTS.has(override)) return override;
  return REASONING_EFFORT_DEFAULT;
}

// GUARD (2026-08-01, unverified against prod): OpenAI's gpt-5.6 upgrade guide says
// function tools on /v1/chat/completions are only compatible with effective
// reasoning "none" — xhigh + tools may be Responses-API-only. A 400 mentioning
// reasoning downgrades the run to no-effort instead of killing generation.
//
// This guard belongs to THIS wire only and is deliberately absent from
// responsesTransport. Here, degrading is right: the wire may genuinely refuse
// tools+effort, and DeepSeek (the only model routed here in prod since the
// Responses port) 400s on body keys it doesn't know. On /v1/responses that
// combination is supported, so a 400 there is a bug and must surface loudly
// rather than quietly buying the port's whole benefit back out.
function isReasoningRejection(status: number, body: string): boolean {
  return status === 400 && /reasoning/i.test(body);
}

// Transient stream/connection failures (e.g. DeepSeek closing the TLS socket
// mid-response → undici "TypeError: terminated", ECONNRESET, socket hang up) are
// recoverable — retry the turn's LLM call rather than failing the whole run.
// Client-side aborts (turn-budget timeout) are intentionally NOT matched here.
function isTransientNetworkError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /terminated|econnreset|socket hang up|other side closed|fetch failed|und_err|epipe|etimedout|enetunreach|network/.test(msg);
}

/** Neutral conversation → Chat Completions messages[]. The assistant arm is the
 *  only lossy-looking one: one neutral turn becomes one assistant message with
 *  N nested tool_calls, which is exactly the grouping this wire requires. */
function toMessages(conversation: readonly ConversationItem[], passBackReasoning: boolean): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const item of conversation) {
    switch (item.kind) {
      case "system":
        out.push({ role: "system", content: item.text });
        break;
      case "user":
        out.push({ role: "user", content: item.text });
        break;
      case "toolResult":
        out.push({ role: "tool", tool_call_id: item.callId, content: item.content });
        break;
      case "assistant":
        out.push({
          role: "assistant",
          content: item.text,
          tool_calls: item.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })),
          // The key must EXIST (even empty) on every tool-calling turn for V4
          // thinking mode; OpenAI must never receive it at all.
          ...(passBackReasoning ? { reasoning_content: item.reasoning?.text ?? "" } : {}),
        });
        break;
    }
  }
  return out;
}

function toChatToolDefs(tools: readonly NeutralToolDefinition[]): ToolDef[] {
  return tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

function toFinishSignal(finishReason: string | null): FinishSignal {
  // "length" is the ONLY truncation spelling on this wire; mapping it is what
  // keeps the loop's truncation guard alive.
  if (finishReason === "length") return "truncated";
  if (finishReason === "tool_calls") return "tool_calls";
  if (finishReason === "stop") return "stop";
  return "other";
}

function normalize(res: StreamResult): TurnResult {
  return {
    toolCalls: res.toolCalls.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments })),
    textContent: res.textContent,
    // Chat Completions carries no re-submittable reasoning payload — only the
    // DeepSeek CoT text — so `raw` stays unset here.
    reasoning: { text: res.reasoning },
    finish: toFinishSignal(res.finishReason),
    usage: res.usage
      ? {
          inputTokens: res.usage.prompt_tokens,
          // Reasoning bills as output on both providers, so this is already
          // reasoning-inclusive. The streamed usage chunk's
          // completion_tokens_details breakdown is not parsed today, hence 0.
          outputTokens: res.usage.completion_tokens,
          reasoningTokens: 0,
        }
      : null,
  };
}

class ChatCompletionsTransport implements Transport {
  readonly model: string;
  readonly wire = "chat_completions" as const;
  readonly capabilities: TransportCapabilities;

  // Per-run state: once a 400 downgrades reasoning effort we keep it downgraded
  // for the rest of the run rather than re-failing every turn.
  private reasoningEffort: string | null;
  private reasoningDowngradeRetried = false;

  constructor(private readonly opts: ChatCompletionsTransportOptions) {
    this.model = opts.model;
    this.capabilities = { forcedToolChoice: opts.supportsForcedToolChoice };
    this.reasoningEffort = resolveReasoningEffort(opts.model);
  }

  async sendTurn(req: TurnRequest): Promise<TurnResult> {
    const body: Record<string, unknown> = {
      model: this.opts.model,
      messages: toMessages(req.conversation, this.opts.passBackReasoning),
      tools: toChatToolDefs(req.tools),
      tool_choice: req.forceToolName ? { type: "function", function: { name: req.forceToolName } } : "auto",
      stream: true,
      stream_options: { include_usage: true },
    };
    // xhigh thinking for OpenAI reasoning models only (null for DeepSeek/gpt-4.x).
    if (this.reasoningEffort) body.reasoning_effort = this.reasoningEffort;
    // gpt-5* / o* reject max_tokens; older chat models reject max_completion_tokens.
    // "gpt-5.6-luna" matches ^gpt-5, so it correctly takes max_completion_tokens.
    if (/^(gpt-5|o\d)/.test(this.opts.model)) {
      body.max_completion_tokens = req.maxOutputTokens;
    } else {
      body.max_tokens = req.maxOutputTokens;
    }

    // Retry transient drops within the turn so a single blip doesn't throw away
    // the whole run. The loop's turn timer aborts req.signal at the turn budget,
    // so retries stay bounded (an abort rethrows immediately, no further tries).
    const MAX_LLM_TRIES = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_LLM_TRIES; attempt++) {
      try {
        const resp = await fetch(this.opts.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.opts.apiKey}` },
          body: JSON.stringify(body),
          signal: req.signal,
        });
        if (!resp.ok || !resp.body) {
          const errTxt = await resp.text().catch(() => "");
          // Chat Completions may refuse tools+reasoning on gpt-5.6 (see the
          // guard note above): downgrade to "none" and re-run the turn once
          // rather than failing the whole generation. Must send "none"
          // EXPLICITLY — omitting the key falls back to the API default
          // (medium), which is exactly the combination being rejected.
          if (this.reasoningEffort && this.reasoningEffort !== "none" && isReasoningRejection(resp.status, errTxt)) {
            console.warn(`[v3] ${this.opts.model} rejected reasoning_effort=${this.reasoningEffort} with tools; downgrading to "none"`);
            this.reasoningEffort = "none";
            body.reasoning_effort = "none";
            if (!this.reasoningDowngradeRetried) {
              this.reasoningDowngradeRetried = true;
              attempt -= 1; // the downgrade shouldn't consume a transient-failure retry
              continue;
            }
          }
          // 5xx / 429 are retryable; other 4xx are not.
          if ((resp.status >= 500 || resp.status === 429) && attempt < MAX_LLM_TRIES) {
            lastErr = new Error(`LLM ${resp.status}`);
            await new Promise((r) => setTimeout(r, 400 * attempt));
            continue;
          }
          throw new Error(`LLM ${resp.status}: ${errTxt.slice(0, 200)}`);
        }
        return normalize(await consumeChatStreamV3(resp.body));
      } catch (err) {
        if (req.signal.aborted) throw err; // turn timeout — let the loop finalize
        lastErr = err;
        if (attempt < MAX_LLM_TRIES && isTransientNetworkError(err)) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("LLM call failed after retries");
  }
}

export function createChatCompletionsTransport(opts: ChatCompletionsTransportOptions): Transport {
  return new ChatCompletionsTransport(opts);
}
