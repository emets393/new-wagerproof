// submit_parlay — terminal write tool for multi-leg parlay tickets. Mirrors
// submit_picks' per-leg validation (grounding gate, team-in-selection, MLB ML→RL
// swap, totals→Vegas rewrite, F5 format), then the parlay-specific work: combine
// the legs into ONE American price, clamp ONE ticket stake, write avatar_parlays +
// avatar_parlay_legs.
//
// A parlay is ALL-OR-NOTHING on validity: if any leg fails the grounding gate or a
// validator, the whole ticket is rejected (you can't half-submit a parlay). Per-leg
// validators are COPIED from submitPicks (zero-V2-impact doctrine), not extracted.
// Only routed when the agent's steering.maxParlayLegs > 0.
// See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md.

import { clampUnits } from "../unitBands";
import { ensureFormattedGameSnapshot } from "../../shared/agentGameHelpers";
import { footballWeekFinalDate } from "../../shared/dateUtils";
import { type AgentGenContext, type SubmitReport } from "./context";
// Reuse the ONE prop-key builder so a prop leg's gate keys byte-identically to
// the keys get_props registers in ctx.bettableProps (same as submitPicks.ts).
import { propKey } from "./readTools";

// Volume markets (pass/rush attempts + completions) are the game-script latent factor — they
// correlate with everything else in their game (proven in nfl-prop-model-deepdive), so no book
// / our own model treats them as independent. Rule: a volume-market leg must be the ONLY leg for
// its game in a parlay — it can't share a game with any other prop, side, total, or 1H leg.
// See .claude/docs/agents/16_PARLAY_AGENTS.md.
const VOLUME_MARKETS = new Set([
  "player_pass_attempts", "player_rush_attempts", "player_pass_completions",
]);

// Copied verbatim from tools/submitPicks.ts (f5 branch from V2; h1 mirrors it for
// NFL/CFB first-half legs so a graded leg reads "Bills 1H -1.5" / "Over 24.5 1H").
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

// American odds <-> decimal, for combining parlay legs into one price.
function americanToDecimal(odds: string): number {
  const a = parseInt(String(odds), 10);
  if (!Number.isFinite(a) || a === 0) return NaN;
  return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
}
function decimalToAmerican(d: number): string {
  if (!Number.isFinite(d) || d <= 1) return "+100";
  const a = d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
  return a > 0 ? `+${a}` : `${a}`;
}

interface LegRow {
  game_id: string;
  sport: string;
  matchup: string;
  game_date: string;
  bet_type: string;
  period: string;
  pick_selection: string;
  odds: string;
  // Structured prop columns (bet_type==='prop' only; null on non-prop legs).
  // Mirror avatar_picks' prop cols so the parlay grader resolves the leg via
  // gradeProp. See migration 20260622000004_avatar_parlay_legs_props.sql.
  prop_player?: string;
  prop_market?: string;
  prop_line?: number | null;
  prop_direction?: string;
  archived_game_data: Record<string, unknown>;
  leg_result: string;
}

export async function submitParlay(
  ctx: AgentGenContext,
  args: Record<string, unknown>,
): Promise<SubmitReport> {
  const validSlateGameIds = [...ctx.slateGameIds];
  const report: SubmitReport = { ok: true, accepted: 0, rejected: [], validSlateGameIds, allAccepted: false };

  const rawParlays = Array.isArray(args.parlays) ? args.parlays : [];
  if (rawParlays.length === 0) {
    report.allAccepted = true;
    return report;
  }

  // Week-long runs allow 6-leg tickets (vs the daily hard cap of 4).
  const weekly = ctx.window === "week";
  const maxLegs = Math.min(weekly ? 6 : 4, Math.max(2, ctx.steering.maxParlayLegs || 0));
  // A week-long run offers a FEW distinct parlay options (they fill the weekly
  // rail), capped so one run can't flood the section. Counted across
  // submit_parlay calls since the tool is non-terminal.
  const WEEKLY_MAX_TICKETS = 3;
  // Parlays reject as a unit; the "bet_type" field carries "parlay", game_id the label.
  const reject = (label: string, reason: string) =>
    report.rejected.push({ game_id: label, bet_type: "parlay", reason });

  const toWrite: { parlay: Record<string, unknown>; legs: LegRow[] }[] = [];

  for (let p = 0; p < rawParlays.length; p++) {
    // Cap the number of week-long tickets across the run's submit_parlay calls.
    if (weekly && ctx.weeklyTicketsSubmitted + toWrite.length >= WEEKLY_MAX_TICKETS) {
      reject(`parlay#${p + 1}`, `weekly_ticket_cap: a week-long run submits at most ${WEEKLY_MAX_TICKETS} parlay tickets`);
      continue;
    }
    const par = rawParlays[p] as Record<string, unknown>;
    const label = `parlay#${p + 1}`;
    const rawLegs = Array.isArray(par?.legs) ? par.legs : [];

    if (rawLegs.length < 2) { reject(label, "parlay_needs_at_least_2_legs"); continue; }
    if (rawLegs.length > maxLegs) { reject(label, `too_many_legs: ${rawLegs.length} > max ${maxLegs}`); continue; }

    const legs: LegRow[] = [];
    const sports = new Set<string>();
    const seenLegKeys = new Set<string>(); // exact-duplicate leg guard (props key on game+player+market)
    const seenNonPropGames = new Set<string>(); // correlation guard: ≤1 non-prop leg per game (props exempt)
    const gameLegCounts = new Map<string, number>(); // volume-market solo guard: legs per game
    const volumeGames = new Set<string>();           // games that carry a volume-market leg
    let decimalProduct = 1;
    let legFailure: string | null = null;

    for (const rawLeg of rawLegs) {
      const leg = rawLeg as Record<string, unknown>;
      const gameId = String(leg?.game_id ?? "");
      const betType = String(leg?.bet_type ?? "");

      // ── Grounding gate (identical to submit_picks) ──────────────────────
      if (!ctx.slateGameIds.has(gameId)) { legFailure = `leg ${gameId}: game_not_in_slate`; break; }
      if (!(betType === "spread" || betType === "moneyline" || betType === "total" || betType === "prop" || betType === "team_total")) { legFailure = `leg ${gameId}: invalid bet_type ${betType}`; break; }

      // Props ground against the bettableProps ledger (NOT deepFetched), exactly
      // like submit_picks: only signal-backed props get_props surfaced as
      // bettable can be a leg. Non-prop legs keep the deepFetched grounding gate.
      let legKey: string;
      if (betType === "prop") {
        const pPlayer = leg?.prop_player, pMarket = leg?.prop_market, pDir = leg?.prop_direction;
        if (pPlayer == null || pMarket == null || pDir == null) { legFailure = `leg ${gameId}: prop_fields_required`; break; }
        // prop_line omitted for player_anytime_td; propKey coerces undefined → "".
        const pk = propKey(pPlayer, pMarket, leg?.prop_line);
        if (!ctx.bettableProps.get(gameId)?.has(pk)) { legFailure = `leg ${gameId}: prop_not_bettable`; break; }
        // Key on player+market so two distinct props in one game coexist in one
        // ticket (they all share bet_type 'prop').
        legKey = `${gameId}::prop::${String(pPlayer).toLowerCase()}::${pMarket}`;
      } else {
        const grounded = ctx.deepFetched.get(gameId);
        if (!grounded || !grounded.has(betType)) { legFailure = `leg ${gameId} ${betType}: not_grounded — fetch this game's data first`; break; }
        // Correlation guard: at most ONE non-prop leg per game (full-game + 1H +
        // team-total all count). No book lets you parlay e.g. both team totals +
        // the game total of one game — they're correlated. Player props are exempt
        // (handled in the branch above; they may share a game with each other and
        // with a single non-prop leg).
        if (seenNonPropGames.has(gameId)) { legFailure = `leg ${gameId}: same_game_non_prop_not_allowed — only one full-game/1H/team-total leg per game in a parlay (player props can share a game)`; break; }
        seenNonPropGames.add(gameId);
        legKey = `${gameId}::${betType}`;
      }
      if (seenLegKeys.has(legKey)) { legFailure = `duplicate leg ${legKey} in one ticket`; break; }
      seenLegKeys.add(legKey);

      // Volume-market solo guard (see 16_PARLAY_AGENTS.md): rush/pass attempts + completions are
      // the game-script latent factor, so a volume-market leg must be the ONLY leg for its game —
      // it cannot share a game with any other prop, side, total, team-total, or 1H leg.
      const isVolumeLeg = betType === "prop" && VOLUME_MARKETS.has(String(leg?.prop_market ?? ""));
      if (isVolumeLeg && (gameLegCounts.get(gameId) ?? 0) >= 1) {
        legFailure = `leg ${gameId}: volume_market_solo_only — ${String(leg?.prop_market)} (attempts/completions) must be the only leg for its game`; break;
      }
      if (!isVolumeLeg && volumeGames.has(gameId)) {
        legFailure = `leg ${gameId}: volume_market_solo_only — this game already has an attempts/completions leg, which must be its only leg`; break;
      }
      gameLegCounts.set(gameId, (gameLegCounts.get(gameId) ?? 0) + 1);
      if (isVolumeLeg) volumeGames.add(gameId);

      const loaded = ctx.games.get(gameId);
      if (!loaded) { legFailure = `leg ${gameId}: game_not_loaded`; break; }
      const gameSnapshot = loaded.fg as Record<string, unknown>;
      const sportType = loaded.sport;
      // Sport enforcement (defense in depth): reject a leg for a sport the agent
      // no longer has selected. See plan D1.
      if (!ctx.steering.preferredSports.includes(sportType)) { legFailure = `leg ${gameId}: sport_not_selected ${sportType}`; break; }
      // Market allowlist gate (see plan D2): reject a leg whose bet_type the agent
      // doesn't permit. Skipped when steering has no allowlist (legacy).
      if (ctx.steering.allowedMarkets && !ctx.steering.allowedMarkets.includes(betType)) { legFailure = `leg ${gameId}: market_not_allowed ${betType}`; break; }
      const matchup = String(gameSnapshot.matchup || `${gameSnapshot.away_team} @ ${gameSnapshot.home_team}`);
      const gameDate = String(gameSnapshot.game_date || gameSnapshot.game_date_et || ctx.targetDate);

      let effectiveBetType: "spread" | "moneyline" | "total" | "prop" | "team_total" = betType as "spread" | "moneyline" | "total" | "prop" | "team_total";
      // team_total is full-game only; h1 = NFL/CFB first half (mirrors f5/MLB).
      const rawPeriod = String(leg?.period ?? "full");
      const effectivePeriod: "full" | "f5" | "h1" = effectiveBetType === "team_total"
        ? "full"
        : rawPeriod === "f5" ? "f5" : rawPeriod === "h1" ? "h1" : "full";
      let effectiveSelection = String(leg?.selection ?? "");
      let effectiveOdds = String(leg?.odds ?? "");

      // team-in-selection (spread/ML)
      const awayTeam = String(gameSnapshot.away_team || "").toLowerCase().trim();
      const homeTeam = String(gameSnapshot.home_team || "").toLowerCase().trim();
      const selLower = effectiveSelection.toLowerCase().trim();
      // Skipped for total + prop: a prop selection is a player name, not a team.
      if (effectiveBetType !== "total" && effectiveBetType !== "prop" && awayTeam && homeTeam) {
        const awayLast = awayTeam.split(/\s+/).pop() || "";
        const homeLast = homeTeam.split(/\s+/).pop() || "";
        const first = selLower.split(/\s+/)[0] || "___";
        const mA = selLower.includes(awayTeam) || selLower.includes(awayLast) || awayTeam.includes(first);
        const mH = selLower.includes(homeTeam) || selLower.includes(homeLast) || homeTeam.includes(first);
        if (!mA && !mH) { legFailure = `leg ${gameId}: team_not_in_matchup "${effectiveSelection}"`; break; }
      }

      // MLB ML→RL swap (identical to submit_picks)
      if (sportType === "mlb" && effectiveBetType === "moneyline") {
        const maxFav = (ctx.personalityParams as Record<string, unknown>)?.max_favorite_odds;
        const oddsNum = parseInt(String(effectiveOdds), 10);
        if (typeof maxFav === "number" && Number.isFinite(oddsNum) && oddsNum < 0 && oddsNum < maxFav) {
          const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
          const rlKey = effectivePeriod === "f5" ? "f5_rl" : "full_rl";
          const rlBlock = vegasLines?.[rlKey] as Record<string, unknown> | undefined;
          const homeName = String(gameSnapshot.home_team || "");
          const awayName = String(gameSnapshot.away_team || "");
          const isHome = !!homeName && effectiveSelection.toLowerCase().includes(homeName.toLowerCase());
          const side: "home" | "away" = isHome ? "home" : "away";
          const teamName = isHome ? homeName : awayName;
          const spread = rlBlock?.[`${side}_spread`] as number | null | undefined;
          const rlOddsRaw = rlBlock?.[`${side}_odds`] as string | null | undefined;
          const rlOddsNum = typeof rlOddsRaw === "string" ? parseInt(rlOddsRaw, 10) : NaN;
          if (rlBlock && typeof spread === "number" && Number.isFinite(rlOddsNum) && teamName) {
            if (rlOddsNum < 0 && rlOddsNum < maxFav) { legFailure = `leg ${gameId}: ml_and_rl_both_too_chalky`; break; }
            const spreadStr = spread > 0 ? `+${spread}` : `${spread}`;
            const periodPrefix = effectivePeriod === "f5" ? " F5" : "";
            effectiveBetType = "spread";
            effectiveSelection = `${teamName}${periodPrefix} ${spreadStr}`;
            effectiveOdds = String(rlOddsRaw);
          } else { legFailure = `leg ${gameId}: ml_too_chalky_no_rl_data`; break; }
        }
      }

      // totals→Vegas rewrite (identical to submit_picks). SKIPPED for team_total
      // (per-team line, rewritten in its own block below).
      if (effectiveBetType === "total") {
        const dirMatch = effectiveSelection.match(/\b(over|under)\b/i);
        const direction = dirMatch ? (dirMatch[1].toLowerCase() === "over" ? "Over" : "Under") : null;
        const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
        let vtRaw: unknown;
        if (effectivePeriod === "f5") {
          const f5Ou = vegasLines?.f5_ou as Record<string, unknown> | undefined;
          vtRaw = f5Ou?.line ?? gameSnapshot.f5_total_line;
        } else if (effectivePeriod === "h1") {
          // 1H total (NFL/CFB). Dryrun key: vegas_lines.first_half.total_close.
          const firstHalf = vegasLines?.first_half as Record<string, unknown> | undefined;
          vtRaw = firstHalf?.total_close;
        } else {
          const fullOu = vegasLines?.full_ou as Record<string, unknown> | undefined;
          vtRaw = fullOu?.line ?? vegasLines?.total ?? gameSnapshot.total_line ?? gameSnapshot.vegas_total;
        }
        const vt = typeof vtRaw === "number" ? vtRaw : typeof vtRaw === "string" && vtRaw.trim() !== "" ? Number(vtRaw) : null;
        if (direction && vt != null && !Number.isNaN(vt)) {
          effectiveSelection = formatPickSelectionForPeriod(`${direction} ${vt}`, effectivePeriod);
        }
      }

      // team_total→Vegas rewrite (identical to submit_picks): resolve the team the
      // leg names, pull THAT team's line from vegas_lines.team_totals.{side}_close
      // (same key on NFL + CFB dryrun formatters), rewrite to "{Team} {O|U} {line}".
      if (effectiveBetType === "team_total") {
        const dirMatch = effectiveSelection.match(/\b(over|under)\b/i);
        const direction = dirMatch ? (dirMatch[1].toLowerCase() === "over" ? "Over" : "Under") : null;
        const vegasLines = gameSnapshot.vegas_lines as Record<string, unknown> | undefined;
        const teamTotals = vegasLines?.team_totals as Record<string, unknown> | undefined;
        const homeName = String(gameSnapshot.home_team || "");
        const awayName = String(gameSnapshot.away_team || "");
        const selLower = effectiveSelection.toLowerCase();
        const homeLast = homeName.toLowerCase().split(/\s+/).pop() || "";
        const awayLast = awayName.toLowerCase().split(/\s+/).pop() || "";
        const isHome = !!homeName && (selLower.includes(homeName.toLowerCase()) || (!!homeLast && selLower.includes(homeLast)));
        const isAway = !!awayName && (selLower.includes(awayName.toLowerCase()) || (!!awayLast && selLower.includes(awayLast)));
        const side: "home" | "away" | null = isHome ? "home" : isAway ? "away" : null;
        const teamName = side === "home" ? homeName : side === "away" ? awayName : null;
        const ttRaw = side ? teamTotals?.[`${side}_close`] : undefined;
        const ttLine = typeof ttRaw === "number" ? ttRaw : typeof ttRaw === "string" && ttRaw.trim() !== "" ? Number(ttRaw) : null;
        if (direction && teamName && ttLine != null && !Number.isNaN(ttLine)) {
          effectiveSelection = `${teamName} ${direction} ${ttLine}`;
        }
      }
      effectiveSelection = formatPickSelectionForPeriod(effectiveSelection, effectivePeriod);

      // price the leg + accumulate combined decimal odds (prop odds are American
      // strings too, so they price identically via americanToDecimal)
      const dec = americanToDecimal(effectiveOdds);
      if (!Number.isFinite(dec)) { legFailure = `leg ${gameId}: unpriceable odds "${effectiveOdds}"`; break; }
      decimalProduct *= dec;
      sports.add(sportType);

      // Props are always full-game and carry the model's verbatim selection (a
      // player line, never period-rewritten) plus the four structured columns
      // the parlay grader resolves via gradeProp. Non-prop legs unchanged.
      const isProp = effectiveBetType === "prop";
      legs.push({
        game_id: gameId, sport: sportType, matchup, game_date: gameDate,
        bet_type: effectiveBetType, period: isProp ? "full" : effectivePeriod,
        pick_selection: isProp ? String(leg?.selection ?? effectiveSelection) : effectiveSelection,
        odds: effectiveOdds,
        ...(isProp
          ? {
              prop_player: leg?.prop_player != null ? String(leg.prop_player) : undefined,
              prop_market: leg?.prop_market != null ? String(leg.prop_market) : undefined,
              prop_line: typeof leg?.prop_line === "number" ? leg.prop_line : null,
              prop_direction: leg?.prop_direction != null ? String(leg.prop_direction) : undefined,
            }
          : {}),
        archived_game_data: ensureFormattedGameSnapshot(gameSnapshot, sportType, gameId),
        leg_result: "pending",
      });
    }

    if (legFailure) { reject(label, legFailure); continue; }

    // Distinct-ticket guard (weekly only): a week-long run should offer a few
    // DIFFERENT options, not the same legs restaked. Reject a ticket whose exact
    // leg-set already shipped in this run (tracked across submit_parlay calls).
    if (weekly) {
      // Precise leg identity so only a truly identical leg-set collides — keying
      // props on player+market+line+direction and non-props on the rewritten
      // selection avoids treating opposite sides (Bills -3 vs Dolphins +3, or
      // Over vs Under) as the "same" leg and over-rejecting a distinct ticket.
      const sig = legs
        .map((l) => l.bet_type === "prop"
          ? `${l.game_id}:prop:${(l.prop_player ?? "").toLowerCase()}:${l.prop_market ?? ""}:${l.prop_line ?? ""}:${l.prop_direction ?? ""}`
          : `${l.game_id}:${l.bet_type}:${l.period}:${(l.pick_selection ?? "").toLowerCase()}`)
        .sort()
        .join("|");
      if (ctx.submittedParlaySignatures.has(sig)) {
        reject(label, "duplicate_ticket: these exact legs already shipped in this run — build a genuinely different ticket (vary the games/angle)");
        continue;
      }
      ctx.submittedParlaySignatures.add(sig);
    }

    const clamp = clampUnits(Number(par?.units ?? 1), ctx.steering.unitBand, Number(par?.confidence ?? 3));
    const combinedOdds = decimalToAmerican(decimalProduct);
    const sport = sports.size === 1 ? [...sports][0] : "multi";

    toWrite.push({
      parlay: {
        avatar_id: ctx.avatarId,
        // Weekly tickets: target_date = the week's Monday (final game night) so
        // date-based history bucketing graduates them only after the week ends;
        // week_key (the ET Tuesday) is what the snapshot RPC surfaces them by.
        target_date: weekly && ctx.weekKey ? footballWeekFinalDate(ctx.weekKey) : ctx.targetDate,
        scope: weekly ? "weekly" : "daily",
        week_key: weekly ? ctx.weekKey : null,
        sport,
        legs_count: legs.length,
        combined_odds: combinedOdds,
        units: clamp.units,
        confidence: Number(par?.confidence ?? 3),
        reasoning_text: String(par?.reasoning ?? ""),
        key_factors: par?.key_factors ?? null,
        ai_audit_payload: {
          generation_version: "v3",
          run_id: ctx.runId,
          system_prompt_version: ctx.systemPromptVersion,
          steering: ctx.steering,
          model_response_payload: par,
          combined_decimal: decimalProduct,
          tool_trace: ctx.toolTrace,
        },
        archived_personality: ctx.personalityParams,
        result: "pending",
        is_auto_generated: ctx.generationType === "auto",
      },
      legs,
    });
  }

  report.accepted = toWrite.length;
  report.allAccepted = report.rejected.length === 0;

  // Count weekly tickets across calls even on dry runs, so a second
  // submit_parlay call in the same run still hits the single-ticket guard.
  if (weekly) ctx.weeklyTicketsSubmitted += toWrite.length;

  // ── Write (skipped on dry_run) ────────────────────────────────────────
  // Regens are ADDITIVE: no delete of prior tickets here anymore. Every
  // (re)generation stacks a new ticket; users curate via the swipe-to-trash
  // delete (delete_agent_parlay RPC). This also guarantees weekly and daily
  // runs can never clobber each other's tickets.
  if (!ctx.dryRun && toWrite.length > 0) {
    for (const { parlay, legs } of toWrite) {
      const { data: ins, error: pErr } = await ctx.main
        .from("avatar_parlays").insert(parlay).select("id").single();
      if (pErr || !ins) {
        report.ok = false;
        report.rejected.push({ game_id: "*", bet_type: "parlay", reason: `parlay_insert_failed: ${pErr?.message ?? "no id"}` });
        continue;
      }
      const parlayId = (ins as { id: string }).id;
      const legRows = legs.map((l) => ({ ...l, parlay_id: parlayId }));
      const { error: lErr } = await ctx.main.from("avatar_parlay_legs").insert(legRows);
      if (lErr) {
        // Roll back the orphaned ticket so we never persist a parlay with no legs.
        await ctx.main.from("avatar_parlays").delete().eq("id", parlayId);
        report.ok = false;
        report.rejected.push({ game_id: "*", bet_type: "parlay", reason: `legs_insert_failed: ${lErr.message}` });
      }
    }
  }

  return report;
}
