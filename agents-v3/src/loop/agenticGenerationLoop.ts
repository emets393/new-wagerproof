// The V3 agentic generation loop. Forked from the wagerbot-agent Chat
// Completions tool loop (patterns copied, nothing imported), with a governor,
// the forced slate seed, the grounding gate (in submit_picks), usage capture,
// and per-deep-fetch compaction.

import type { ConversationItem, NeutralToolDefinition, Transport, TurnResult } from "./transport";
import { toGovernorUsage } from "./transport";
import { buildV3SystemPrompt } from "./v3SystemPrompt";
import { buildSubmitPicksSchema, buildSubmitParlaySchema } from "./pickSchemaV3";
import { passthroughTrace, type AgentGenContext, type SubmitReport } from "./tools/context";
import type { SlateResult } from "./tools/gameSource";
import { compactSlate } from "./tools/gameSource";
import { buildReadToolDefs, DEEP_TOOL_NAMES, runReadTool } from "./tools/readTools";
import { submitPicks } from "./tools/submitPicks";
import { submitParlay } from "./tools/submitParlay";

export interface LoopResult {
  engineUsed: "v3";
  accepted: number;
  allAccepted: boolean;
  turns: number;
  reason: string | null;
}

export interface LoopOptions {
  /** The provider binding. The loop never builds a request body or parses a
   *  stream itself — see transport.ts for the seam's contract. */
  transport: Transport;
}

function summarize(s: string): string {
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

function submitRepairInstruction(report: SubmitReport, ctx: AgentGenContext, toolName: "submit_picks" | "submit_parlay"): string | null {
  if (report.allAccepted) return null;
  const allowed = ctx.steering.allowedMarkets.length > 0 ? ctx.steering.allowedMarkets : ["spread", "moneyline", "total", "team_total", "prop"];
  const marketRejects = report.rejected.filter((r) => r.reason.includes("market_not_allowed"));
  const propOnly = allowed.length === 1 && allowed[0] === "prop";

  if (report.accepted > 0 && toolName === "submit_parlay") {
    return propOnly
      ? `A prop parlay ticket was accepted. Do not submit another ${toolName} with spread, moneyline, total, or team_total legs; this agent allows ONLY prop. Finalize now with submit_picks using an empty picks array.`
      : `A parlay ticket was accepted. Do not re-submit rejected legs unless they can be corrected to allowed markets (${allowed.join(", ")}). Finalize with submit_picks when done.`;
  }

  if (marketRejects.length === 0) return null;
  if (propOnly) {
    return `Your last ${toolName} was rejected because this agent allows ONLY bet_type "prop". Stop submitting spread, moneyline, total, or team_total. Call get_props for NFL games, then submit only prop legs copied from returned is_bettable props: prop_player, prop_market, prop_line, prop_direction. If fewer than two prop legs clear the bar, finalize with submit_picks using an empty picks array and explain that no clean prop parlay cleared.`;
  }
  return `Your last ${toolName} used a disallowed market. Allowed bet_type values for this agent are: ${allowed.join(", ")}. Resubmit only with those markets, or finalize with submit_picks using an empty picks array.`;
}

export async function runAgenticLoop(
  ctx: AgentGenContext,
  slate: SlateResult,
  opts: LoopOptions,
): Promise<LoopResult> {
  const steering = ctx.steering;
  const allowedMarkets = steering.allowedMarkets.length > 0 ? steering.allowedMarkets : ["spread", "moneyline", "total", "team_total", "prop"];
  const allowedMarketsText = allowedMarkets.join(", ");
  // Span factory → dashboard run waterfall (passthrough when not on Trigger.dev).
  const span = ctx.trace ?? passthroughTrace;
  // Tool defs are provider-neutral (flat name/description/parameters); each
  // transport re-nests them the way its wire wants.
  const tools: NeutralToolDefinition[] = [
    ...buildReadToolDefs(steering).map((d) => ({ name: d.function.name, description: d.function.description, parameters: d.function.parameters })),
    {
      name: "submit_picks",
      description: "Submit your final picks (or an empty array). Call this exactly once when done.",
      parameters: buildSubmitPicksSchema(steering.unitBand),
    },
    // Parlay ticket tool — only offered when the agent's appetite allows it.
    ...(steering.maxParlayLegs > 0
      ? [{
          name: "submit_parlay",
          description: ctx.window === "week"
            ? "Submit 2-3 DISTINCT week-long parlay tickets (an array) — legs drawn from games you fetched, spanning the remaining football week. Make the tickets differ from one another; an exact-duplicate ticket is rejected. Then call submit_picks with an empty picks array to finalize the run."
            : `Submit multi-leg parlay tickets using only allowed leg bet_type values (${allowedMarketsText}). Legs must be drawn from games you fetched. After any accepted parlays, still call submit_picks to finalize the run (use an empty picks array if you have no straight picks).`,
          parameters: buildSubmitParlaySchema(steering.unitBand, steering.maxParlayLegs, { weekly: ctx.window === "week" }),
        }]
      : []),
  ];

  const slateContent = compactSlate(slate, 16000);
  // The slate is pre-executed by the host and injected as a fabricated tool
  // round-trip, so the model starts already grounded in the day's games.
  const conversation: ConversationItem[] = [
    { kind: "system", text: buildV3SystemPrompt(steering, ctx.targetDate, { window: ctx.window, weekKey: ctx.weekKey }) },
    {
      kind: "user",
      text: ctx.window === "week"
        ? "Build this agent's week-long parlay tickets (2-3 distinct options). The remaining week slate is already provided below."
        : "Generate today's picks for this agent. The slate is already provided below.",
    },
    {
      kind: "assistant",
      text: null,
      toolCalls: [{ id: "slate_0", name: "get_slate", arguments: "{}" }],
      // Synthetic turn still needs a non-empty CoT for V4 thinking mode. Only
      // the DeepSeek transport renders it; OpenAI never sees the carrier.
      reasoning: { text: "I need today's slate before I can analyze anything." },
    },
    { kind: "toolResult", callId: "slate_0", content: slateContent },
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
  let truncationRetried = false;

  for (let turn = 0; turn < max; turn++) {
    turns = turn + 1;
    ctx.onProgress?.({ kind: "turn", turn: turns, maxTurns: max });

    // Hard time gate: if there isn't room for another full turn, stop now and
    // finalize with whatever we've accepted. Prevents the run from drifting
    // past its wall-clock budget (and the 300s queue lease) on slow turns.
    if (turn > 0 && ctx.gov.timeLeftMs() < 15_000) {
      ctx.gov.trip("wall_clock");
      break;
    }

    const forceSubmit = ctx.gov.shouldForceSubmit(turn);
    ctx.onProgress?.({ kind: "phase", phase: forceSubmit ? "finalizing" : "analyzing" });

    // Force the terminal submit. OpenAI accepts a named tool_choice; deepseek
    // "thinking mode" rejects it (HTTP 400), so for those models we keep
    // tool_choice:"auto" and inject a one-time hard instruction to submit now.
    let forceToolName: string | null = null;
    if (forceSubmit) {
      if (opts.transport.capabilities.forcedToolChoice) {
        forceToolName = "submit_picks";
      } else if (!forcedNudgeInjected) {
        conversation.push({
          kind: "user",
          text:
            "STOP researching — your research budget is spent. Call submit_picks NOW with your final picks. " +
            "If nothing clears your bar, call submit_picks with an empty picks array and a slate_note. Do not call any other tool.",
        });
        forcedNudgeInjected = true;
      }
    }

    // Abort the turn at min(remaining wall-clock, per-turn cap) so a single slow
    // deepseek-reasoner turn can't run unbounded. On timeout we finalize with
    // what we have rather than hang past the lease.
    const ctrl = new AbortController();
    const turnBudgetMs = Math.max(1000, Math.min(ctx.gov.timeLeftMs(), ctx.gov.limitsRef.perTurnMs));
    const turnTimer = setTimeout(() => ctrl.abort(), turnBudgetMs);

    let res: TurnResult;
    try {
      // One span per LLM turn — this is usually the biggest chunk of a run, so
      // it's the headline bar in the waterfall (model think + stream time). The
      // span stays wrapped around the transport's INTERNAL retries too.
      res = await span(`llm:turn-${turns}`, () => opts.transport.sendTurn({
        conversation,
        tools,
        forceToolName,
        maxOutputTokens: ctx.gov.limitsRef.maxTokensOut,
        signal: ctrl.signal,
      }), { turn: turns, model: opts.transport.model, wire: opts.transport.wire, forced: forceSubmit });
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
    ctx.gov.addUsage(toGovernorUsage(res.usage));
    const reasoningText = res.reasoning?.text ?? null;
    if (reasoningText && ctx.reasoningTrace.length < 4000) {
      ctx.reasoningTrace = (ctx.reasoningTrace + "\n" + reasoningText).slice(0, 4000);
    }

    // A truncated turn with no tool call means the turn was CUT OFF, not
    // finished: on OpenAI reasoning models the output cap also covers reasoning
    // tokens, so an xhigh pass can burn the cap before emitting submit_picks.
    // Breaking here would end the run as a silent success with zero picks —
    // instead trip (forces tool_choice=submit_picks next turn) and retry once,
    // then fail loudly if nothing was ever accepted.
    if (res.toolCalls.length === 0 && res.finish === "truncated") {
      ctx.gov.trip("output_truncated");
      if (!truncationRetried) {
        truncationRetried = true;
        conversation.push({
          kind: "user",
          text:
            "Your last turn hit the output token limit before emitting a tool call. Stop reasoning and call submit_picks NOW " +
            "with short reasoning and no decision_trace. If nothing clears your bar, submit an empty picks array with a slate_note.",
        });
        continue;
      }
      if (ctx.acceptedPicks.length === 0) {
        // Message is recorded on the ledger (error_message) — keep it wire-neutral:
        // Chat spells this finish_reason="length", Responses status="incomplete".
        throw new Error("LLM output truncated (hit the per-turn output cap) before any tool call — no picks submitted");
      }
      break;
    }

    if (res.toolCalls.length === 0) break; // model answered without a tool — done

    conversation.push({
      kind: "assistant",
      text: res.textContent,
      toolCalls: res.toolCalls,
      reasoning: res.reasoning,
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
        // Blank arguments mean the call was CUT OFF before its first argument
        // token, not that the model submitted nothing: coercing "" to "{}" parses
        // clean, and submitPicks reads that as a valid zero-pick submission that
        // ends the run green. Route it through the malformed path instead — the
        // turn still carries a tool call, so the truncation guard above never sees it.
        if (!call.arguments.trim()) ctx.gov.recordMalformed();
        else { try { args = JSON.parse(call.arguments); } catch { ctx.gov.recordMalformed(); } }

        // Truncated/invalid tool-call JSON: do NOT route to submitPicks — an
        // empty parse there reads as a valid "zero picks" submission and ends
        // the run with no picks. Tell the model and let it resubmit concisely.
        if (args === null) {
          const errMsg = "submit_picks arguments were not valid JSON (likely truncated). Resubmit with fewer picks and shorter reasoning; omit decision_trace if needed.";
          const content = JSON.stringify({ ok: false, error: errMsg });
          conversation.push({ kind: "toolResult", callId: call.id, content });
          trace(call.id, call.name, (call.arguments || "").slice(0, 200), content, Date.now() - started, false);
          if (ctx.gov.submitAttempts >= ctx.gov.limitsRef.maxSubmitAttempts) { finished = true; break; }
          continue;
        }

        const report = await span("submit_picks", () => submitPicks(ctx, args), { attempt: ctx.gov.submitAttempts });
        ctx.lastSubmitReport = report;
        const content = JSON.stringify(report);
        conversation.push({ kind: "toolResult", callId: call.id, content });
        trace(call.id, call.name, call.arguments || "{}", content, Date.now() - started, report.ok);
        ctx.onProgress?.({ kind: "submit", attempt: ctx.gov.submitAttempts, accepted: report.accepted, rejected: report.rejected.length });
        const repair = submitRepairInstruction(report, ctx, "submit_picks");
        if (repair) conversation.push({ kind: "user", text: repair });
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
          conversation.push({ kind: "toolResult", callId: call.id, content });
          trace(call.id, call.name, (call.arguments || "").slice(0, 200), content, Date.now() - started, false);
          continue;
        }
        const report = await span("submit_parlay", () => submitParlay(ctx, args));
        const content = JSON.stringify(report);
        conversation.push({ kind: "toolResult", callId: call.id, content });
        trace(call.id, call.name, call.arguments || "{}", content, Date.now() - started, report.ok);
        const repair = submitRepairInstruction(report, ctx, "submit_parlay");
        if (repair) conversation.push({ kind: "user", text: repair });
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
        const ids = (args as { game_ids?: unknown[] }).game_ids;
        ctx.onProgress?.({ kind: "tool", tool: call.name, detail: Array.isArray(ids) ? `${ids.length} game(s)` : undefined });
        const r = await span(`tool:${call.name}`, () => runReadTool(call.name, args, ctx), {
          tool: call.name,
          deep: isDeep,
          games: Array.isArray(ids) ? ids.length : 0,
        });
        content = r.content;
        ok = r.ok;
      }
      conversation.push({ kind: "toolResult", callId: call.id, content });
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
