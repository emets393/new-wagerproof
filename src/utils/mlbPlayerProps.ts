import type {
  MlbPlayerPropGameEntry,
  MlbPlayerPropLineEntry,
  MlbPlayerPropRow,
  PropComputedAtLine,
  PropHitSplit,
  TopPropPlay,
} from '@/types/mlb-player-props';
import type { MlbPlayerPropMarket } from '@/types/mlb-player-props';
import { formatMoneyline } from '@/utils/mlbPitcherMatchups';

// Market labels are globally unique — Strikeouts and Walks exist for BOTH
// batters and pitchers; without the kind prefix they collide on the
// performance dashboard (and confuse users when summaries mix markets).
export const MLB_PLAYER_PROP_MARKET_LABELS: Record<string, string> = {
  batter_home_runs: 'Home Runs',
  batter_hits: 'Hits',
  batter_total_bases: 'Total Bases',
  batter_rbis: 'RBIs',
  batter_hits_runs_rbis: 'H+R+RBI',
  batter_walks: 'Batter Walks',
  batter_strikeouts: 'Batter K',
  pitcher_strikeouts: 'Pitcher K',
  pitcher_hits_allowed: 'Hits Allowed',
  pitcher_walks: 'Pitcher Walks',
  pitcher_outs: 'Outs',
};

// Per-market emoji — one visual signature per bet type so users can scan a
// performance table and immediately see "is this a power prop or a contact
// prop". The 💣/🚀/🔥 cluster reads as offensive output; the ⚡/🌪️/🛡️
// cluster reads as pitcher control vs chaos.
export const MLB_PLAYER_PROP_MARKET_EMOJIS: Record<string, string> = {
  batter_home_runs: '💣',
  batter_hits: '🏏',
  batter_total_bases: '🚀',
  batter_rbis: '🏃',
  batter_hits_runs_rbis: '🔥',
  batter_walks: '👁️',
  batter_strikeouts: '💨',
  pitcher_strikeouts: '⚡',
  pitcher_hits_allowed: '🎯',
  pitcher_walks: '🌪️',
  pitcher_outs: '🛡️',
};

export const MLB_PLAYER_PROP_VALUE_LABELS: Record<string, string> = {
  batter_home_runs: 'HR',
  batter_hits: 'H',
  batter_total_bases: 'TB',
  batter_rbis: 'RBI',
  batter_hits_runs_rbis: 'H+R+RBI',
  batter_walks: 'BB',
  batter_strikeouts: 'K',
  pitcher_strikeouts: 'K',
  pitcher_hits_allowed: 'H',
  pitcher_walks: 'BB',
  pitcher_outs: 'Outs',
};

const BATTER_MARKET_ORDER: MlbPlayerPropMarket[] = [
  'batter_home_runs',
  'batter_hits',
  'batter_total_bases',
  'batter_rbis',
  'batter_hits_runs_rbis',
  'batter_walks',
  'batter_strikeouts',
];

const PITCHER_MARKET_ORDER: MlbPlayerPropMarket[] = [
  'pitcher_strikeouts',
  'pitcher_hits_allowed',
  'pitcher_walks',
  'pitcher_outs',
];

export function marketLabel(market: string): string {
  return MLB_PLAYER_PROP_MARKET_LABELS[market] ?? market;
}

export function marketEmoji(market: string): string {
  return MLB_PLAYER_PROP_MARKET_EMOJIS[market] ?? '🎲';
}

export function marketSortIndex(market: string, isPitcher: boolean): number {
  const order = isPitcher ? PITCHER_MARKET_ORDER : BATTER_MARKET_ORDER;
  const idx = order.indexOf(market as MlbPlayerPropMarket);
  return idx >= 0 ? idx : 999;
}

export function formatPropOdds(odds: number | null | undefined): string {
  return formatMoneyline(odds ?? null);
}

export function formatPropLine(line: number | null | undefined): string {
  if (line == null || !Number.isFinite(Number(line))) return '—';
  const n = Number(line);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function parseLines(raw: unknown): MlbPlayerPropLineEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const o = entry as Record<string, unknown>;
      const line = Number(o.line);
      if (!Number.isFinite(line)) return null;
      return {
        line,
        over: o.over != null ? Number(o.over) : null,
        under: o.under != null ? Number(o.under) : null,
      };
    })
    .filter((x): x is MlbPlayerPropLineEntry => x != null)
    .sort((a, b) => a.line - b.line);
}

export function parseGames(raw: unknown): MlbPlayerPropGameEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const o = entry as Record<string, unknown>;
      const v = Number(o.v);
      if (!Number.isFinite(v)) return null;
      const d = Number(o.d) === 1 ? 1 : 0;
      const a = o.a != null && o.a !== 'Insufficient' ? String(o.a) : null;
      const dt = typeof o.dt === 'string' && o.dt.length > 0 ? o.dt : null;
      const game: MlbPlayerPropGameEntry = { v, d: d as 0 | 1, a, dt };
      return game;
    })
    .filter((x): x is MlbPlayerPropGameEntry => x != null);
}

export function cleared(game: MlbPlayerPropGameEntry, line: number): boolean {
  return game.v > line;
}

export function defaultLine(lines: MlbPlayerPropLineEntry[]): number | null {
  if (lines.length === 0) return null;
  const fair = lines.find(l => l.over != null && l.over >= -180);
  if (fair) return fair.line;
  return lines[lines.length - 1]!.line;
}

export function lineEntry(lines: MlbPlayerPropLineEntry[], line: number): MlbPlayerPropLineEntry | null {
  return lines.find(l => l.line === line) ?? null;
}

export function hitSplit(games: MlbPlayerPropGameEntry[], line: number, max?: number): PropHitSplit {
  const subset = max != null ? games.slice(0, max) : games;
  const games_n = subset.length;
  const over = subset.filter(g => cleared(g, line)).length;
  return {
    over,
    games: games_n,
    pct: games_n > 0 ? Math.round((over / games_n) * 100) : null,
  };
}

export function computePropAtLine(row: MlbPlayerPropRow, line: number): PropComputedAtLine | null {
  const entry = lineEntry(row.lines, line);
  if (!entry) return null;

  const l10 = hitSplit(row.games, line, 10);
  const season = hitSplit(row.games, line);
  const dayFlag = row.game_is_day ? 1 : 0;
  const contextualGames = row.games.filter(g => g.d === dayFlag);
  const contextualDayNight = contextualGames.length > 0 ? hitSplit(contextualGames, line) : null;

  let contextualArchetype: PropHitSplit | null = null;
  if (!row.is_pitcher && row.opp_archetype_today) {
    const archGames = row.games.filter(g => g.a === row.opp_archetype_today);
    if (archGames.length >= 3) contextualArchetype = hitSplit(archGames, line);
  }

  const chartSlice = row.games.slice(0, 12).reverse();
  const chartGames = chartSlice.map(g => ({
    value: g.v,
    cleared: cleared(g, line),
    isDay: g.d === 1,
    archetype: g.a,
    date: g.dt ?? null,
  }));

  const miniSlice = row.games.slice(0, 10).reverse();
  const miniStrip = miniSlice.map(g => ({ cleared: cleared(g, line), value: g.v }));

  return {
    line,
    overOdds: entry.over,
    underOdds: entry.under,
    l10,
    season,
    contextualDayNight,
    contextualArchetype,
    chartGames,
    miniStrip,
  };
}

export function pickHeadlineProp(props: MlbPlayerPropRow[]): { row: MlbPlayerPropRow; computed: PropComputedAtLine } | null {
  let best: { row: MlbPlayerPropRow; computed: PropComputedAtLine; rate: number } | null = null;
  for (const row of props) {
    const dl = defaultLine(row.lines);
    if (dl == null) continue;
    const computed = computePropAtLine(row, dl);
    if (!computed) continue;
    const rate = computed.l10.games > 0 ? computed.l10.over / computed.l10.games : -1;
    if (!best || rate > best.rate || (rate === best.rate && computed.l10.over > best.computed.l10.over)) {
      best = { row, computed, rate };
    }
  }
  return best ? { row: best.row, computed: best.computed } : null;
}

export function buildVerdict(row: MlbPlayerPropRow, computed: PropComputedAtLine): string {
  const { l10, contextualDayNight, contextualArchetype } = computed;
  if (l10.games === 0) return 'Not enough recent games to gauge this line.';
  const parts: string[] = [];
  if (l10.over >= 7) parts.push(`Cleared in ${l10.over} of last ${l10.games}`);
  else if (l10.over >= 5) parts.push(`Hit ${l10.over}/${l10.games} over the last ${l10.games}`);
  else if (l10.over <= 3) parts.push(`Only ${l10.over}/${l10.games} clears in the last ${l10.games}`);
  else parts.push(`${l10.over}/${l10.games} over the last ${l10.games}`);

  if (contextualDayNight && contextualDayNight.games >= 5) {
    const label = row.game_is_day ? 'day' : 'night';
    parts.push(`${contextualDayNight.over}/${contextualDayNight.games} in ${label} games`);
  }
  if (contextualArchetype && contextualArchetype.games >= 3 && row.opp_archetype_today) {
    parts.push(
      `${contextualArchetype.over}/${contextualArchetype.games} vs ${row.opp_archetype_today} starters`,
    );
  }
  const emoji = l10.over >= 7 ? '🔥 ' : l10.over >= 5 ? '📈 ' : '';
  return emoji + parts.join(' — ') + '.';
}

export function groupPropsByPlayer(rows: MlbPlayerPropRow[], isPitcher: boolean): Map<number, MlbPlayerPropRow[]> {
  const map = new Map<number, MlbPlayerPropRow[]>();
  for (const row of rows.filter(r => r.is_pitcher === isPitcher)) {
    const list = map.get(row.player_id) ?? [];
    list.push(row);
    map.set(row.player_id, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => marketSortIndex(a.market, isPitcher) - marketSortIndex(b.market, isPitcher));
  }
  return map;
}

export function topPropPlaysAcrossGames(
  entries: { gamePk: number; props: MlbPlayerPropRow[] }[],
  limit = 8,
): TopPropPlay[] {
  const plays: TopPropPlay[] = [];
  for (const { gamePk, props } of entries) {
    for (const row of props) {
      const dl = defaultLine(row.lines);
      if (dl == null) continue;
      const computed = computePropAtLine(row, dl);
      if (!computed || computed.l10.games < 3) continue;
      plays.push({
        gamePk,
        playerId: row.player_id,
        playerName: row.player_name,
        market: row.market,
        line: dl,
        l10Over: computed.l10.over,
        l10Games: computed.l10.games,
        pct: computed.l10.pct ?? 0,
        isPitcher: row.is_pitcher,
      });
    }
  }
  return plays.sort((a, b) => b.pct - a.pct || b.l10Over - a.l10Over).slice(0, limit);
}

export function splitFractionLabel(split: PropHitSplit): string {
  if (split.games <= 0) return '—';
  return `${split.over}/${split.games}`;
}

export function splitPctLabel(split: PropHitSplit): string {
  if (split.pct == null) return '—';
  return `${split.pct}%`;
}

export function lowConfidence(split: PropHitSplit): boolean {
  return split.games > 0 && split.games < 5;
}
