// responsesTransport — renders the neutral conversation onto POST /v1/responses
// and normalizes the streamed reply back. OpenAI models only; DeepSeek stays on
// chatCompletionsTransport (see transport.ts for why the seam exists).
//
// Why this wire at all: Chat Completions DISCARDS the model's reasoning between
// tool turns, so every turn of a research loop re-derives what it already
// worked out. Responses returns reasoning as a first-class item that can be
// echoed back, and accepts a real `reasoning.effort` alongside function tools.
// Those two things are the entire point of the port.
//
// Statelessness is preserved: `store: false` + `include:
// ["reasoning.encrypted_content"]` means nothing is retained server-side and the
// client remains the only copy of the conversation (which is also what makes
// this ZDR-safe). We deliberately do NOT use `previous_response_id` — it needs
// store:true, re-bills the whole chain as input tokens, and would fight the
// loop's habit of discarding a truncated turn locally.

import { consumeResponsesStream } from "./consumeResponsesStream";
import type {
  ConversationItem,
  NeutralToolDefinition,
  Transport,
  TransportCapabilities,
  TurnRequest,
  TurnResult,
} from "./transport";

export interface ResponsesTransportOptions {
  model: string;
  apiKey: string;
  /** Full responses endpoint, e.g. https://api.openai.com/v1/responses */
  url: string;
  /** Stable per-run string (e.g. the ledger run id). The loop resends the whole
   *  input[] every turn, so the prefix is stable and prompt caching pays off. */
  promptCacheKey?: string;
}

// Generation is the ONE surface that buys xhigh reasoning — pick quality is what
// the whole run exists for, and reaching a real effort alongside function tools
// is why this wire exists. Override per-deploy with V3_REASONING_EFFORT.
const REASONING_EFFORT_DEFAULT = "xhigh";
const VALID_REASONING_EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

// NO 400-DOWNGRADE GUARD HERE — deliberately unlike chatCompletionsTransport.
// That guard exists because Chat Completions is documented as possibly refusing
// tools + a non-"none" effort at all, and because DeepSeek rejects unknown body
// keys; degrading beats losing the generation on a wire that was never going to
// give us reasoning anyway. On /v1/responses reasoning + function tools is the
// SUPPORTED combination, so any 400 here is a real defect (a reasoning item
// echoed without its following item, a bad param) or an effort value this model
// genuinely lacks. Both must surface loudly: a silent downgrade would leave the
// port "working" while delivering exactly the thing it was built to buy.
// UNCERTAINTY (wire contract): the docs list none/low/medium/high/xhigh/max for
// the GPT-5.6 family but publish no per-variant matrix, so xhigh on luna is
// plausible-but-unconfirmed. If it 400s, V3_REASONING_EFFORT is the lever — a
// one-line env change, not a code deploy.
function resolveReasoningEffort(model: string): string | null {
  if (!/^(gpt-5|o\d)/.test(model)) return null; // non-reasoning gpt-4.x takes no reasoning param
  const override = process.env.V3_REASONING_EFFORT;
  if (override && VALID_REASONING_EFFORTS.has(override)) return override;
  return REASONING_EFFORT_DEFAULT;
}

// Transient stream/connection failures are recoverable — retry the turn's LLM
// call rather than failing the whole run. Client-side aborts (turn-budget
// timeout) are intentionally NOT matched here.
function isTransientNetworkError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /terminated|econnreset|socket hang up|other side closed|fetch failed|und_err|epipe|etimedout|enetunreach|network/.test(msg);
}

/**
 * Neutral conversation → Responses `input[]`.
 *
 * Flat and ordered: there is no messages/tool_calls nesting and no role:"tool".
 * One neutral assistant turn EXPANDS into several items (reasoning, message,
 * function_call…), which is why the neutral model groups per turn — the reverse
 * direction would be lossy.
 */
export function toResponsesInput(conversation: readonly ConversationItem[]): unknown[] {
  const input: unknown[] = [];
  for (const item of conversation) {
    switch (item.kind) {
      // The system prompt could equally live in the top-level `instructions`
      // string; keeping it as an input item leaves the ordered conversation as
      // the single source of truth for what the model saw.
      case "system":
        input.push({ role: "system", content: item.text });
        break;
      case "user":
        input.push({ role: "user", content: item.text });
        break;
      case "toolResult":
        // No `role`, no `name`, and `call_id` (not the fc_ item id) is the
        // correlation key. `id` is omitted: it is only meaningful when echoing
        // an item the API itself returned.
        input.push({ type: "function_call_output", call_id: item.callId, output: item.content });
        break;
      case "assistant": {
        const raw = item.reasoning?.raw;
        if (Array.isArray(raw) && raw.length > 0) {
          // THE REASON THIS PORT EXISTS. `raw` is the provider's own
          // `response.output[]`: reasoning items with encrypted_content,
          // assistant messages with their `phase`, and the function_call items
          // in their original order. Echo it BYTE-FOR-BYTE — the summary text is
          // a lossy rendering, encrypted_content is what the model consumes, and
          // dropping a reasoning item while keeping the function_call that
          // followed it is a hard 400.
          input.push(...raw);
          break;
        }
        // Fallback for turns this transport did not produce — today only the
        // loop's synthesized get_slate seed.
        if (item.text) input.push({ role: "assistant", content: item.text });
        for (const call of item.toolCalls) {
          input.push({ type: "function_call", call_id: call.id, name: call.name, arguments: call.arguments });
        }
        break;
      }
    }
  }
  return input;
}

/** Neutral tool defs → the FLAT Responses shape (no `function:{}` wrapper).
 *  `strict` must be sent false explicitly: the V3 pick schemas have optional
 *  properties (decision_trace is deliberately not required — making it required
 *  bloats output and feeds the truncation risk) and set no
 *  additionalProperties:false, so strict mode would 400 on the whole array. */
export function toResponsesToolDefs(tools: readonly NeutralToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    strict: false,
  }));
}

class ResponsesTransport implements Transport {
  readonly model: string;
  readonly wire = "responses" as const;
  readonly capabilities: TransportCapabilities = { forcedToolChoice: true };

  // Resolved once per run. Never mutated: see the note above resolveReasoningEffort
  // for why this wire has no downgrade path.
  private readonly reasoningEffort: string | null;

  constructor(private readonly opts: ResponsesTransportOptions) {
    this.model = opts.model;
    this.reasoningEffort = resolveReasoningEffort(opts.model);
  }

  private buildBody(req: TurnRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.opts.model,
      input: toResponsesInput(req.conversation),
      tools: toResponsesToolDefs(req.tools),
      // FLAT — Chat Completions' {type:"function",function:{name}} is a 400 here,
      // and this is the FINAL turn of every forced run, so getting it wrong
      // fails the generation after the whole research budget is already spent.
      tool_choice: req.forceToolName ? { type: "function", name: req.forceToolName } : "auto",
      stream: true,
      // Nothing retained server-side; the client is the only copy.
      store: false,
      // The one include[] value that matters, and effectively mandatory with
      // store:false — without it encrypted_content may be absent and the
      // reasoning is then unrecoverable. Harmless if it turns out to be
      // redundant (the SDK types hint it may now default on).
      include: ["reasoning.encrypted_content"],
      // Replaces max_tokens / max_completion_tokens, and covers REASONING tokens
      // too — a high effort can burn the whole cap before any visible output.
      max_output_tokens: req.maxOutputTokens,
    };
    if (this.reasoningEffort) {
      body.reasoning = {
        effort: this.reasoningEffort,
        // Opt-in; without it every reasoning item has summary:[] and the run's
        // audit ledger (p_reasoning_trace) stays empty as it does on Chat today.
        summary: "auto",
        // GPT-5.6 defaults to all_turns, earlier models to current_turn. Setting
        // it explicitly is self-documenting, and it only does anything because
        // the prior turns' items are actually present in input[].
        context: "all_turns",
      };
    }
    // NOT sent: stream_options. include_usage has no Responses equivalent
    // (usage arrives on the terminal event) and the parameter's validity here is
    // contradicted between doc sources — omitting it cannot 400.
    if (this.opts.promptCacheKey) body.prompt_cache_key = this.opts.promptCacheKey;
    return body;
  }

  async sendTurn(req: TurnRequest): Promise<TurnResult> {
    const body = this.buildBody(req);

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
          // No effort-downgrade branch here on purpose — a 400 from this wire is
          // a defect or an unsupported enum, and both must surface.
          // 5xx / 429 are retryable; other 4xx are not.
          if ((resp.status >= 500 || resp.status === 429) && attempt < MAX_LLM_TRIES) {
            lastErr = new Error(`LLM ${resp.status}`);
            await new Promise((r) => setTimeout(r, 400 * attempt));
            continue;
          }
          throw new Error(`LLM ${resp.status}: ${errTxt.slice(0, 200)}`);
        }
        return await consumeResponsesStream(resp.body);
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

export function createResponsesTransport(opts: ResponsesTransportOptions): Transport {
  return new ResponsesTransport(opts);
}
