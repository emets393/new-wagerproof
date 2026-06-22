// The V3 agentic generation loop. Forked from the wagerbot-agent Chat
// Completions tool loop (patterns copied, nothing imported), with a governor,
// the forced slate seed, the grounding gate (in submit_picks), usage capture,
// and per-deep-fetch compaction.

import type { ChatMessage } from "./types.ts";
import { consumeChatStreamV3 } from "./consumeChatStreamV3.ts";
import { compactDeepFetch } from "./compactDeepFetch.ts";
import { buildV3SystemPrompt } from "./v3SystemPrompt.ts";
import { buildSubmitPicksSchema, buildSubmitParlaySchema } from "./pickSchemaV3.ts";
import type { AgentGenContext } from "./tools/context.ts";
import type { SlateResult } from "./tools/gameSource.ts";
import { buildReadToolDefs, DEEP_TOOL_NAMES, runReadTool } from "./tools/readTools.ts";
import { submitPicks } from "./tools/submitPicks.ts";
import { submitParlay } from "./tools/submitParlay.ts";

export interface LoopResult {
  engineUsed: "v3";
  accepted: number;
  allAccepted: boolean;
  turns: number;
  reason: string | null;
}

export interface LoopOptions {
  model: string;
  apiKey: string;
  chatCompletionsUrl: string;
  /** false for DeepSeek thinking mode (rejects named tool_choice) → force via prompt. */
  supportsForcedToolChoice: boolean;
  /** DeepSeek V4 thinking mode requires each tool-calling assistant turn's
   *  reasoning_content passed back on later requests; OpenAI must not see it. */
  passBackReasoning: boolean;
}

function summarize(s: string): string {
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

export async function runAgenticLoop(
  ctx: AgentGenContext,
  slate: SlateResult,
  opts: LoopOptions,
): Promise<LoopResult> {
  const steering = ctx.steering;
  const tools = [
    ...buildReadToolDefs(steering),
    {
      type: "function" as const,
      function: {
        name: "submit_picks",
        description: "Submit your final picks (or an empty array). Call this exactly once when done.",
        parameters: buildSubmitPicksSchema(steering.unitBand),
      },
    },
    // Parlay ticket tool — only offered when the agent's appetite allows it.
    ...(steering.maxParlayLegs > 0
      ? [{
          type: "function" as const,
          function: {
            name: "submit_parlay",
            description: "Submit multi-leg parlay tickets (legs drawn from games you fetched). After any parlays, still call submit_picks to finalize the run (use an empty picks array if you have no straight picks).",
            parameters: buildSubmitParlaySchema(steering.unitBand, steering.maxParlayLegs),
          },
        }]
      : []),
  ];

  const slateContent = compactDeepFetch("get_slate", slate, 16000);
  const messages: ChatMessage[] = [
    { role: "system", content: buildV3SystemPrompt(steering, ctx.targetDate) },
    { role: "user", content: "Generate today's picks for this agent. The slate is already provided below." },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "slate_0", type: "function", function: { name: "get_slate", arguments: "{}" } }],
      // Synthetic turn still needs a non-empty CoT for V4 thinking mode.
      ...(opts.passBackReasoning ? { reasoning_content: "I need today's slate before I can analyze anything." } : {}),
    },
    { role: "tool", tool_call_id: "slate_0", content: slateContent },
  ];

  let traceSeq = 1;
  const trace = (tool_call_id: string, name: string, args: string, content: string, ms: number, ok: boolean) =>
    ctx.toolTrace.push({ seq: traceSeq++, tool_call_id, name, args_digest: args.slice(0, 200), result_summary: summarize(content), result_excerpt: content.slice(0, 1500), ms, ok });

  // Seed the trace with the slate the agent was shown, so the audit starts
  // from the same ground truth the model saw.
  ctx.toolTrace.push({ seq: 0, tool_call_id: "slate_0", name: "get_slate", args_digest: "{}", result_summary: summarize(slateContent), result_excerpt: slateContent.slice(0, 1500), ms: 0, ok: true });

  let turns = 0;
  const max = ctx.gov.limitsRef.maxTurns;
  let forcedNudgeInjected = false;

  for (let turn = 0; turn < max; turn++) {
    turns = turn + 1;

    // Hard time gate: if there isn't room for another full turn, stop now and
    // finalize with whatever we've accepted. Prevents the run from drifting
    // past its wall-clock budget (and the 300s queue lease) on slow turns.
    if (turn > 0 && ctx.gov.timeLeftMs() < 15_000) {
      ctx.gov.trip("wall_clock");
      break;
    }

    const forceSubmit = ctx.gov.shouldForceSubmit(turn);

    // Force the terminal submit. OpenAI accepts a named tool_choice; deepseek
    // "thinking mode" rejects it (HTTP 400), so for those models we keep
    // tool_choice:"auto" and inject a one-time hard instruction to submit now.
    let toolChoice: unknown = "auto";
    if (forceSubmit) {
      if (opts.supportsForcedToolChoice) {
        toolChoice = { type: "function", function: { name: "submit_picks" } };
      } else if (!forcedNudgeInjected) {
        messages.push({
          role: "user",
          content:
            "STOP researching — your research budget is spent. Call submit_picks NOW with your final picks. " +
            "If nothing clears your bar, call submit_picks with an empty picks array and a slate_note. Do not call any other tool.",
        });
        forcedNudgeInjected = true;
      }
    }

    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      tools,
      tool_choice: toolChoice,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: ctx.gov.limitsRef.maxTokensOut,
    };

    // Abort the turn at min(remaining wall-clock, per-turn cap) so a single slow
    // deepseek-reasoner turn can't run unbounded. On timeout we finalize with
    // what we have rather than hang past the lease.
    const ctrl = new AbortController();
    const turnBudgetMs = Math.max(1000, Math.min(ctx.gov.timeLeftMs(), ctx.gov.limitsRef.perTurnMs));
    const turnTimer = setTimeout(() => ctrl.abort(), turnBudgetMs);

    let res: Awaited<ReturnType<typeof consumeChatStreamV3>>;
    try {
      const resp = await fetch(opts.chatCompletionsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) {
        const errTxt = await resp.text().catch(() => "");
        throw new Error(`LLM ${resp.status}: ${errTxt.slice(0, 200)}`);
      }
      res = await consumeChatStreamV3(resp.body);
    } catch (e) {
      clearTimeout(turnTimer);
      if (ctrl.signal.aborted) {
        // Out of time mid-turn — stop and finalize with accepted picks so far.
        ctx.gov.trip("turn_timeout");
        break;
      }
      throw e; // genuine error (e.g. LLM 4xx) → propagate to the worker's catch
    }
    clearTimeout(turnTimer);
    ctx.gov.addUsage(res.usage);
    if (res.reasoning && ctx.reasoningTrace.length < 4000) {
      ctx.reasoningTrace = (ctx.reasoningTrace + "\n" + res.reasoning).slice(0, 4000);
    }

    if (res.toolCalls.length === 0) break; // model answered without a tool — done

    messages.push({
      role: "assistant",
      content: res.textContent,
      tool_calls: res.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })),
      ...(opts.passBackReasoning ? { reasoning_content: res.reasoning ?? "" } : {}),
    });

    let finished = false;
    // Process submit_parlay (and reads) BEFORE the terminal submit_picks, so an
    // agent that emits both in one turn gets its parlays written before the run ends.
    const orderedCalls = [...res.toolCalls].sort(
      (a, b) => (a.name === "submit_picks" ? 1 : 0) - (b.name === "submit_picks" ? 1 : 0),
    );
    for (const call of orderedCalls) {
      const started = Date.now();
      if (call.name === "submit_picks") {
        ctx.gov.submitAttempts += 1;
        let args: Record<string, unknown> | null = null;
        try { args = JSON.parse(call.arguments || "{}"); } catch { ctx.gov.recordMalformed(); }

        // Truncated/invalid tool-call JSON: do NOT route to submitPicks — an
        // empty parse there reads as a valid "zero picks" submission and ends
        // the run with no picks. Tell the model and let it resubmit concisely.
        if (args === null) {
          const errMsg = "submit_picks arguments were not valid JSON (likely truncated). Resubmit with fewer picks and shorter reasoning; omit decision_trace if needed.";
          const content = JSON.stringify({ ok: false, error: errMsg });
          messages.push({ role: "tool", tool_call_id: call.id, content });
          trace(call.id, call.name, (call.arguments || "").slice(0, 200), content, Date.now() - started, false);
          if (ctx.gov.submitAttempts >= ctx.gov.limitsRef.maxSubmitAttempts) { finished = true; break; }
          continue;
        }

        const report = await submitPicks(ctx, args);
        ctx.lastSubmitReport = report;
        const content = JSON.stringify(report);
        messages.push({ role: "tool", tool_call_id: call.id, content });
        trace(call.id, call.name, call.arguments || "{}", content, Date.now() - started, report.ok);
        if (report.allAccepted || ctx.gov.submitAttempts >= ctx.gov.limitsRef.maxSubmitAttempts) {
          finished = true;
          break;
        }
        continue;
      }

      if (call.name === "submit_parlay") {
        let args: Record<string, unknown> | null = null;
        try { args = JSON.parse(call.arguments || "{}"); } catch { ctx.gov.recordMalformed(); }
        if (args === null) {
          const content = JSON.stringify({ ok: false, error: "submit_parlay arguments were not valid JSON (likely truncated). Resubmit with fewer/shorter legs." });
          messages.push({ role: "tool", tool_call_id: call.id, content });
          trace(call.id, call.name, (call.arguments || "").slice(0, 200), content, Date.now() - started, false);
          continue;
        }
        const report = await submitParlay(ctx, args);
        const content = JSON.stringify(report);
        messages.push({ role: "tool", tool_call_id: call.id, content });
        trace(call.id, call.name, call.arguments || "{}", content, Date.now() - started, report.ok);
        continue; // non-terminal — the agent still calls submit_picks to finalize
      }

      // read tool — charge budget first
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.arguments || "{}"); } catch { ctx.gov.recordMalformed(); }
      const isDeep = DEEP_TOOL_NAMES.has(call.name);
      const refusal = ctx.gov.chargeToolCall(call.name, `${call.name}:${call.arguments}`, isDeep);
      let content: string;
      let ok = true;
      if (refusal) {
        content = JSON.stringify({ error: refusal });
        ok = false;
      } else {
        const r = await runReadTool(call.name, args, ctx);
        content = r.content;
        ok = r.ok;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content });
      trace(call.id, call.name, call.arguments || "{}", content, Date.now() - started, ok);
    }

    if (finished) break;
    // Time/token/circuit pressure is handled by gov.shouldForceSubmit(turn) at
    // the top of the next iteration, which pins tool_choice to submit_picks.
  }

  const report = ctx.lastSubmitReport;
  const accepted = ctx.acceptedPicks.length;
  return {
    engineUsed: "v3",
    accepted,
    allAccepted: !!report?.allAccepted,
    turns,
    reason: report?.allAccepted ? null : ctx.gov.tripped ? `circuit:${ctx.gov.tripped}` : accepted > 0 ? "partial_submit" : "no_clean_submit",
  };
}
