// Regression test for the V3 sport-enforcement guard (see plan D1): an agent must
// never be given a pick/parlay-leg for a sport it does not have selected. The
// guard lives in agents-v3/src/loop/tools/{submitPicks,submitParlay}.ts (mirrored
// in supabase/functions/process-agent-generation-job-v3/tools/). We drive the real
// submit tools in dry-run mode with a slate game whose sport is NOT in the agent's
// preferred_sports and assert the pick/leg is rejected.
//
// Lives in the root vitest suite (agents-v3 has no test runner); imports the real
// engine code across the project boundary.
import { describe, it, expect } from "vitest";
import { submitPicks } from "../../agents-v3/src/loop/tools/submitPicks";
import { submitParlay } from "../../agents-v3/src/loop/tools/submitParlay";
import { deriveSteeringProfile } from "../../agents-v3/src/loop/deriveSteeringProfile";
import type { AgentGenContext } from "../../agents-v3/src/loop/tools/context";

// NFL-only agent with a small parlay appetite (so submit_parlay is enabled).
const steering = deriveSteeringProfile({
  preferred_sports: ["nfl"],
  personality_params: { parlay_appetite: 3, max_picks_per_day: 3 },
});

// A minimal formatted game. The guard fires before the snapshot is used, so this
// can stay tiny. Its sport is "mlb" — deliberately NOT in preferred_sports.
function mlbGame(id: string) {
  return {
    game_id: id,
    away_team: "Away",
    home_team: "Home",
    matchup: "Away @ Home",
    game_date: "2026-07-06",
    vegas_lines: {},
  } as Record<string, unknown>;
}

function makeCtx(gameIds: string[], opts: { sport?: any; steering?: any; grounded?: string[] } = {}): AgentGenContext {
  const sport = opts.sport ?? "mlb";
  const grounded = opts.grounded ?? ["total"];
  const games = new Map<string, { sport: any; fg: Record<string, unknown> }>();
  const slateGameIds = new Set<string>();
  const deepFetched = new Map<string, Set<string>>();
  for (const id of gameIds) {
    games.set(id, { sport, fg: mlbGame(id) });
    slateGameIds.add(id);
    deepFetched.set(id, new Set(grounded));
  }
  return {
    runId: "test-run",
    avatarId: "test-avatar",
    steering: opts.steering ?? steering,
    personalityParams: { max_picks_per_day: 3 },
    systemPromptVersion: "test",
    targetDate: "2026-07-06",
    generationType: "manual",
    dryRun: true, // no DB writes
    main: null as any,
    cfb: null as any,
    games: games as any,
    slateGameIds,
    deepFetched,
    fetchedFacts: new Map(),
    bettableProps: new Map(),
    acceptedPicks: [],
    dropReports: [],
    toolTrace: [],
    reasoningTrace: "",
    lastSubmitReport: null,
    gov: {} as any,
  };
}

function validTotalPick(gameId: string) {
  return {
    game_id: gameId,
    bet_type: "total",
    selection: "Over 8",
    odds: "-110",
    confidence: 3,
    reasoning: "Model leans over and the number is soft; sixty plus characters here.",
    key_factors: ["model leans over", "soft closing total", "weather is neutral"],
    units: 1,
  };
}

describe("V3 sport-enforcement guard", () => {
  it("submit_picks rejects a pick whose sport is not in preferred_sports", async () => {
    const ctx = makeCtx(["G1"]);
    const report = await submitPicks(ctx, { picks: [validTotalPick("G1")] });
    expect(report.accepted).toBe(0);
    expect(report.rejected.some((r) => /sport_not_selected/.test(r.reason))).toBe(true);
    expect(ctx.acceptedPicks.length).toBe(0);
  });

  it("submit_parlay rejects a ticket with a leg whose sport is not in preferred_sports", async () => {
    const ctx = makeCtx(["G1", "G2"]);
    const report = await submitParlay(ctx, {
      parlays: [
        {
          legs: [
            { game_id: "G1", bet_type: "total", selection: "Over 8", odds: "-110" },
            { game_id: "G2", bet_type: "total", selection: "Under 7", odds: "-110" },
          ],
          units: 1,
          confidence: 3,
          reasoning: "two soft totals",
        },
      ],
    });
    expect(report.accepted).toBe(0);
    expect(report.rejected.some((r) => /sport_not_selected/.test(r.reason))).toBe(true);
  });

  it("submit_picks accepts a pick when the sport IS selected (guard does not over-reject)", async () => {
    const ctx = makeCtx(["G1"], { sport: "nfl" });
    const report = await submitPicks(ctx, { picks: [validTotalPick("G1")] });
    expect(report.rejected.some((r) => /sport_not_selected/.test(r.reason))).toBe(false);
    expect(ctx.acceptedPicks.length).toBe(1);
  });
});

describe("V3 market-allowlist gate (plan D2)", () => {
  // NFL agent that only allows spreads — a total pick must be rejected.
  const spreadOnly = deriveSteeringProfile({
    preferred_sports: ["nfl"],
    personality_params: { allowed_markets: ["spread"], max_picks_per_day: 3 },
  });

  it("rejects a bet_type not in allowed_markets", async () => {
    const ctx = makeCtx(["G1"], { sport: "nfl", steering: spreadOnly });
    const report = await submitPicks(ctx, { picks: [validTotalPick("G1")] });
    expect(report.accepted).toBe(0);
    expect(report.rejected.some((r) => /market_not_allowed/.test(r.reason))).toBe(true);
  });

  it("allowedMarkets defaults to all markets when unset (back-compat)", () => {
    const s = deriveSteeringProfile({ preferred_sports: ["nfl"], personality_params: {} });
    expect(s.allowedMarkets).toEqual(expect.arrayContaining(["spread", "moneyline", "total"]));
  });

  it("strips 'prop' from allowedMarkets when the agent has no NFL", () => {
    const s = deriveSteeringProfile({
      preferred_sports: ["nba"],
      personality_params: { allowed_markets: ["spread", "total", "prop"] },
    });
    expect(s.allowedMarkets).not.toContain("prop");
    expect(s.propsEnabled).toBe(false);
  });

  it("enables props for an NFL agent with 'prop' allowed", () => {
    const s = deriveSteeringProfile({
      preferred_sports: ["nfl"],
      personality_params: { allowed_markets: ["spread", "prop"], props_emphasis: "emphasize" },
    });
    expect(s.propsEnabled).toBe(true);
  });
});
