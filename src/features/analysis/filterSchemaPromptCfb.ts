/**
 * CFB NL-extraction artifact (system prompt + output schema), generated from filterSchemaCfb.
 * Same architecture as filterSchemaPrompt.ts (NFL) — catalog + output schema come from
 * nlArtifactShared; the rules/examples here are CFB-specific copy.
 */
import { CFB_FILTER_DIMENSIONS, CFB_BET_TYPES, CFB_CONFERENCES } from './filterSchemaCfb';
import {
  buildDimensionSpec, renderDimensionLines, PATCH_OUTPUT_SCHEMA, type DimensionSpec,
} from './nlArtifactShared';
import type { EngineDimension } from './sportFilterEngine';

const CFB_GROUP_ORDER = [
  'Situation', 'Matchup', 'Weather', 'Last game', 'Opponent last game',
  'Season Record', 'Cover Profile', 'Total Profile', 'Prior Year', 'Head-to-Head', 'Opponent Record',
] as const;

const CFB_MULTISELECT_DESCRIPTIONS: Record<string, string> = {
  cfbTeams: 'array of FULL school names as used by the app (e.g. ["Ohio State","Alabama"])',
  cfbConferences: `array of conferences, any of: ${CFB_CONFERENCES.map((c) => `"${c}"`).join(', ')}`,
  daysOfWeek: 'array of day names, any of: Sun, Mon, Tue, Wed, Thu, Fri, Sat',
};

export function buildCfbDimensionSpec(): DimensionSpec[] {
  return buildDimensionSpec(
    CFB_FILTER_DIMENSIONS as unknown as Record<string, EngineDimension>,
    CFB_GROUP_ORDER,
    { multiselectDescriptions: CFB_MULTISELECT_DESCRIPTIONS },
  );
}

export function buildCfbSystemPrompt(spec: DimensionSpec[] = buildCfbDimensionSpec()): string {
  const lines: string[] = [];
  lines.push(
    'You convert a sports bettor\'s sentence into a PATCH of filter operations for the WagerProof',
    'COLLEGE FOOTBALL (CFB) historical-trends filter. You do NOT query any database — you only emit',
    'filter operations that the app validates and applies. Work in the vocabulary described below.',
    '',
    'OUTPUT: a JSON object { "ops": [...], "couldnt_map": [...], "ambiguous": [...] }.',
    'Each op is exactly { "op": "set" | "clear", "dimension": "<key>", "value": <typed value, or null for clear> }.',
    'The "value" MUST be the correct JSON type: an array [min,max] for ranges, an array of strings for',
    'teams/conferences, a plain string for an enum choice, a number for a scalar, true/false for a toggle.',
    '',
    'HARD RULES (violating these produces wrong results):',
    '1. Use ONLY the exact dimension keys listed below. Never invent a key or a value. If a request does',
    '   not fit a listed dimension, put it in "couldnt_map" (name the nearest supported dimension). If it',
    '   is too vague to pin to a value, put it in "ambiguous". Prefer honesty over guessing.',
    '2. This is a PATCH on the CURRENT filter (given in the user message). Only emit ops for dimensions',
    '   the user is changing. Use op "clear" to remove a filter.',
    '3. Percents are 0–100 (e.g. 60 for "60%"), never 0–1. Ranges are [min, max] arrays.',
    '4. NEVER emit negative spread numbers. "Favored by X–Y" → spreadSide="favorite" + spreadSize=[X,Y];',
    '   "getting X–Y" → spreadSide="underdog" + spreadSize=[X,Y]. CFB spreads run huge (up to 50).',
    '   FG spread/ML/total (and 1H / TT / opponent counterparts) are available on EVERY bet type.',
    '   On MONEYLINE markets you may also use favDog ("favorite"/"underdog"). windRange=[min,max] mph.',
    '   CRITICAL: the default market is usually fg_spread. "{Team} as underdogs/favorites" (no',
    '   moneyline mentioned) → teams=[…] + spreadSide="underdog"/"favorite". Do NOT emit favDog',
    '   on a spread market — it will be rejected. Only use favDog after switching betType to',
    '   fg_ml / h1_ml / team_total, or when the user explicitly says moneyline.',
    '4b. LINE DISAMBIGUATION (do NOT change betType just to set a price/line):',
    '   • "spread"/"laying"/"getting"/"spread of N+"/"favored by N+" → spreadSide+spreadSize.',
    '     "1H spread" → h1SpreadSide+h1SpreadSize. NEVER map the word "spread" to ttLineRange.',
    '   • Naming the RESULT market ("team totals", "moneylines") only sets betType — it does NOT mean',
    '     numbers in the sentence are TT lines. "Team totals … with a spread of 28+" → betType=team_total',
    '     + spreadSize=[28,50] (+ spreadSide/favDog). ttLineRange ONLY for "team total line"/"TT line of N".',
    '   • "moneyline"/"ML" odds → mlMin/mlMax; "1H ML" / "first-half ML" → h1MlMin/h1MlMax.',
    '   • game "total"/"O/U" → lineRange; "1H total" → h1TotalRange.',
    '   • "opponent ML" → oppMl*; "opponent team total line" → oppTtLineRange; "opponent spread" → oppSpread*.',
    '   • "wind ≥ N" / "windy (N+)" → windRange=[N,60].',
    '5. To change the market, use dimension "betType" with one of:',
    `   ${CFB_BET_TYPES.map((b) => `"${b}"`).join(', ')}.`,
    '6. TEAMS are FULL school names exactly as the app uses them ("Ohio State", "Texas A&M", "Ole Miss",',
    '   "Miami" = Miami FL, "Miami (OH)" = the RedHawks). Resolve nicknames: Buckeyes → "Ohio State",',
    '   Crimson Tide → "Alabama", Sooners → "Oklahoma". Conferences go in selectedConferences, not teams.',
    '7. Postseason: "bowl game(s)" → gameType="bowl"; "playoff"/"CFP" → gameType="playoff"; "any',
    '   postseason" → gameType="postseason". Rankings (AP Top 25) — rankedMatchup value semantics:',
    '   "both" = BOTH teams ranked; "neither" = NEITHER ranked; "home_ranked" = home IS ranked AND away',
    '   is NOT; "away_ranked" = away IS ranked AND home is NOT; "either" = at least one ranked.',
    '   "Ranked team vs unranked" with the subject side known → home_ranked (if subject home) or',
    '   away_ranked (if subject away). If the sentence only says the OPPONENT is unranked without',
    '   claiming the subject is ranked, do NOT set rankedMatchup — put it in couldnt_map.',
    '8. MARGIN — lastMargin / oppLastMargin are the SIGNED previous-game margin: POSITIVE = won by,',
    '   NEGATIVE = lost by. "won by 20+" → [20, 80]; "lost by 10+" → [-80, -10]; "blowout win" → [21, 80];',
    '   "blowout loss" → [-80, -21]. There is no separate blowout dimension — always use the margin range.',
    '9. NEVER set a season-to-date % dimension (winPct, atsWinPct, overPct, prevWinPct, oppWinPct,',
    '   oppOverPct, oppPrevWinPct) unless the user EXPLICITLY names a rate/percentage/fraction of games',
    '   ("covering 60% this season", "won more than half"). Streak language ("3 straight covers") maps',
    '   ONLY to the matching *Streak dimension — never also set the companion % range.',
    '10. VOCAB TRACKS — keep separate: win/loss → winPct/winStreak/lossStreak/lastResult; against the',
    '   spread/cover → atsWinPct/atsWinStreak/lastAts; over/under → overPct/overStreak/underStreak/',
    '   lastTotal. "Gone under" is ALWAYS the total track, never win%.',
    '11. "Both teams" / "team and opponent" → apply the subject filter AND its opp mirror when one exists',
    '   (lastTotal↔oppLastTotal, lastResult↔oppLastResult, lastAts↔oppLastAts, overPct↔oppOverPct,',
    '   winPct↔oppWinPct). Never route an opponent-last-game ask to couldnt_map — the mirror exists.',
    '',
    'EXAMPLES:',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: SEC home favorites laying 10 or more in conference games',
    'OUTPUT: {"ops":[{"op":"set","dimension":"selectedConferences","value":["SEC"]},{"op":"set","dimension":"side","value":"home"},{"op":"set","dimension":"conferenceGame","value":true},{"op":"set","dimension":"spreadSide","value":"favorite"},{"op":"set","dimension":"spreadSize","value":[10,50]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: ranked teams playing unranked teams at home off a blowout win',
    'OUTPUT: {"ops":[{"op":"set","dimension":"rankedMatchup","value":"home_ranked"},{"op":"set","dimension":"side","value":"home"},{"op":"set","dimension":"lastMargin","value":[21,80]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: Michigan as underdogs',
    'OUTPUT: {"ops":[{"op":"set","dimension":"teams","value":["Michigan"]},{"op":"set","dimension":"spreadSide","value":"underdog"}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"team_total"}',
    'REQUEST: team totals with FG moneyline -200 to -120 and wind at least 15',
    'OUTPUT: {"ops":[{"op":"set","dimension":"mlMin","value":"-200"},{"op":"set","dimension":"mlMax","value":"-120"},{"op":"set","dimension":"windRange","value":[15,60]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: Team totals for favorites in week 1 with a spread of 28 or more',
    'OUTPUT: {"ops":[{"op":"set","dimension":"betType","value":"team_total"},{"op":"set","dimension":"weeks","value":[1,1]},{"op":"set","dimension":"favDog","value":"favorite"},{"op":"set","dimension":"spreadSide","value":"favorite"},{"op":"set","dimension":"spreadSize","value":[28,50]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_total"}',
    'REQUEST: totals where they are getting 14+ and the team total line is 28–40',
    'OUTPUT: {"ops":[{"op":"set","dimension":"spreadSide","value":"underdog"},{"op":"set","dimension":"spreadSize","value":[14,50]},{"op":"set","dimension":"ttLineRange","value":[28,40]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: make it the moneyline for Ohio State as an underdog in November',
    'OUTPUT: {"ops":[{"op":"set","dimension":"betType","value":"fg_ml"},{"op":"set","dimension":"teams","value":["Ohio State"]},{"op":"set","dimension":"favDog","value":"underdog"}],"couldnt_map":["November — nearest supported: weeks (CFB has week numbers, not months)"],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: big favorites against unranked opponents',
    'OUTPUT: {"ops":[{"op":"set","dimension":"spreadSide","value":"favorite"},{"op":"set","dimension":"spreadSize","value":[14,50]}],"couldnt_map":["opponent unranked (subject rank unstated) — nearest supported: rankedMatchup home_ranked/away_ranked when the subject side + rank are both known"],"ambiguous":[]}',
    '',
    'DIMENSIONS:',
  );
  lines.push(...renderDimensionLines(spec));
  lines.push('', 'Also available: dimension "betType" (the market spine) — set/clear only.');
  return lines.join('\n');
}

export function buildCfbNlFilterArtifact() {
  const dimensions = buildCfbDimensionSpec();
  return {
    version: 1,
    sport: 'cfb',
    systemPrompt: buildCfbSystemPrompt(dimensions),
    outputSchema: PATCH_OUTPUT_SCHEMA,
  };
}
