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
// Reuse the ONE prop-key builder so the submit gate keys byte-identically to the
// keys get_props registers in ctx.bettableProps. Do NOT re-define it here.
import { propKey } from "./readTools.ts";

// Period-tags the human-readable selection. f5 (MLB) branch copied verbatim from
// process-agent-generation-job-v2/index.ts:56; h1 (NFL/CFB first half) mirrors it
// with a "1H" tag so a graded selection reads "Bills 1H -1.5" / "Over 24.5 1H".
// 'full' is a pass-through.
function formatPickSelectionForPeriod(selection: string, period: "full" | "f5" | "h1"): string {
  if (period === "f5") {
    if (/\bF5\b/i.test(selection)) return selection;
    const trimmed = selection.trim();
    if (/\bML$/i.test(trimmed)) return trimmed.replace(/\s+ML$/i, " F5 ML");
    return `${trimmed} F5`;
  }
  if (period === "h1") {
    if (/\b1H\b/i.test(selection)) return selection;
    const trimmed = selection.trim();
    if (/\bML$/i.test(trimmed)) return trimmed.replace(/\s+ML$/i, " 1H ML");
    return `${trimmed} 1H`;
  }
  return selection;
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
    if (betType === "prop") {
      // Props ground against the bettableProps ledger (NOT deepFetched): only the
      // signal-backed props get_props surfaced as is_bettable can be staked.
      // prop_line is NOT required: player_anytime_td has no line, and propKey
      // coerces an undefined line → "" which matches the ledger's null-line key.
      const rawRec = raw as Record<string, unknown>;
      const pPlayer = rawRec.prop_player, pMarket = rawRec.prop_market, pLine = rawRec.prop_line, pDir = rawRec.prop_direction;
      if (pPlayer == null || pMarket == null || pDir == null) {
        reject(gameId, betType, "prop_fields_required — prop bets need prop_player, prop_market, and prop_direction (copy them verbatim from get_props; prop_line too for lined markets)");
        continue;
      }
      const pk = propKey(pPlayer, pMarket, pLine);
      if (!ctx.bettableProps.get(gameId)?.has(pk)) {
        reject(gameId, betType, "prop_not_bettable — only signal-backed props surfaced by get_props can be bet");
        continue;
      }
    } else {
      const grounded = ctx.deepFetched.get(gameId);
      if (!grounded || !grounded.has(betType)) {
        reject(gameId, betType, `bet_type_not_grounded — fetch this game's data (e.g. get_market_odds) before betting ${betType}`);
        continue;
      }
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
    // Check 2: dedup — keep last. Props key on player+market so two distinct
    // props in one game coexist (they all share bet_type 'prop'); non-props key
    // on (game_id, bet_type) as before.
    const dedupKey = pick.bet_type === "prop"
      ? `${pick.game_id}::prop::${String(pick.prop_player ?? "").toLowerCase()}::${String(pick.prop_market ?? "").toLowerCase()}`
      : `${pick.game_id}::${pick.bet_type}`;
    if (seenGameBetTypes.has(dedupKey)) {
      const idx = pick.bet_type === "prop"
        ? picksToInsert.findIndex((p) =>
            p.game_id === pick.game_id && p.bet_type === "prop" &&
            String(p.prop_player ?? "").toLowerCase() === String(pick.prop_player ?? "").toLowerCase() &&
            String(p.prop_market ?? "").toLowerCase() === String(pick.prop_market ?? "").toLowerCase())
        : picksToInsert.findIndex((p) => p.game_id === pick.game_id && p.bet_type === pick.bet_type);
      if (idx >= 0) picksToInsert.splice(idx, 1);
    }
    seenGameBetTypes.add(dedupKey);

    // Check 3: team-in-selection for spread/moneyline. Skipped for props — a
    // prop selection is a player name, not a team.
    const awayTeam = String(gameSnapshot.away_team || "").toLowerCase().trim();
    const homeTeam = String(gameSnapshot.home_team || "").toLowerCase().trim();
    const selectionLower = pick.selection.toLowerCase().trim();
    if (pick.bet_type !== "total" && pick.bet_type !== "prop" && awayTeam && homeTeam) {
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

    let effectiveBetType: "spread" | "moneyline" | "total" | "prop" | "team_total" = pick.bet_type;
    // team_total is always a full-game market (a single team's full-game points),
    // so it never carries a period — force 'full' regardless of what's sent.
    const effectivePeriod: "full" | "f5" | "h1" = pick.bet_type === "team_total"
      ? "full"
      : ((pick.period ?? "full") as "full" | "f5" | "h1");
    let effectiveSelection = pick.selection;
    let effectiveOdds = pick.odds;
    let mlSwapInfo: string | null = null;

    // ML→RL auto-swap (MLB, max_favorite_odds). Inherently prop-safe: props are
    // NFL-only and bet_type 'prop' (never 'moneyline'), so this never fires.
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

    // Totals line rewrite to the Vegas line (period-aware). Inherently prop-safe:
    // a prop's bet_type is 'prop' (never 'total'), so props keep their prop_line.
    // SKIPPED for team_total — that's a per-team line, rewritten in its own block.
    if (effectiveBetType === "total") {
      const dirMatch = String(effectiveSelection || "").match(/\b(over|under)\b/i);
      const direction = dirMatch ? (dirMatch[1].toLowerCase() === "over" ? "Over" : "Under") : null;
      const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
      let vegasTotalRaw: unknown;
      if (effectivePeriod === "f5") {
        const f5Ou = vegasLines?.f5_ou as Record<string, unknown> | undefined;
        vegasTotalRaw = f5Ou?.line ?? gameSnapshot.f5_total_line;
      } else if (effectivePeriod === "h1") {
        // 1H total (NFL/CFB). Dryrun key: vegas_lines.first_half.total_close.
        const firstHalf = vegasLines?.first_half as Record<string, unknown> | undefined;
        vegasTotalRaw = firstHalf?.total_close;
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

    // team_total line rewrite (NFL/CFB). Resolve which side the selection names,
    // pull THAT team's posted team-total line from vegas_lines.team_totals
    // (home_close / away_close — same key on both the NFL + CFB dryrun formatters),
    // and rewrite to "{Team} {Over|Under} {line}". period stays 'full'. If the
    // team or line can't be resolved we keep the model's verbatim selection (the
    // team-in-selection validator above already confirmed a team is named).
    if (effectiveBetType === "team_total") {
      const dirMatch = String(effectiveSelection || "").match(/\b(over|under)\b/i);
      const direction = dirMatch ? (dirMatch[1].toLowerCase() === "over" ? "Over" : "Under") : null;
      const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
      const teamTotals = vegasLines?.team_totals as Record<string, unknown> | undefined;
      const homeName = String(gameSnapshot.home_team || "");
      const awayName = String(gameSnapshot.away_team || "");
      const selLower = String(effectiveSelection).toLowerCase();
      const homeLast = homeName.toLowerCase().split(/\s+/).pop() || "";
      const awayLast = awayName.toLowerCase().split(/\s+/).pop() || "";
      // Prefer the home match; fall back to away. Use last-word too (e.g. "Bills").
      const isHome = !!homeName && (selLower.includes(homeName.toLowerCase()) || (!!homeLast && selLower.includes(homeLast)));
      const isAway = !!awayName && (selLower.includes(awayName.toLowerCase()) || (!!awayLast && selLower.includes(awayLast)));
      const side: "home" | "away" | null = isHome ? "home" : isAway ? "away" : null;
      const teamName = side === "home" ? homeName : side === "away" ? awayName : null;
      const ttRaw = side ? teamTotals?.[`${side}_close`] : undefined;
      const ttLine = typeof ttRaw === "number" ? ttRaw
        : typeof ttRaw === "string" && ttRaw.trim() !== "" ? Number(ttRaw)
        : null;
      if (direction && teamName && ttLine != null && !Number.isNaN(ttLine)) {
        effectiveSelection = `${teamName} ${direction} ${ttLine}`;
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
    // Props are always full-game and carry the model's verbatim selection (a
    // player line, never period-rewritten) plus the four structured columns.
    const isProp = effectiveBetType === "prop";
    picksToInsert.push({
      avatar_id: ctx.avatarId,
      game_id: pick.game_id,
      sport: sportType,
      matchup: matchup || `Game ${pick.game_id}`,
      game_date: gameDate,
      bet_type: effectiveBetType,
      period: isProp ? "full" : effectivePeriod,
      pick_selection: isProp ? pick.selection : effectiveSelection,
      odds: effectiveOdds,
      ...(isProp
        ? {
            prop_player: pick.prop_player,
            prop_market: pick.prop_market,
            prop_line: pick.prop_line,
            prop_direction: pick.prop_direction,
          }
        : {}),
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

  // ── Same-game correlation guard (V3 quality floor, always on) ──────────────
  // Stacking correlated bets on ONE game — e.g. full Under + that team's TT Under
  // + 1H Under — is one thesis bet three times, not three independent edges, and
  // reads as a broken card to users. Per game we keep at most ONE "scoring" pick
  // (full/1H total + team_total) and ONE "sides" pick (spread/moneyline, full/1H);
  // player props are exempt (player-level, signal-gated). On a collision we keep
  // the higher-conviction pick (units, then confidence). Runs post-validation, so
  // only already-valid picks are ever dropped — and the drops are reported back.
  const corrBucket = (bt: unknown): "scoring" | "sides" | null => {
    const b = String(bt);
    if (b === "total" || b === "team_total") return "scoring";
    if (b === "spread" || b === "moneyline") return "sides";
    return null; // props (and anything new) exempt from the per-game cap
  };
  const corrGroups = new Map<string, Record<string, unknown>[]>();
  for (const p of picksToInsert) {
    const bucket = corrBucket(p.bet_type);
    if (!bucket) continue;
    const key = `${bucket}::${p.game_id}`; // bucket first → unambiguous split
    let arr = corrGroups.get(key);
    if (!arr) { arr = []; corrGroups.set(key, arr); }
    arr.push(p);
  }
  const corrLosers = new Set<Record<string, unknown>>();
  for (const [key, group] of corrGroups) {
    if (group.length <= 1) continue;
    const bucket = key.split("::")[0];
    group.sort((a, b) => (Number(b.units) - Number(a.units)) || (Number(b.confidence) - Number(a.confidence)));
    for (const loser of group.slice(1)) {
      corrLosers.add(loser);
      const reason = `same_game_correlated_${bucket}: dropped "${loser.pick_selection}" — kept higher-conviction "${group[0].pick_selection}" (max one ${bucket} bet per game; stacking the same thesis is one correlated position, not independent edges)`;
      validatorDrops.push({ game_id: String(loser.game_id), reason });
      reject(String(loser.game_id), String(loser.bet_type), reason);
    }
  }
  if (corrLosers.size > 0) {
    const kept = picksToInsert.filter((p) => !corrLosers.has(p));
    picksToInsert.splice(0, picksToInsert.length, ...kept);
  }

  ctx.acceptedPicks = picksToInsert;
  ctx.dropReports = validatorDrops;
  report.accepted = picksToInsert.length;
  report.allAccepted = report.rejected.length === 0;

  // ── Write (skipped on dry_run) ────────────────────────────────────────
  // Props CANNOT ride the straights upsert: two props in one game both key to
  // (avatar_id, game_id, 'prop'), so they'd collide on unique_avatar_pick and a
  // dup-key upsert array errors in Postgres. So we partition: straights keep the
  // per-row upsert (unchanged); props use a delete-then-insert per game.
  const straightRows = picksToInsert.filter((p) => p.bet_type !== "prop");
  const propRows = picksToInsert.filter((p) => p.bet_type === "prop");

  if (!ctx.dryRun && picksToInsert.length > 0) {
    if (ctx.generationType === "manual") {
      const ids = picksToInsert.map((p) => p.game_id as string);
      await ctx.main.from("avatar_picks").delete().eq("avatar_id", ctx.avatarId).in("game_id", ids);
    }

    if (straightRows.length > 0) {
      const { error } = await ctx.main
        .from("avatar_picks")
        .upsert(straightRows, { onConflict: "avatar_id,game_id,bet_type" });
      if (error) {
        report.ok = false;
        report.rejected.push({ game_id: "*", bet_type: "*", reason: `db_upsert_failed: ${error.message}` });
      }
    }

    if (propRows.length > 0) {
      // Idempotent re-run safety (manual + auto): clear this avatar's existing
      // prop rows for the touched games, then plain-insert the new ones. (The
      // manual delete above already cleared them; this also covers auto re-runs.)
      const propGameIds = [...new Set(propRows.map((p) => p.game_id as string))];
      await ctx.main
        .from("avatar_picks")
        .delete()
        .eq("avatar_id", ctx.avatarId)
        .eq("bet_type", "prop")
        .in("game_id", propGameIds);
      const { error: propError } = await ctx.main.from("avatar_picks").insert(propRows);
      if (propError) {
        report.ok = false;
        report.rejected.push({ game_id: "*", bet_type: "prop", reason: `db_prop_insert_failed: ${propError.message}` });
      }
    }
  }

  return report;
}
