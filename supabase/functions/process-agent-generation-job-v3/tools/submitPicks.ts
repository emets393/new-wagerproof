// submit_picks — the terminal write tool. Runs the grounding gate, then the
// deterministic validator COPIED VERBATIM from process-agent-generation-job-v2
// (game match, dedup, team-in-selection, MLB ML→RL swap, totals→Vegas rewrite,
// F5 formatting), then the V3-only units clamp, then writes avatar_picks.
//
// Copied (not extracted) per the plan's zero-V2-impact doctrine: V2's index.ts
// is left literally untouched. Keep this in sync with that validator on changes.

import { GeneratedPickV3Schema } from "../pickSchemaV3.ts";
import { clampUnits } from "../unitBands.ts";
import { ensureFormattedGameSnapshot, normalizeDecisionTrace } from "../../shared/agentGameHelpers.ts";
import { getMaxPicks } from "../../generate-avatar-picks/promptBuilder.ts";
import { type AgentGenContext, type SubmitReport } from "./context.ts";

// Copied verbatim from process-agent-generation-job-v2/index.ts:56.
function formatPickSelectionForPeriod(selection: string, period: "full" | "f5"): string {
  if (period !== "f5" || /\bF5\b/i.test(selection)) return selection;
  const trimmed = selection.trim();
  if (/\bML$/i.test(trimmed)) return trimmed.replace(/\s+ML$/i, " F5 ML");
  return `${trimmed} F5`;
}

export async function submitPicks(
  ctx: AgentGenContext,
  args: Record<string, unknown>,
): Promise<SubmitReport> {
  const validSlateGameIds = [...ctx.slateGameIds];
  const report: SubmitReport = { ok: true, accepted: 0, rejected: [], validSlateGameIds, allAccepted: false };

  const rawPicks = Array.isArray(args.picks) ? args.picks : [];
  if (rawPicks.length === 0) {
    // Zero picks is a valid outcome (nothing cleared the bar).
    ctx.acceptedPicks = [];
    report.allAccepted = true;
    return report;
  }

  const maxPicks = getMaxPicks(Number(ctx.personalityParams?.max_picks_per_day ?? 3));
  const limited = rawPicks.slice(0, maxPicks);

  const picksToInsert: Record<string, unknown>[] = [];
  const validatorDrops: { game_id: string; reason: string }[] = [];
  const seenGameBetTypes = new Set<string>();
  const reject = (game_id: string, bet_type: string, reason: string) =>
    report.rejected.push({ game_id: String(game_id ?? "?"), bet_type: String(bet_type ?? "?"), reason });

  for (const raw of limited) {
    const gameId = String((raw as Record<string, unknown>)?.game_id ?? "");
    const betType = String((raw as Record<string, unknown>)?.bet_type ?? "");

    // ── Grounding gate (server-side ledger; pre-Zod) ──────────────────────
    if (!ctx.slateGameIds.has(gameId)) {
      reject(gameId, betType, `game_not_in_slate — valid ids: ${validSlateGameIds.slice(0, 20).join(", ")}`);
      continue;
    }
    const grounded = ctx.deepFetched.get(gameId);
    if (!grounded || !grounded.has(betType)) {
      reject(gameId, betType, `bet_type_not_grounded — fetch this game's data (e.g. get_market_odds) before betting ${betType}`);
      continue;
    }

    // ── Zod (V2 schema + units) ───────────────────────────────────────────
    const parsed = GeneratedPickV3Schema.safeParse(raw);
    if (!parsed.success) {
      reject(gameId, betType, `schema_invalid: ${parsed.error.issues.map((i) => i.message).slice(0, 3).join("; ")}`);
      continue;
    }
    const pick = parsed.data;

    const loaded = ctx.games.get(gameId)!; // guaranteed present (slate gate)
    const gameSnapshot = loaded.fg as Record<string, unknown>;
    const sportType = loaded.sport;
    const matchup = String(gameSnapshot.matchup || `${gameSnapshot.away_team} @ ${gameSnapshot.home_team}`);
    const gameDate = String(gameSnapshot.game_date || gameSnapshot.game_date_et || ctx.targetDate);

    // ── Deterministic validator (copied from V2) ─────────────────────────
    // Check 2: dedup (game_id, bet_type) — keep last.
    const dedupKey = `${pick.game_id}::${pick.bet_type}`;
    if (seenGameBetTypes.has(dedupKey)) {
      const idx = picksToInsert.findIndex((p) => p.game_id === pick.game_id && p.bet_type === pick.bet_type);
      if (idx >= 0) picksToInsert.splice(idx, 1);
    }
    seenGameBetTypes.add(dedupKey);

    // Check 3: team-in-selection for spread/moneyline.
    const awayTeam = String(gameSnapshot.away_team || "").toLowerCase().trim();
    const homeTeam = String(gameSnapshot.home_team || "").toLowerCase().trim();
    const selectionLower = pick.selection.toLowerCase().trim();
    if (pick.bet_type !== "total" && awayTeam && homeTeam) {
      const awayLast = awayTeam.split(/\s+/).pop() || "";
      const homeLast = homeTeam.split(/\s+/).pop() || "";
      const first = selectionLower.split(/\s+/)[0] || "___";
      const matchesAway = selectionLower.includes(awayTeam) || selectionLower.includes(awayLast) || awayTeam.includes(first);
      const matchesHome = selectionLower.includes(homeTeam) || selectionLower.includes(homeLast) || homeTeam.includes(first);
      if (!matchesAway && !matchesHome) {
        validatorDrops.push({ game_id: pick.game_id, reason: `team_not_in_matchup: "${pick.selection}"` });
        reject(gameId, betType, `team_not_in_matchup: "${pick.selection}" vs ${awayTeam}/${homeTeam}`);
        continue;
      }
    }

    const formattedSnapshot = ensureFormattedGameSnapshot(gameSnapshot, sportType, pick.game_id);

    let effectiveBetType: "spread" | "moneyline" | "total" = pick.bet_type;
    const effectivePeriod: "full" | "f5" = (pick.period ?? "full") as "full" | "f5";
    let effectiveSelection = pick.selection;
    let effectiveOdds = pick.odds;
    let mlSwapInfo: string | null = null;

    // ML→RL auto-swap (MLB, max_favorite_odds).
    if (sportType === "mlb" && effectiveBetType === "moneyline") {
      const maxFav = (ctx.personalityParams as Record<string, unknown>)?.max_favorite_odds;
      const oddsNum = parseInt(String(effectiveOdds), 10);
      if (typeof maxFav === "number" && Number.isFinite(oddsNum) && oddsNum < 0 && oddsNum < maxFav) {
        const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
        const rlKey = effectivePeriod === "f5" ? "f5_rl" : "full_rl";
        const rlBlock = vegasLines?.[rlKey] as Record<string, unknown> | undefined;
        const homeName = String(gameSnapshot.home_team || "");
        const awayName = String(gameSnapshot.away_team || "");
        const isHome = !!homeName && String(effectiveSelection).toLowerCase().includes(homeName.toLowerCase());
        const side: "home" | "away" = isHome ? "home" : "away";
        const teamName = isHome ? homeName : awayName;
        const spread = rlBlock?.[`${side}_spread`] as number | null | undefined;
        const rlOddsRaw = rlBlock?.[`${side}_odds`] as string | null | undefined;
        const rlOddsNum = typeof rlOddsRaw === "string" ? parseInt(rlOddsRaw, 10) : NaN;
        if (rlBlock && typeof spread === "number" && Number.isFinite(rlOddsNum) && teamName) {
          if (rlOddsNum < 0 && rlOddsNum < maxFav) {
            validatorDrops.push({ game_id: pick.game_id, reason: `ml_and_rl_both_too_chalky: ML ${oddsNum}, RL ${rlOddsNum}, cap ${maxFav}` });
            reject(gameId, betType, "ml_and_rl_both_too_chalky");
            continue;
          }
          const spreadStr = spread > 0 ? `+${spread}` : `${spread}`;
          const periodPrefix = effectivePeriod === "f5" ? " F5" : "";
          effectiveBetType = "spread";
          effectiveSelection = `${teamName}${periodPrefix} ${spreadStr}`;
          effectiveOdds = String(rlOddsRaw);
          mlSwapInfo = `ML ${oddsNum} → ${rlKey} ${spreadStr} ${rlOddsRaw} (cap ${maxFav})`;
        } else {
          validatorDrops.push({ game_id: pick.game_id, reason: `ml_too_chalky_no_rl_data: ML ${oddsNum}, cap ${maxFav}` });
          reject(gameId, betType, "ml_too_chalky_no_rl_data");
          continue;
        }
      }
    }

    // Totals line rewrite to the Vegas line (period-aware).
    if (effectiveBetType === "total") {
      const dirMatch = String(effectiveSelection || "").match(/\b(over|under)\b/i);
      const direction = dirMatch ? (dirMatch[1].toLowerCase() === "over" ? "Over" : "Under") : null;
      const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
      let vegasTotalRaw: unknown;
      if (effectivePeriod === "f5") {
        const f5Ou = vegasLines?.f5_ou as Record<string, unknown> | undefined;
        vegasTotalRaw = f5Ou?.line ?? gameSnapshot.f5_total_line;
      } else {
        const fullOu = vegasLines?.full_ou as Record<string, unknown> | undefined;
        vegasTotalRaw = fullOu?.line ?? vegasLines?.total ?? gameSnapshot.total_line ?? gameSnapshot.vegas_total;
      }
      const vegasTotal = typeof vegasTotalRaw === "number" ? vegasTotalRaw
        : typeof vegasTotalRaw === "string" && vegasTotalRaw.trim() !== "" ? Number(vegasTotalRaw)
        : null;
      if (direction && vegasTotal != null && !Number.isNaN(vegasTotal)) {
        effectiveSelection = formatPickSelectionForPeriod(`${direction} ${vegasTotal}`, effectivePeriod);
      }
    }

    effectiveSelection = formatPickSelectionForPeriod(effectiveSelection, effectivePeriod);

    // ── Units clamp (V3-only) ─────────────────────────────────────────────
    const clamp = clampUnits(pick.units, ctx.steering.unitBand, pick.confidence);

    const overrides =
      effectiveBetType !== pick.bet_type || effectiveSelection !== pick.selection ||
      effectiveOdds !== pick.odds || mlSwapInfo !== null || clamp.overridden
        ? {
            ml_to_rl_swap: mlSwapInfo,
            original_bet_type: pick.bet_type,
            original_selection: pick.selection,
            original_odds: pick.odds,
            effective_bet_type: effectiveBetType,
            effective_selection: effectiveSelection,
            effective_odds: effectiveOdds,
            units_clamp: clamp.overridden
              ? { model_requested: clamp.modelRequested, suggested: clamp.suggested, clamped: clamp.units, reason: clamp.reason, band: ctx.steering.unitBand }
              : undefined,
          }
        : undefined;

    const dt = (pick as Record<string, unknown>).decision_trace;
    picksToInsert.push({
      avatar_id: ctx.avatarId,
      game_id: pick.game_id,
      sport: sportType,
      matchup: matchup || `Game ${pick.game_id}`,
      game_date: gameDate,
      bet_type: effectiveBetType,
      period: effectivePeriod,
      pick_selection: effectiveSelection,
      odds: effectiveOdds,
      units: clamp.units,
      confidence: pick.confidence,
      reasoning_text: pick.reasoning,
      key_factors: pick.key_factors,
      ai_decision_trace: normalizeDecisionTrace(
        pick as unknown as Parameters<typeof normalizeDecisionTrace>[0],
        formattedSnapshot,
        ctx.personalityParams || {},
      ),
      ai_audit_payload: {
        generation_version: "v3",
        run_id: ctx.runId,
        system_prompt_version: ctx.systemPromptVersion,
        steering: ctx.steering,
        model_response_payload: pick,
        decision_trace: dt ?? null,
        pick_data_sources: dt && typeof dt === "object" && Array.isArray((dt as Record<string, unknown>).leaned_metrics)
          ? ((dt as Record<string, unknown>).leaned_metrics as Record<string, unknown>[]).map((m) => m?.source_tool_call_id).filter(Boolean)
          : [],
        validator_drops: validatorDrops.length > 0 ? validatorDrops : undefined,
        validator_overrides: overrides,
        tool_trace: ctx.toolTrace,
      },
      archived_game_data: formattedSnapshot,
      archived_personality: ctx.personalityParams,
      result: "pending",
      is_auto_generated: ctx.generationType === "auto",
    });
  }

  ctx.acceptedPicks = picksToInsert;
  ctx.dropReports = validatorDrops;
  report.accepted = picksToInsert.length;
  report.allAccepted = report.rejected.length === 0;

  // ── Write (skipped on dry_run) ────────────────────────────────────────
  if (!ctx.dryRun && picksToInsert.length > 0) {
    if (ctx.generationType === "manual") {
      const ids = picksToInsert.map((p) => p.game_id as string);
      await ctx.main.from("avatar_picks").delete().eq("avatar_id", ctx.avatarId).in("game_id", ids);
    }
    const { error } = await ctx.main
      .from("avatar_picks")
      .upsert(picksToInsert, { onConflict: "avatar_id,game_id,bet_type" });
    if (error) {
      report.ok = false;
      report.rejected.push({ game_id: "*", bet_type: "*", reason: `db_upsert_failed: ${error.message}` });
    }
  }

  return report;
}
