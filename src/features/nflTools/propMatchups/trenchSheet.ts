/** Offensive line against this week's front. One row per team, taken from fp_cards.trenches. */

import type { CheatMetric, CheatTone } from './cheatsheet';

export interface TrenchSource {
  team: string;
  opponent: string;
  kickoff?: string | null;
  fp_cards?: {
    trenches?: {
      line?: Record<string, number | null>;
      front?: Record<string, number | null>;
      pass_pro_edge?: number | null;
      run_block_edge?: number | null;
    } | null;
  } | null;
}

export interface TrenchRow {
  team: string;
  opponent: string;
  kickoff: string | null;
  passEdge: number | null;
  runEdge: number | null;
  pressure: CheatMetric | null;
  yardsBeforeContact: CheatMetric | null;
  frontPressure: CheatMetric | null;
  frontYards: CheatMetric | null;
}

function finite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function measure(blob: Record<string, number | null> | undefined, key: string): CheatMetric | null {
  const actual = finite(blob?.[key]);
  if (actual == null) return null;
  const league = finite(blob?.[`${key}_league`]);
  return {
    actual,
    league,
    lift: league != null && league !== 0 ? actual / league - 1 : null,
    rank: finite(blob?.[`${key}_rank`]),
    of: finite(blob?.[`${key}_of`]),
  };
}

export function buildTrenchRows(pages: TrenchSource[]): TrenchRow[] {
  const seen = new Set<string>();
  const rows: TrenchRow[] = [];
  for (const page of pages) {
    const team = page.team?.trim();
    const trenches = page.fp_cards?.trenches;
    if (!team || seen.has(team) || !trenches) continue;
    const line = trenches.line;
    const front = trenches.front;
    const passEdge = finite(trenches.pass_pro_edge);
    const runEdge = finite(trenches.run_block_edge);
    const pressure = measure(line, 'ol_pressure_faced');
    const yardsBeforeContact = measure(line, 'ol_ybc_per_att');
    const frontPressure = measure(front, 'dl_pressure_generated');
    const frontYards = measure(front, 'dl_ybc_allowed');
    if (passEdge == null && runEdge == null && !pressure && !yardsBeforeContact && !frontPressure && !frontYards) continue;
    seen.add(team);
    rows.push({
      team,
      opponent: page.opponent?.trim() || '',
      kickoff: page.kickoff ?? null,
      passEdge,
      runEdge,
      pressure,
      yardsBeforeContact,
      frontPressure,
      frontYards,
    });
  }
  return rows;
}

function signed(value: number, digits: number): string {
  const body = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${body}`;
  if (value < 0) return `\u2212${body}`;
  return body;
}

/** Pass edge is a pressure-rate gap. Run edge is yards before contact. Positive favors the offensive line. */
export function formatTrenchEdge(kind: 'pass' | 'run', value: number | null): { text: string; tone: CheatTone } | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (kind === 'pass') {
    const points = value * 100;
    return { text: `${signed(points, 1)} pp`, tone: Math.abs(points) < 1 ? 'nil' : points > 0 ? 'pos' : 'neg' };
  }
  return { text: `${signed(value, 2)} yds`, tone: Math.abs(value) < 0.15 ? 'nil' : value > 0 ? 'pos' : 'neg' };
}
