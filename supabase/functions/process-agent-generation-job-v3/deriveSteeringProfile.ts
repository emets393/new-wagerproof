// deriveSteeringProfile — PURE function mapping an agent's personality
// (personality_params + custom_insights + archetype) onto: which slate lenses
// to attach, tool affinity, weighting prose, unit policy, and constraints.
// V3's analogue of promptBuilder.ts. Deterministic: identical params → identical
// profile. Fully unit-testable; the resolved profile is persisted to
// ai_audit_payload.steering. See plan §3 for the source table.

import { unitBand, type UnitBand } from "./unitBands.ts";

export type LensName =
  | "model_edge" | "market" | "polymarket" | "public" | "weather" | "ratings"
  | "form" | "ats_trends" | "luck" | "situational" | "rankings_context"
  | "injuries" | "pitchers" | "perfect_storm" | "statcast" | "line_move" | "value";

export type ToolAffinity = "+" | "=" | "-";

export interface PersonalityParams {
  risk_tolerance?: number; underdog_lean?: number; over_under_lean?: number;
  confidence_threshold?: number; chase_value?: boolean; parlay_appetite?: number;
  // Week-long parlay (NFL/CFB): opt-in + preferred leg count (2-6, default 4).
  // Weekly runs execute ONLY on the Trigger.dev path (engine_version
  // 'v3_trigger'); these fields exist here for type parity with agents-v3.
  weekly_parlay_enabled?: boolean;
  weekly_parlay_legs?: number;
  preferred_bet_type?: "spread" | "moneyline" | "total" | "prop" | "any";
  // Flat per-market allowlist (spread/moneyline/total/team_total/prop). Unset/empty
  // ⇒ all markets. 'prop' is NFL-only. See plan D2.
  allowed_markets?: string[];
  props_emphasis?: "off" | "allow" | "emphasize";
  max_favorite_odds?: number | null; min_underdog_odds?: number | null;
  max_picks_per_day?: number; skip_weak_slates?: boolean;
  trust_model?: number; trust_polymarket?: number; polymarket_divergence_flag?: boolean;
  fade_public?: boolean; public_threshold?: number;
  weather_impacts_totals?: boolean; weather_sensitivity?: number;
  trust_team_ratings?: number; pace_affects_totals?: boolean;
  weight_recent_form?: number; ride_hot_streaks?: boolean; fade_cold_streaks?: boolean;
  trust_ats_trends?: boolean; regress_luck?: boolean;
  home_court_boost?: number; fade_back_to_backs?: boolean; upset_alert?: boolean;
}

export interface CustomInsights {
  betting_philosophy?: string | null;
  perceived_edges?: string | null;
  avoid_situations?: string | null;
  target_situations?: string | null;
}

export interface AvatarLike {
  preferred_sports?: string[];
  archetype?: string | null;
  personality_params?: PersonalityParams | null;
  custom_insights?: CustomInsights | null;
}

export interface SteeringProfile {
  preferredSports: string[];
  preferredBetType: "spread" | "moneyline" | "total" | "prop" | "any";
  /** Markets this agent may stake (submit gate). Always populated (default = all). */
  allowedMarkets: string[];
  /** Player props allowed for this agent (NFL present + 'prop' in allowedMarkets). */
  propsEnabled: boolean;
  maxPicks: number;
  confidenceFloorPct: number; // win% floor from confidence_threshold
  riskTolerance: number;
  chaseValue: boolean;
  unitBand: UnitBand;
  lensVotes: Partial<Record<LensName, number>>; // lens → max priority (1..5)
  forceLenses: LensName[]; // priority-5, cap-exempt
  toolAffinity: Partial<Record<string, ToolAffinity>>;
  weightingPolicy: string[];
  unitPolicy: string;
  parlayPolicy: string;
  maxParlayLegs: number;  // 0 = parlays disabled (appetite 1); else the leg cap
  weeklyParlayEnabled: boolean; // week-long parlay opt-in (NFL/CFB only; Trigger path)
  weeklyParlayLegs: number;     // leg cap for week runs (2-6)
  constraints: {
    maxFavoriteOdds: number | null;
    minUnderdogOdds: number | null;
    publicThreshold: number | null;
    skipWeakSlates: boolean;
  };
  customInsights: CustomInsights;
  customInsightLensVotes: Partial<Record<LensName, number>>;
  archetype: string | null;
}

const CONF_FLOOR: Record<number, number> = { 1: 55, 2: 60, 3: 65, 4: 70, 5: 75 };
const MAX_PICKS: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 };

export function deriveSteeringProfile(avatar: AvatarLike): SteeringProfile {
  const p: PersonalityParams = avatar.personality_params ?? {};
  const ci: CustomInsights = avatar.custom_insights ?? {};
  const sports = (avatar.preferred_sports ?? ["nfl"]).map((s) => s.toLowerCase());
  const mlbOnly = sports.length === 1 && sports[0] === "mlb";
  const hasNfl = sports.includes("nfl");

  // Market allowlist (submit gate) — unset/empty ⇒ all markets. Props NFL-only, so
  // strip 'prop' with no NFL; props_emphasis:'off' hard-disables props. See plan D2.
  const ALL_MARKETS = ["spread", "moneyline", "total", "team_total", "prop"];
  let allowedMarkets = Array.isArray(p.allowed_markets) && p.allowed_markets.length > 0
    ? p.allowed_markets.filter((m) => ALL_MARKETS.includes(m))
    : [...ALL_MARKETS];
  if (allowedMarkets.length === 0) allowedMarkets = [...ALL_MARKETS];
  if (!hasNfl || p.props_emphasis === "off") allowedMarkets = allowedMarkets.filter((m) => m !== "prop");
  const propsEnabled = allowedMarkets.includes("prop");
  const propsEmphasized = propsEnabled && (p.props_emphasis === "emphasize" || p.preferred_bet_type === "prop");
  const preferredBetType: SteeringProfile["preferredBetType"] =
    p.preferred_bet_type === "prop" && !propsEnabled ? "any" : (p.preferred_bet_type ?? "any");

  const lensVotes: Partial<Record<LensName, number>> = {};
  const forceLenses: LensName[] = [];
  const toolAffinity: Partial<Record<string, ToolAffinity>> = {};
  const weighting: string[] = [];

  const vote = (lens: LensName, priority: number) => {
    lensVotes[lens] = Math.max(lensVotes[lens] ?? 0, priority);
    if (priority >= 5 && !forceLenses.includes(lens)) forceLenses.push(lens);
  };
  const affin = (tool: string, a: ToolAffinity) => {
    // + beats = beats - ; never downgrade a + to -
    const cur = toolAffinity[tool];
    if (a === "+" || cur === undefined || (a === "=" && cur === "-")) toolAffinity[tool] = a;
  };

  // Baseline floor — never blind.
  vote("model_edge", 2);
  vote("market", 2);
  weighting.push("Lead with the model's lean and the market line for the preferred bet type.");

  const num = (v: number | undefined, d = 3) => (typeof v === "number" ? v : d);

  // Model trust
  if (num(p.trust_model) >= 4) { vote("model_edge", num(p.trust_model)); affin("get_model_predictions", "+"); affin("get_game_data", "+"); weighting.push("Trust the model: ≥4 makes it your primary signal."); }
  else if (num(p.trust_model) <= 2) { vote("model_edge", 1); weighting.push("Model is one input among many — corroborate before betting it."); }

  // Polymarket
  if (num(p.trust_polymarket) >= 3) { vote("polymarket", num(p.trust_polymarket)); affin("get_polymarket", "+"); weighting.push("Weight Polymarket implied probability; ≥4 follow it over Vegas."); }
  if (p.polymarket_divergence_flag) { vote("polymarket", 5); affin("get_polymarket", "+"); weighting.push("Flag any ≥10% divergence between Vegas and Polymarket."); }

  // Public / contrarian (NFL/CFB)
  if (p.fade_public) {
    vote("public", 5); affin("get_public_betting", "+"); affin("get_line_movement", "+");
    const thr = { 1: 60, 2: 65, 3: 70, 4: 75, 5: 80 }[Math.min(Math.max(Math.round(num(p.public_threshold)), 1), 5)] ?? 70;
    weighting.push(`Fade lopsided public money — take the other side when one side reaches ≥${thr}%.`);
  }

  // Value / dogs
  if (p.chase_value || num(p.underdog_lean) >= 4) { vote("value", 3); vote("line_move", 3); affin("get_line_movement", "+"); weighting.push("Hunt plus-money dogs and reverse-line-movement value."); }

  // Weather (NFL/CFB/MLB)
  if (p.weather_impacts_totals || num(p.weather_sensitivity) >= 3) { vote("weather", 4); affin("get_weather", "+"); weighting.push("Bad weather (wind/cold/precip) leans totals under."); }

  // Ratings / pace (NBA/NCAAB)
  if (num(p.trust_team_ratings) >= 3 || p.pace_affects_totals) { vote("ratings", num(p.trust_team_ratings)); affin("get_team_ratings", "+"); weighting.push("Adjusted off/def ratings are foundational; pace drives totals."); }

  // Form / streaks (NBA)
  if (num(p.weight_recent_form) >= 3 || p.ride_hot_streaks || p.fade_cold_streaks) { vote("form", num(p.weight_recent_form)); affin("get_recent_form", "+"); weighting.push("Weight L3/L5 form; ride/fade streaks of 4+."); }
  if (p.trust_ats_trends) { vote("ats_trends", 3); affin("get_ats_trends", "+"); weighting.push("Factor each team's ATS cover history."); }
  if (p.regress_luck) { vote("luck", 4); affin("get_recent_form", "+"); weighting.push("Regress lucky teams toward the mean (MLB: xFIP vs ERA)."); }
  if (p.fade_back_to_backs) { vote("form", Math.max(lensVotes.form ?? 0, 2)); weighting.push("Fade teams on the 2nd night of a back-to-back."); }

  // NCAAB
  if (p.upset_alert) { vote("rankings_context", 4); affin("get_situational_trends", "+"); weighting.push("Flag ranked-vs-unranked upset spots."); }

  // NBA injuries always
  if (sports.includes("nba")) { vote("injuries", 3); affin("get_injuries", "+"); weighting.push("Always check the injury report — a star out moves everything."); }

  // MLB single-sport methodology
  if (mlbOnly) {
    vote("pitchers", 5); vote("perfect_storm", 4); vote("statcast", 3); vote("model_edge", Math.max(lensVotes.model_edge ?? 0, 3));
    affin("get_mlb_perfect_storm", "+"); affin("get_mlb_statcast_signals", "+");
    weighting.push("Starting-pitcher matchup first; cross-check Perfect Storm accuracy buckets before firing.");
  }

  // Player props (NFL-only, signal-gated). get_props is already offered to any
  // agent with NFL; emphasis raises tool affinity + weighting prose. See plan D2.
  if (propsEnabled) {
    affin("get_props", "+");
    weighting.push(propsEmphasized
      ? "Hunt signal-backed player props — prioritize them when a validated prop signal fires, and use them as parlay legs."
      : "Consider signal-backed player props when a validated signal supports the edge.");
  }

  // home court / situational
  if (num(p.home_court_boost) >= 4) weighting.push("Weight home-court/home-field advantage heavily.");

  // custom-insight keyword scan (ADD-only, capped)
  const ciLensVotes: Partial<Record<LensName, number>> = {};
  const blob = [ci.betting_philosophy, ci.perceived_edges, ci.target_situations].filter(Boolean).join(" ").toLowerCase();
  const scan: [RegExp, LensName][] = [
    [/polymarket|prediction market/, "polymarket"], [/wind|dome|rain|weather|cold/, "weather"],
    [/bullpen|strikeout|pitch|era|xfip/, "pitchers"], [/public|square|fade/, "public"],
    [/hot hand|streak|momentum|recent form/, "form"], [/injur/, "injuries"],
  ];
  let added = 0;
  for (const [re, lens] of scan) {
    if (added >= 1) break; // ≤1 net lens slot from free-text
    if (re.test(blob) && !lensVotes[lens]) { vote(lens, 2); ciLensVotes[lens] = 2; added++; }
  }

  const risk = num(p.risk_tolerance);
  const band = unitBand(risk, !!p.chase_value);
  // Parlay appetite (1 = straights only … 5 = loves parlays) → leg cap + prose
  // policy. maxParlayLegs 0 also withholds the submit_parlay tool entirely.
  const parlayAppetite = num(p.parlay_appetite, 1);
  const maxParlayLegs = parlayAppetite <= 1 ? 0 : parlayAppetite;

  return {
    preferredSports: sports,
    preferredBetType,
    allowedMarkets,
    propsEnabled,
    maxPicks: MAX_PICKS[Math.min(Math.max(Math.round(num(p.max_picks_per_day)), 1), 5)] ?? 5,
    confidenceFloorPct: CONF_FLOOR[Math.min(Math.max(Math.round(num(p.confidence_threshold)), 1), 5)] ?? 65,
    riskTolerance: risk,
    chaseValue: !!p.chase_value,
    unitBand: band,
    lensVotes,
    forceLenses,
    toolAffinity,
    weightingPolicy: weighting,
    unitPolicy: `Size 0.5–${band.max}u within your band (base ${band.base}u at confidence 3); higher conviction → larger stake.`,
    parlayPolicy: maxParlayLegs === 0
      ? "Submit only straight single-game picks; never combine legs into a parlay."
      : `You may combine your best plays into parlays of up to ${maxParlayLegs} legs (one stake per ticket). ${parlayAppetite >= 4 ? "Lean into parlays when your edges align." : "Use them selectively — only when the combined edge justifies the correlation risk."}`,
    maxParlayLegs,
    weeklyParlayEnabled: p.weekly_parlay_enabled === true,
    weeklyParlayLegs: Math.min(6, Math.max(2, Math.round(num(p.weekly_parlay_legs, 4)))),
    constraints: {
      maxFavoriteOdds: p.max_favorite_odds ?? null,
      minUnderdogOdds: p.min_underdog_odds ?? null,
      publicThreshold: p.fade_public ? (p.public_threshold ?? 3) : null,
      skipWeakSlates: p.skip_weak_slates !== false,
    },
    customInsights: ci,
    customInsightLensVotes: ciLensVotes,
    archetype: avatar.archetype ?? null,
  };
}
