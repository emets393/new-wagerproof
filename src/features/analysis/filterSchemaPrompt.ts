/**
 * Derives the Haiku extraction artifacts (system prompt + structured-output schema) from
 * `filterSchema.ts`, so the model's view of the filters can never drift from the manual UI or the
 * `applyFilterPatch` validator. Everything here is a PURE function of NFL_FILTER_DIMENSIONS.
 *
 * The generated artifacts are written to `supabase/functions/nl-filter-patch/schema.json` (see
 * genNlFilterSchema.ts) and a parity test (filterSchemaPrompt.test.ts) fails the build if the
 * committed artifact ever diverges from this source. The Edge Function reads that JSON — it never
 * hand-maintains a copy of the schema.
 */
import {
  NFL_FILTER_DIMENSIONS, NFL_BET_TYPES, NFL_FILTER_GROUPS, numRangeBounds,
  type FilterDimension, type NflBetType,
} from './filterSchema';

// A compact, model-facing description of one dimension.
export interface DimensionSpec {
  key: string;
  group: string;
  label: string;
  kind: FilterDimension['kind'];
  /** value shape hint the model must produce for a `set` op. */
  valueForm: string;
  aliases?: readonly string[];
  availableForBetTypes?: readonly string[];
  requires?: { key: string; value: string };
}

function valueForm(key: string, dim: FilterDimension): string {
  switch (dim.kind) {
    case 'numRange': {
      // show the widest bounds across bet types so the model sees the full envelope
      const bounds = dim.boundsByBetType
        ? Object.values(dim.boundsByBetType)
        : [numRangeBounds(dim, 'fg_spread' as NflBetType)];
      const lo = Math.min(...bounds.map((b) => b![0]));
      const hi = Math.max(...bounds.map((b) => b![1]));
      return `[min, max] numbers within [${lo}, ${hi}], step ${dim.step}`;
    }
    case 'pctRange': return '[min, max] percent numbers 0–100 (NOT a 0–1 fraction)';
    case 'scalarMax': return `a single number 0–${dim.max} (upper bound; ${dim.max} = no limit)`;
    case 'scalarMin': return `a single number 0–${dim.max} (lower bound; 0 = no limit)`;
    case 'enum': {
      const vals = dim.options.map(([v]) => v).filter((v) => v !== 'any');
      return dim.dynamic
        ? `an exact ${dim.label} name (validated against the loaded list); or "any" to clear`
        : `one of: ${vals.map((v) => `"${v}"`).join(', ')}; or "any" to clear`;
    }
    case 'tristate': return 'true, false, or null (null = clear)';
    case 'multiselect':
      return dim.optionSource === 'daysOfWeek' ? 'array of day names, any of: Sun, Mon, Tue, Wed, Thu, Fri, Sat'
        : dim.optionSource === 'nflDivisions' ? 'array of divisions, any of: "AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"'
        : 'array of NFL team abbreviations (e.g. ["KC","BUF"])';
    case 'mlOdds': return `American odds number (≥ +100 or ≤ −100), or "" to clear (${key})`;
  }
}

/** Build the ordered dimension catalog (single source: NFL_FILTER_DIMENSIONS). Deterministic. */
export function buildNflDimensionSpec(): DimensionSpec[] {
  const out: DimensionSpec[] = [];
  for (const group of NFL_FILTER_GROUPS) {
    for (const key of Object.keys(NFL_FILTER_DIMENSIONS) as Array<keyof typeof NFL_FILTER_DIMENSIONS>) {
      const dim = NFL_FILTER_DIMENSIONS[key];
      if (dim.group !== group) continue;
      out.push({
        key: key as string,
        group: dim.group,
        label: dim.label,
        kind: dim.kind,
        valueForm: valueForm(key as string, dim),
        aliases: dim.aliases,
        availableForBetTypes: dim.availability?.betTypes ? [...dim.availability.betTypes] : undefined,
        requires: dim.availability?.requires
          ? { key: String(dim.availability.requires.key), value: dim.availability.requires.equals }
          : undefined,
      });
    }
  }
  return out;
}

/** Structured-output JSON schema for the model's response (OpenAI-strict: every property is in
 *  `required` and every object sets `additionalProperties:false`). `value`/`items` are nullable so
 *  `clear`/scalar ops can omit them. The reducer is the real validator; this only forces a
 *  well-formed patch envelope. */
export const NFL_PATCH_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ops', 'couldnt_map', 'ambiguous'],
  properties: {
    ops: {
      type: 'array',
      description: 'Filter operations to apply. Only include dimensions the user is changing.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'dimension', 'value'],
        properties: {
          op: { type: 'string', enum: ['set', 'clear'] },
          dimension: { type: 'string' },
          value: {
            description: 'The value for a "set" op (typed: array for ranges/teams, string for enums, number for scalars, boolean for toggles); null for "clear".',
            anyOf: [
              { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' },
              { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'string' }] } },
            ],
          },
        },
      },
    },
    couldnt_map: {
      type: 'array', description: 'Requests that no supported dimension can express (name the nearest supported alternative).',
      items: { type: 'string' },
    },
    ambiguous: {
      type: 'array', description: 'Requests too vague to turn into a concrete filter (ask the user to clarify).',
      items: { type: 'string' },
    },
  },
} as const;

/** Assemble the (static, cache-friendly) system prompt from the dimension catalog. Deterministic. */
export function buildNflSystemPrompt(spec: DimensionSpec[] = buildNflDimensionSpec()): string {
  const lines: string[] = [];
  lines.push(
    'You convert a sports bettor\'s sentence into a PATCH of filter operations for the WagerProof NFL',
    'historical-trends filter. You do NOT query any database — you only emit filter operations that the',
    'app validates and applies. Work in the app\'s own filter vocabulary described below.',
    '',
    'OUTPUT: a JSON object { "ops": [...], "couldnt_map": [...], "ambiguous": [...] }.',
    'Each op is exactly { "op": "set" | "clear", "dimension": "<key>", "value": <typed value, or null for clear> }.',
    'The "value" MUST be the correct JSON type: an array [min,max] for ranges, an array of strings for teams,',
    'a plain string for an enum choice, a number for a scalar, or true/false for a toggle. Never wrap a value',
    'in extra quotes or characters.',
    '',
    'HARD RULES (violating these produces wrong results):',
    '1. Use ONLY the exact dimension keys listed below. Never invent a key or a value. If a request does',
    '   not fit a listed dimension, put a short description of it in "couldnt_map" (name the nearest',
    '   supported dimension). If a request is too vague to pin to a value, put it in "ambiguous".',
    '2. This is a PATCH on the CURRENT filter (given in the user message). Only emit ops for dimensions the',
    '   user is actually changing. Do not restate unchanged filters. Use op "clear" to remove a filter.',
    '3. Percents are 0–100 (e.g. 60 for "60%"), never 0–1. Ranges are [min, max] arrays.',
    '4. NEVER emit negative spread numbers. To express "favored by X–Y" set spreadSide="favorite" and',
    '   spreadSize=[X,Y]; for "getting X–Y" set spreadSide="underdog" and spreadSize=[X,Y]. The app handles',
    '   the sign. spreadSide/spreadSize only exist for spread & moneyline markets.',
    '5. To change the market/bet type, use dimension "betType" with one of:',
    `   ${NFL_BET_TYPES.map((b) => `"${b}"`).join(', ')}.`,
    '6. Some dimensions require another first (see "requires"): e.g. to set "weeks" also set',
    '   seasonType="regular"; to set "playoffRound" also set seasonType="postseason". Emit BOTH ops, the',
    '   prerequisite first.',
    '7. Teams/opponents are arrays of NFL abbreviations set with ONE "set" op holding the FULL desired list.',
    '   To ADD a team, read the current list from CURRENT FILTER and include the existing teams plus the new',
    '   one. Resolve names to abbreviations (Chiefs → KC, Bills → BUF, 49ers → SF).',
    '8. When unsure whether you understood, prefer "ambiguous"/"couldnt_map" over guessing. A wrong filter',
    '   erodes user trust more than an honest "I couldn\'t map that."',
    '9. NEVER set a season-to-date % dimension (atsWinPct, winPct, overPct, prevWinPct, oppWinPct,',
    '   oppOverPct, oppPrevWinPct) unless the user EXPLICITLY names a rate, percentage, or fraction of',
    '   games — e.g. "ATS win % over 55", "covering 60% this season", "has covered more than half their',
    '   games", "winning over .500", "gone under in more than half their games". Streak / recent-form',
    '   language alone ("has not covered in two straight", "on a 3-game win streak", "cold ATS") maps',
    '   ONLY to the matching *Streak (or last-game) dimension — NEVER also set the companion % range.',
    '10. BETTING LINGO — keep these vocab tracks separate (do not cross-wire):',
    '   • Win/loss record → winPct / oppWinPct / above500 / winStreak / lossStreak / lastResult.',
    '   • Against the spread (cover) → atsWinPct / atsWinStreak / lastAts / h2hLastAts.',
    '   • Over/under (game total) → overPct / oppOverPct / overStreak / underStreak / lastTotal / h2hLastOver.',
    '   "Gone under / hit the under / unders" is ALWAYS the total track — NEVER winPct or oppWinPct.',
    '   "Covered / failed to cover / ATS" is ALWAYS the cover track — NEVER overPct.',
    '   "Winning / W-L / .500" is ALWAYS the win track — NEVER ATS% or Over%.',
    '11. "More than half their games went under" / "under in over half their games" → set overPct to',
    '   [0, 50] (under-heavy = over-rate at most 50%). Mirror with oppOverPct [0, 50] when they say the',
    '   opponent / both teams share that season O/U tendency. Do the inverse for "more than half overs"',
    '   → overPct [50, 100] (+ oppOverPct when both).',
    '12. "Coming off an under/over" / "last game went under" → set the SUBJECT lastTotal. The opponent past',
    '   game is ALSO filterable via the opponent-last-game mirror: oppLastResult, oppLastAts, oppLastTotal,',
    '   oppLastRole, oppLastMargin, oppLastOt. So "both teams came off an under" → lastTotal "under" AND',
    '   oppLastTotal "under". Never route an opponent-last-game ask to couldnt_map — a dimension exists.',
    '13. "A team and the opponent" / "both teams" means apply the TEAM filter to the subject and the matching',
    '   opponent filter when one exists (overPct↔oppOverPct, winPct↔oppWinPct, lastTotal↔oppLastTotal,',
    '   lastResult↔oppLastResult, lastAts↔oppLastAts). Prefer mirroring over ignoring the opponent half.',
    '14. MARGIN — lastMargin / oppLastMargin are the SIGNED point margin of the previous game: POSITIVE =',
    '   won by that many, NEGATIVE = lost by that many. "won by 10 or more" -> [10, 60]; "lost by 7+" ->',
    '   [-60, -7]; "won by exactly 3" -> [3, 3]; "within a field goal" -> [-3, 3]; "blowout win (21+)" ->',
    '   [21, 60]; "blowout loss" -> [-60, -21]. Use it for any margin-of-victory/loss phrasing.',
    '',
    'EXAMPLES:',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: home favorites laying 3 to 7 in the back half of the season',
    'OUTPUT: {"ops":[{"op":"set","dimension":"seasonType","value":"regular"},{"op":"set","dimension":"weeks","value":[10,18]},{"op":"set","dimension":"side","value":"home"},{"op":"set","dimension":"spreadSide","value":"favorite"},{"op":"set","dimension":"spreadSize","value":[3,7]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread","teams":["KC"]}',
    'REQUEST: add the Bills and switch to the moneyline for road dogs',
    'OUTPUT: {"ops":[{"op":"set","dimension":"teams","value":["KC","BUF"]},{"op":"set","dimension":"betType","value":"fg_ml"},{"op":"set","dimension":"side","value":"away"},{"op":"set","dimension":"spreadSide","value":"underdog"}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: teams on a 3+ game win streak whose QB had a great game',
    'OUTPUT: {"ops":[{"op":"set","dimension":"winStreak","value":[3,16]}],"couldnt_map":["QB game performance — nearest supported: Last game result/role"],"ambiguous":["a great game"]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: away team has not covered in two straight games but is now favored',
    'OUTPUT: {"ops":[{"op":"set","dimension":"side","value":"away"},{"op":"set","dimension":"spreadSide","value":"favorite"},{"op":"set","dimension":"atsWinStreak","value":[0,0]}],"couldnt_map":["ATS cover-loss streak of exactly 2 — nearest supported: atsWinStreak (cover/win streak only; 0 = not currently on a cover streak)"],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_spread"}',
    'REQUEST: teams covering over 55% ATS this season',
    'OUTPUT: {"ops":[{"op":"set","dimension":"atsWinPct","value":[55,100]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'CURRENT FILTER: {"betType":"fg_total"}',
    'REQUEST: a team and the opponent are coming off games that went under and both teams have gone under in more than half their games this season',
    'OUTPUT: {"ops":[{"op":"set","dimension":"lastTotal","value":"under"},{"op":"set","dimension":"oppLastTotal","value":"under"},{"op":"set","dimension":"overPct","value":[0,50]},{"op":"set","dimension":"oppOverPct","value":[0,50]}],"couldnt_map":[],"ambiguous":[]}',
    '',
    'DIMENSIONS:',
  );
  let currentGroup = '';
  for (const d of spec) {
    if (d.group !== currentGroup) { currentGroup = d.group; lines.push('', `[${d.group}]`); }
    const parts = [`• ${d.key} — ${d.label}: ${d.valueForm}`];
    if (d.availableForBetTypes) parts.push(`(only for markets: ${d.availableForBetTypes.join(', ')})`);
    if (d.requires) parts.push(`(requires ${d.requires.key}="${d.requires.value}")`);
    if (d.aliases?.length) parts.push(`— phrasing: ${d.aliases.join(', ')}`);
    lines.push(parts.join(' '));
  }
  lines.push('', 'Also available: dimension "betType" (the market spine) — set/clear only.');
  return lines.join('\n');
}

/** The full artifact written to the Edge Function (systemPrompt is static ⇒ prompt-cacheable). */
export function buildNlFilterArtifact() {
  const dimensions = buildNflDimensionSpec();
  return {
    version: 1,
    sport: 'nfl',
    systemPrompt: buildNflSystemPrompt(dimensions),
    outputSchema: NFL_PATCH_OUTPUT_SCHEMA,
  };
}
