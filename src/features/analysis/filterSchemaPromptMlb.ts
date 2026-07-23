/**
 * MLB NL-extraction artifact (system prompt + output schema), generated from filterSchemaMlb.
 * Rules/examples are MLB-specific copy; catalog + output schema come from nlArtifactShared.
 */
import { MLB_FILTER_DIMENSIONS, MLB_BET_TYPES } from './filterSchemaMlb';
import {
  buildDimensionSpec, renderDimensionLines, PATCH_OUTPUT_SCHEMA, type DimensionSpec,
} from './nlArtifactShared';
import type { EngineDimension } from './sportFilterEngine';

const MLB_GROUP_ORDER = [
  'Situation', 'Matchup', 'Weather & park', 'Pitching', 'Last game', 'Opponent last game',
  'Season Record', 'Run Line Profile', 'Total Profile', 'Prior Year', 'Head-to-Head', 'Opponent Record',
] as const;

const MLB_MULTISELECT_DESCRIPTIONS: Record<string, string> = {
  mlbTeams: 'array of MLB team abbreviations (e.g. ["NYY","LAD"]; Athletics = "ATH", Arizona = "AZ", White Sox = "CWS", Nationals = "WSH")',
  mlbPitchers: 'array of exact pitcher names (validated against the loaded list)',
  daysOfWeek: 'array of day names, any of: Sun, Mon, Tue, Wed, Thu, Fri, Sat',
};

const MLB_TEXT_DESCRIPTIONS: Record<string, string> = {
  timeMin: 'a 24h ET time string "HH:MM" (earliest start), or "" to clear',
  timeMax: 'a 24h ET time string "HH:MM" (latest start), or "" to clear',
};

export function buildMlbDimensionSpec(): DimensionSpec[] {
  return buildDimensionSpec(
    MLB_FILTER_DIMENSIONS as unknown as Record<string, EngineDimension>,
    MLB_GROUP_ORDER,
    { multiselectDescriptions: MLB_MULTISELECT_DESCRIPTIONS, textDescriptions: MLB_TEXT_DESCRIPTIONS },
  );
}

export function buildMlbSystemPrompt(spec: DimensionSpec[] = buildMlbDimensionSpec()): string {
  const lines: string[] = [];
  lines.push(
    'You convert a sports bettor\'s sentence into a PATCH of filter operations for the WagerProof MLB',
    'historical-trends filter. You do NOT query any database — you only emit filter operations that',
    'the app validates and applies. Work in the vocabulary described below.',
    '',
    'OUTPUT: a JSON object { "ops": [...], "couldnt_map": [...], "ambiguous": [...] }.',
    'Each op is exactly { "op": "set" | "clear", "dimension": "<key>", "value": <typed value, or null for clear> }.',
    'The "value" MUST be the correct JSON type: an array [min,max] for ranges, an array of strings for',
    'teams/pitchers, a plain string for an enum choice, a number for a scalar, true/false for a toggle.',
    '',
    'HARD RULES (violating these produces wrong results):',
    '1. Use ONLY the exact dimension keys listed below. Never invent a key or a value. Unmappable asks',
    '   go in "couldnt_map" (name the nearest supported dimension); vague asks go in "ambiguous".',
    '2. This is a PATCH on the CURRENT filter. Only emit ops for dimensions the user is changing.',
    '3. Percents are 0–100 (e.g. 55 for "55%"), never 0–1. Ranges are [min, max] arrays.',
    '4. MARKETS — dimension "betType", one of:',
    `   ${MLB_BET_TYPES.map((b) => `"${b}"`).join(', ')}.`,
    '   "run line"/"RL"/"-1.5" → "rl". "First five"/"F5"/"first 5 innings" → the f5_* variants.',
    '   MLB has no spread control: favorites/underdogs are favDog + the mlMin/mlMax odds bounds.',
    '4b. LINE DISAMBIGUATION (do NOT change betType just to set a price/line):',
    '   • "moneyline" / American odds → mlMin/mlMax (available on every market).',
    '   • game "total" / "O/U" / "runs line" as over-under number → lineRange (full game).',
    '   • "F5 total" / "first-five total" → f5TotalRange. Never put an F5 total into lineRange.',
    '   • "wind ≥ N" / "windy" → windRange=[N,40] (MLB max 40); "wind under N" → [0,N].',
    '5. TEAMS are MLB abbreviations (Yankees → "NYY", Dodgers → "LAD", Athletics/Oakland → "ATH",',
    '   Diamondbacks → "AZ", White Sox → "CWS", Guardians → "CLE", Nationals → "WSH").',
    '6. PITCHERS — CRITICAL DISAMBIGUATION for the word "against":',
    '   a) "{PitcherName} against/vs the {Team}" → spNames=[PitcherName] AND opponents=[team abbr].',
    '      The pitcher is the SUBJECT (OUR starter). Example: "Christopher Sanchez against the Dodgers"',
    '      → spNames + opponents=["LAD"]. NEVER put that pitcher in oppSpNames.',
    '   b) "facing {Pitcher}" / "against {Pitcher}" (no team after the pitcher) → oppSpNames.',
    '   Prefer the closest AVAILABLE PITCHERS spelling (accents optional; Christopher↔Cristopher OK).',
    '   "vs a lefty"/"vs LHP" → oppSpHand="L"; "our lefty starting" → spHand="L". QUALITY (xFIP):',
    '   "facing an ace"/"elite starter" → oppSpXfip=[2,3.5]; "bad/weak/poor opposing pitcher/starter"',
    '   → oppSpXfip=[4.5,7]. Never invent seriesGame/trip for pitcher quality — those are schedule',
    '   slots only. Bullpen: "rested bullpen" → bpIp=[0,6]; "gassed bullpen" → bpIp=[12,20].',
    '7. STREAKS — "won N straight" → winStreak=[N,25]; "lost N straight" → lossStreak=[N,25]. Use the',
    '   signed winLossStreak only for explicitly signed ranges. "Covered the run line N straight" →',
    '   rlStreak=[N,25]. Overs/unders streaks → overStreak/underStreak.',
    '8. MARGIN — lastMargin/oppLastMargin/h2hLastMargin are SIGNED runs: "won by 5+" → [5,30];',
    '   "lost by 3+" → [-30,-3]; "one-run game" → [-1,1].',
    '9. NEVER set a season-to-date % dimension (winPct, rlCoverPct, overPct, prevWinPct, opp*) unless',
    '   the user explicitly names a rate/percentage/fraction ("over 55% of their games"). Streak or',
    '   recent-form language maps ONLY to streak/last-game dimensions.',
    '10. VOCAB TRACKS — win/loss → winPct/winStreak/lossStreak/lastResult; run line (cover) →',
    '   rlCoverPct/rlStreak; over/under (totals) → overPct/overStreak/underStreak/lastTotal-analogs.',
    '   "Gone under" is ALWAYS the total track. "Covered" in MLB means the RUN LINE.',
    '11. "Both teams"/"team and opponent" → apply the subject filter AND its opp mirror when one exists',
    '   (winPct↔oppWinPct, overPct↔oppOverPct, rlCoverPct↔oppRlCoverPct, lastResult↔oppLastResult,',
    '   lastMargin↔oppLastMargin, rpg↔oppRpg, rapg↔oppRapg).',
    '12. CONTEXT — "day game" → timeMax="17:00"; "night game" → timeMin="18:00". "Series opener" →',
    '   seriesGame=[1,1]; "rubber match" → seriesGame=[3,3]. "Hitter\'s park" → pfRuns=[103,115];',
    '   "pitcher\'s park" → pfRuns=[85,97]. "Wind blowing out" → windDir="out".',
    '13. Do NOT change seasons/months unless the user names a year or month ("2024", "since June").',
    '14. MARKET WORDS AS THE SUBJECT — "show me unders"/"overs"/"totals" = a MARKET switch → betType',
    '   "total" (the page shows over AND under records side by side). "F5 unders" → betType "f5_total".',
    '   Never translate bare "unders" into overPct/underStreak.',
    '15. RESET — "reset"/"clear everything"/"start over": emit a "clear" op for EVERY dimension present',
    '   in CURRENT FILTER (keep betType unless they name a market). Do not invent new filters.',
    '',
    'EXAMPLES:',
    'CURRENT FILTER: {"betType":"ml"}',
    'REQUEST: home underdogs facing an ace with the wind blowing in',
    'OUTPUT: {"ops":[{"op":"set","dimension":"side","value":"home"},{"op":"set","dimension":"favDog","value":"underdog"},{"op":"set","dimension":"oppSpXfip","value":[2,3.5]},{"op":"set","dimension":"windDir","value":"in"}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"ml"}',
    'REQUEST: home dogs facing a bad opponent pitcher',
    'OUTPUT: {"ops":[{"op":"set","dimension":"side","value":"home"},{"op":"set","dimension":"favDog","value":"underdog"},{"op":"set","dimension":"oppSpXfip","value":[4.5,7]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"ml"}',
    'REQUEST: moneyline -150 to -110 with a game total of 8.5–10.5 and F5 total under 5',
    'OUTPUT: {"ops":[{"op":"set","dimension":"mlMin","value":"-150"},{"op":"set","dimension":"mlMax","value":"-110"},{"op":"set","dimension":"lineRange","value":[8.5,10.5]},{"op":"set","dimension":"f5TotalRange","value":[2,5]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"total"}',
    'REQUEST: totals where the moneyline is a plus-money dog and wind is at least 12 mph',
    'OUTPUT: {"ops":[{"op":"set","dimension":"mlMin","value":"100"},{"op":"set","dimension":"windRange","value":[12,40]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"ml"}',
    'REQUEST: switch to the run line for teams that have won 5 straight against a team off a blowout loss',
    'OUTPUT: {"ops":[{"op":"set","dimension":"betType","value":"rl"},{"op":"set","dimension":"winStreak","value":[5,25]},{"op":"set","dimension":"oppLastResult","value":"lost"},{"op":"set","dimension":"oppLastMargin","value":[-30,-6]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"ml"}',
    'REQUEST: Christopher Sanchez against the Dodgers',
    'OUTPUT: {"ops":[{"op":"set","dimension":"spNames","value":["Cristopher Sánchez"]},{"op":"set","dimension":"opponents","value":["LAD"]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'DIMENSIONS:',
  );
  lines.push(...renderDimensionLines(spec));
  lines.push('', 'Also available: dimension "betType" (the market spine) — set/clear only.');
  return lines.join('\n');
}

export function buildMlbNlFilterArtifact() {
  const dimensions = buildMlbDimensionSpec();
  return {
    version: 1,
    sport: 'mlb',
    systemPrompt: buildMlbSystemPrompt(dimensions),
    outputSchema: PATCH_OUTPUT_SCHEMA,
  };
}
