/**
 * Deterministic fix for MLB NL chat: "{Pitcher} against/vs [the] {Team}" means
 * OUR starter (spNames) vs that opponent team — not oppSpNames.
 *
 * Models routinely misread "against" as "facing that pitcher". Prompt examples help
 * after redeploy; this rewrite makes the correct mapping reliable on the client.
 */
import type { FilterPatch } from './sportFilterEngine';
import { MLB_TEAM_ABBRS, MLB_TEAM_ALIASES } from './filterSchemaMlb';
import { MLB_FALLBACK_BY_NAME } from '@/utils/mlbTeamLogos';
import { filterPitchers, foldSearchText } from '@/utils/mlbPitcherSearch';
import { toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';

const TWO_TOKEN_MASCOTS = new Set(['red sox', 'white sox', 'blue jays']);

export function resolveMlbTeamPhrase(raw: string): string | null {
  const t = raw.trim().replace(/[.,!?]+$/g, '');
  if (!t) return null;
  const folded = foldSearchText(t);
  const upper = t.toUpperCase();
  const mapped = toF5SplitTeamAbbr(upper);
  if ((MLB_TEAM_ABBRS as readonly string[]).includes(mapped)) return mapped;
  const alias = MLB_TEAM_ALIASES[folded] ?? MLB_TEAM_ALIASES[t.toLowerCase()];
  if (alias) return toF5SplitTeamAbbr(alias);

  const byFull = MLB_FALLBACK_BY_NAME[folded];
  if (byFull) return toF5SplitTeamAbbr(byFull.team);

  // Nickname / mascot: "Dodgers", "Yankees", "Red Sox"
  const hits: string[] = [];
  for (const [full, row] of Object.entries(MLB_FALLBACK_BY_NAME)) {
    const tokens = full.split(' ').filter(Boolean);
    const mascot = TWO_TOKEN_MASCOTS.has(tokens.slice(-2).join(' '))
      ? tokens.slice(-2).join(' ')
      : tokens[tokens.length - 1];
    if (mascot === folded || full.endsWith(` ${folded}`)) {
      hits.push(toF5SplitTeamAbbr(row.team));
    }
  }
  const uniq = [...new Set(hits)];
  return uniq.length === 1 ? uniq[0] : null;
}

/** "{Pitcher} against/vs [the] {Team}" — pitcher as subject, team as object. */
export function parsePitcherAgainstTeam(sentence: string): { pitcherPhrase: string; teamPhrase: string } | null {
  const s = sentence.trim().replace(/^["'“]+|["'”]+$/g, '');
  const m = s.match(/^(.+?)\s+(?:against|vs\.?|versus)\s+(?:the\s+)?(.+)$/i);
  if (!m) return null;
  const pitcherPhrase = m[1].trim();
  const teamPhrase = m[2].trim();
  if (!pitcherPhrase || !teamPhrase) return null;

  // Reject long situational clauses ("teams that have won 5 straight against …").
  const words = pitcherPhrase.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return null;
  // Reject side/fav framing: "home dogs against the Dodgers"
  if (/^(home|away|road|favorite|underdog|dogs?|chalk)\b/i.test(pitcherPhrase)) return null;
  // Reject "facing X" inverted forms — those belong on oppSp.
  if (/^(facing|vs|versus)\b/i.test(s)) return null;

  return { pitcherPhrase, teamPhrase };
}

function resolvePitcherPhrase(phrase: string, catalogNames: readonly string[]): string | null {
  if (!catalogNames.length) return null;
  const rows = catalogNames.map((name) => ({ name }));
  const hits = filterPitchers(rows, phrase, 5);
  if (!hits.length) return null;
  const folded = foldSearchText(phrase);
  const exact = hits.find((h) => foldSearchText(h.name) === folded);
  if (exact) return exact.name;
  // Unique clear winner from fuzzy ranking
  if (hits.length === 1) return hits[0].name;
  // If top hit is a clear typo match and second is unrelated last-name only, prefer top
  const top = hits[0].name;
  const topFold = foldSearchText(top);
  const phraseTokens = folded.split(/[^a-z0-9]+/).filter(Boolean);
  const topTokens = topFold.split(/[^a-z0-9]+/).filter(Boolean);
  if (phraseTokens.length >= 2 && topTokens.length >= 2) {
    const lastOk = phraseTokens[phraseTokens.length - 1] === topTokens[topTokens.length - 1]
      || foldSearchText(phraseTokens[phraseTokens.length - 1]) === foldSearchText(topTokens[topTokens.length - 1]);
    if (lastOk) return top;
  }
  return null;
}

type PatchOp = FilterPatch['ops'][number];

/**
 * Rewrite model ops when the sentence is clearly "{Pitcher} against {Team}".
 * Forces spNames + opponents; strips mistaken oppSpNames for that pitcher.
 */
export function rewriteMlbPitcherAgainstTeamOps(
  sentence: string,
  ops: FilterPatch['ops'],
  pitcherCatalogNames: readonly string[],
): FilterPatch['ops'] {
  const parsed = parsePitcherAgainstTeam(sentence);
  if (!parsed) return ops;

  const team = resolveMlbTeamPhrase(parsed.teamPhrase);
  const pitcher = resolvePitcherPhrase(parsed.pitcherPhrase, pitcherCatalogNames);
  if (!team || !pitcher) return ops;

  const pitcherFold = foldSearchText(pitcher);
  const out: PatchOp[] = [];
  let sawSp = false;
  let sawOppTeam = false;

  for (const op of ops) {
    if (op.op === 'set' && op.dimension === 'oppSpNames') {
      const vals = Array.isArray(op.value) ? op.value.map(String) : [];
      const kept = vals.filter((v) => foldSearchText(v) !== pitcherFold
        && foldSearchText(v) !== foldSearchText(parsed.pitcherPhrase));
      // Drop the mistaken "opp SP = named pitcher" op entirely when it only named them.
      if (!kept.length) continue;
      out.push({ ...op, value: kept });
      continue;
    }
    if (op.op === 'set' && op.dimension === 'spNames') {
      sawSp = true;
      out.push({ op: 'set', dimension: 'spNames', value: [pitcher] });
      continue;
    }
    if (op.op === 'set' && op.dimension === 'opponents') {
      sawOppTeam = true;
      const vals = Array.isArray(op.value) ? op.value.map(String) : [];
      const merged = [...new Set([...vals.map((v) => toF5SplitTeamAbbr(v)), team])];
      out.push({ op: 'set', dimension: 'opponents', value: merged });
      continue;
    }
    out.push(op);
  }

  if (!sawSp) out.unshift({ op: 'set', dimension: 'spNames', value: [pitcher] });
  if (!sawOppTeam) out.push({ op: 'set', dimension: 'opponents', value: [team] });
  return out;
}
