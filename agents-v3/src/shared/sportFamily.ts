// =============================================================================
// Shared sport-family helpers (backend / edge functions)
// Mirrors the frontend SPORT_FAMILIES logic (src/types/agent.ts) so generation
// and prompt routing agree on how an agent's preferred_sports map to a family.
// See memory: agent-sport-family-rule — agents are locked to ONE family going
// forward; legacy mixed agents are walled off football at generation.
// =============================================================================

export const FOOTBALL_SPORTS = ['nfl', 'cfb'] as const;

/** True when EVERY preferred sport is football (nfl/cfb) — i.e. a football-only
 *  agent eligible for the v1_nfl prompt + NFL/CFB game generation. */
export function isFootballOnly(preferredSports: string[]): boolean {
  return preferredSports.length > 0 &&
    preferredSports.every((s) => (FOOTBALL_SPORTS as readonly string[]).includes(s));
}

/** The sports an agent should actually have games generated for. Football-only
 *  agents keep nfl/cfb; everyone else loses nfl/cfb (the football wall) but
 *  keeps their other sports. Legacy mixed agents (e.g. [nba,nfl]) → [nba]. */
export function computeEffectiveSports(preferredSports: string[]): string[] {
  if (isFootballOnly(preferredSports)) return [...preferredSports];
  return preferredSports.filter((s) => !(FOOTBALL_SPORTS as readonly string[]).includes(s));
}

/** Which agent_system_prompts.sport row to load, or null for the default.
 *  Football-only → 'nfl' (v1_nfl serves BOTH nfl + cfb). Single non-football
 *  sport → that sport. Anything multi/mixed → null (default prompt). */
export function resolvePromptSport(preferredSports: string[]): string | null {
  if (isFootballOnly(preferredSports)) return 'nfl';
  if (preferredSports.length === 1) return preferredSports[0];
  return null;
}

/** True when preferred_sports span MORE THAN ONE family (football/basketball/
 *  baseball). Cross-family agents are forced onto the V3 engine — V2 would route
 *  them to the default prompt and wall off football, silently dropping games.
 *  Mirrors public.agent_family_count() in SQL + SPORT_FAMILIES in
 *  src/types/agent.ts — keep all three in lockstep.
 *  See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md. */
export function isCrossFamily(preferredSports: string[]): boolean {
  const fam = (s: string): string =>
    (FOOTBALL_SPORTS as readonly string[]).includes(s) ? 'football'
      : (s === 'nba' || s === 'ncaab') ? 'basketball'
      : 'baseball';
  return new Set(preferredSports.map(fam)).size > 1;
}
