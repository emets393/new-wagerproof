import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CollegeTeamMark } from './shared';
import type { TeamRef } from '../../../types';

/**
 * Season-to-date team performance by market — web port of the native
 * `teamTrendStrip` on NFL/CFB game sheets. Reads `*_team_trends`; when the
 * season hasn't started yet the shell still renders with "No games yet".
 */

export type FootballSport = 'cfb' | 'nfl';

export type TeamTrendKind = 'ats' | 'ou' | 'tt' | 'su' | 'h1_ats' | 'h1_ou';

export type FootballTeamTrend = {
  /** NFL: team_abbr. CFB: team_name (lookup key). */
  key: string;
  teamName?: string | null;
  teamAbbr?: string | null;
  games?: number | null;
  suW?: number | null;
  suL?: number | null;
  suRecord?: string | null;
  atsW?: number | null;
  atsL?: number | null;
  atsP?: number | null;
  atsPct?: number | null;
  ouO?: number | null;
  ouU?: number | null;
  ouP?: number | null;
  overPct?: number | null;
  ttO?: number | null;
  ttU?: number | null;
  ttOverPct?: number | null;
  h1AtsW?: number | null;
  h1AtsL?: number | null;
  h1AtsP?: number | null;
  h1AtsPct?: number | null;
  h1OuO?: number | null;
  h1OuU?: number | null;
  h1OverPct?: number | null;
  last5Su?: string[];
  last5Ats?: string[];
  last5Ou?: string[];
  gameLog?: FootballTrendGameLog[];
};

type FootballTrendGameLog = {
  week?: number | null;
  date?: string | null;
  opp?: string | null;
  is_home?: boolean | null;
  spread?: number | null;
  total?: number | null;
  tt_line?: number | null;
  h1_spread?: number | null;
  h1_total?: number | null;
  su?: string | null;
  ats?: string | null;
  ou?: string | null;
  tt?: string | null;
  h1_ats?: string | null;
  h1_ou?: string | null;
  cover_margin?: number | null;
  ou_margin?: number | null;
  tt_margin?: number | null;
  h1_cover_margin?: number | null;
  h1_ou_margin?: number | null;
};

const NFL_TREND_COLUMNS =
  'team_abbr,team_name,su_w,su_l,su_record,ats_w,ats_l,ats_p,ats_pct,ou_o,ou_u,ou_p,over_pct,tt_o,tt_u,tt_over_pct,h1_ats_w,h1_ats_l,h1_ats_p,h1_ats_pct,h1_ou_o,h1_ou_u,h1_over_pct,last5_su,last5_ats,last5_ou,game_log';

const CFB_TREND_COLUMNS =
  'team_name,season,through_week,games,su_w,su_l,su_record,ats_w,ats_l,ats_p,ats_pct,ou_o,ou_u,ou_p,over_pct,tt_o,tt_u,tt_games,tt_over_pct,h1_ats_w,h1_ats_l,h1_ats_p,h1_ats_games,h1_ats_pct,h1_ou_o,h1_ou_u,h1_ou_games,h1_over_pct,last5_su,last5_ats,last5_ou,game_log';

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

function asGameLog(value: unknown): FootballTrendGameLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is FootballTrendGameLog => row != null && typeof row === 'object');
}

function mapNflTrend(row: Record<string, unknown>): FootballTeamTrend {
  const abbr = String(row.team_abbr || '');
  return {
    key: abbr,
    teamAbbr: abbr,
    teamName: (row.team_name as string) || null,
    suW: row.su_w as number | null,
    suL: row.su_l as number | null,
    suRecord: (row.su_record as string) || null,
    atsW: row.ats_w as number | null,
    atsL: row.ats_l as number | null,
    atsP: row.ats_p as number | null,
    atsPct: row.ats_pct as number | null,
    ouO: row.ou_o as number | null,
    ouU: row.ou_u as number | null,
    ouP: row.ou_p as number | null,
    overPct: row.over_pct as number | null,
    ttO: row.tt_o as number | null,
    ttU: row.tt_u as number | null,
    ttOverPct: row.tt_over_pct as number | null,
    h1AtsW: row.h1_ats_w as number | null,
    h1AtsL: row.h1_ats_l as number | null,
    h1AtsP: row.h1_ats_p as number | null,
    h1AtsPct: row.h1_ats_pct as number | null,
    h1OuO: row.h1_ou_o as number | null,
    h1OuU: row.h1_ou_u as number | null,
    h1OverPct: row.h1_over_pct as number | null,
    last5Su: asStringList(row.last5_su),
    last5Ats: asStringList(row.last5_ats),
    last5Ou: asStringList(row.last5_ou),
    gameLog: asGameLog(row.game_log),
    games:
      Number(row.ats_w || 0) +
      Number(row.ats_l || 0) +
      Number(row.ats_p || 0),
  };
}

function mapCfbTrend(row: Record<string, unknown>): FootballTeamTrend {
  const name = String(row.team_name || '');
  return {
    key: name,
    teamName: name,
    games: (row.games as number) ?? null,
    suW: row.su_w as number | null,
    suL: row.su_l as number | null,
    suRecord: (row.su_record as string) || null,
    atsW: row.ats_w as number | null,
    atsL: row.ats_l as number | null,
    atsP: row.ats_p as number | null,
    atsPct: row.ats_pct as number | null,
    ouO: row.ou_o as number | null,
    ouU: row.ou_u as number | null,
    ouP: row.ou_p as number | null,
    overPct: row.over_pct as number | null,
    ttO: row.tt_o as number | null,
    ttU: row.tt_u as number | null,
    ttOverPct: row.tt_over_pct as number | null,
    h1AtsW: row.h1_ats_w as number | null,
    h1AtsL: row.h1_ats_l as number | null,
    h1AtsP: row.h1_ats_p as number | null,
    h1AtsPct: row.h1_ats_pct as number | null,
    h1OuO: row.h1_ou_o as number | null,
    h1OuU: row.h1_ou_u as number | null,
    h1OverPct: row.h1_over_pct as number | null,
    last5Su: asStringList(row.last5_su),
    last5Ats: asStringList(row.last5_ats),
    last5Ou: asStringList(row.last5_ou),
    gameLog: asGameLog(row.game_log),
  };
}

export async function fetchFootballTeamTrends(args: {
  sport: FootballSport;
  season: number;
  away: TeamRef;
  home: TeamRef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any };
}): Promise<Record<string, FootballTeamTrend>> {
  const { sport, season, away, home, client } = args;

  if (sport === 'nfl') {
    const abbrs = [away.abbrev, home.abbrev].map((a) => String(a || '').toUpperCase()).filter(Boolean);
    if (abbrs.length === 0) return {};
    const { data, error } = await client
      .from('nfl_team_trends')
      .select(NFL_TREND_COLUMNS)
      .in('team_abbr', abbrs);
    if (error) throw error;
    const byKey: Record<string, FootballTeamTrend> = {};
    for (const row of data || []) {
      const mapped = mapNflTrend(row as Record<string, unknown>);
      if (mapped.key) byKey[mapped.key.toUpperCase()] = mapped;
    }
    return byKey;
  }

  const names = [away.name, home.name].map((n) => String(n || '').trim()).filter(Boolean);
  if (names.length === 0) return {};
  const { data, error } = await client
    .from('cfb_team_trends')
    .select(CFB_TREND_COLUMNS)
    .eq('season', season)
    .in('team_name', names);
  if (error) throw error;
  const byKey: Record<string, FootballTeamTrend> = {};
  for (const row of data || []) {
    const mapped = mapCfbTrend(row as Record<string, unknown>);
    if (mapped.key) byKey[mapped.key] = mapped;
  }
  return byKey;
}

export function trendKindForCardGroup(group: string): TeamTrendKind | null {
  switch (group) {
    case 'spread':
      return 'ats';
    case 'total':
      return 'ou';
    case 'team_total':
      return 'tt';
    case 'moneyline':
      return 'su';
    case 'h1_spread':
      return 'h1_ats';
    case 'h1_total':
      return 'h1_ou';
    default:
      return null;
  }
}

function pctText(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return '';
  const n = Number(pct);
  // Table stores 0–1 or 0–100 depending on sport/row; normalize.
  const display = n <= 1 ? n * 100 : n;
  return `${Math.round(display)}%`;
}

function recordText(w?: number | null, l?: number | null, p?: number | null): string {
  const ww = w ?? 0;
  const ll = l ?? 0;
  const pp = p ?? 0;
  return pp > 0 ? `${ww}-${ll}-${pp}` : `${ww}-${ll}`;
}

function metricForKind(
  kind: TeamTrendKind,
  trend: FootballTeamTrend | undefined,
): { label: string; value: string; chips: string[]; empty: boolean } {
  const label =
    kind === 'ats'
      ? 'ATS'
      : kind === 'ou'
        ? 'O/U'
        : kind === 'tt'
          ? 'TT Over'
          : kind === 'su'
            ? 'SU'
            : kind === 'h1_ats'
              ? '1H ATS'
              : '1H O/U';

  if (!trend) {
    return { label, value: 'No games yet', chips: [], empty: true };
  }

  const games =
    trend.games ??
    (kind === 'ats' || kind === 'h1_ats'
      ? (trend.atsW ?? 0) + (trend.atsL ?? 0) + (trend.atsP ?? 0)
      : kind === 'ou' || kind === 'h1_ou'
        ? (trend.ouO ?? 0) + (trend.ouU ?? 0) + (trend.ouP ?? 0)
        : kind === 'tt'
          ? (trend.ttO ?? 0) + (trend.ttU ?? 0)
          : (trend.suW ?? 0) + (trend.suL ?? 0));

  const chipsPreview =
    kind === 'ats'
      ? (trend.last5Ats || []).slice(0, 5)
      : kind === 'ou'
        ? (trend.last5Ou || []).slice(0, 5)
        : kind === 'su'
          ? (trend.last5Su || []).slice(0, 5)
          : [];

  // Early-season rows can carry last-season L5 chips before this year's games
  // accumulate — still show the strip values rather than a false empty state.
  if (!games && chipsPreview.length === 0) {
    return { label, value: 'No games yet', chips: [], empty: true };
  }

  switch (kind) {
    case 'ats':
      return {
        label,
        value: `${recordText(trend.atsW, trend.atsL, trend.atsP)} ${pctText(trend.atsPct)}`.trim(),
        chips: (trend.last5Ats || []).slice(0, 5),
        empty: false,
      };
    case 'ou':
      return {
        label,
        value: `${recordText(trend.ouO, trend.ouU, trend.ouP)} ${pctText(trend.overPct)}`.trim(),
        chips: (trend.last5Ou || []).slice(0, 5),
        empty: false,
      };
    case 'tt':
      return {
        label,
        value: `${trend.ttO ?? 0}-${trend.ttU ?? 0} ${pctText(trend.ttOverPct)}`.trim(),
        chips: [],
        empty: false,
      };
    case 'su':
      return {
        label,
        value: trend.suRecord || recordText(trend.suW, trend.suL),
        chips: (trend.last5Su || []).slice(0, 5),
        empty: false,
      };
    case 'h1_ats':
      return {
        label,
        value: `${recordText(trend.h1AtsW, trend.h1AtsL, trend.h1AtsP)} ${pctText(trend.h1AtsPct)}`.trim(),
        chips: [],
        empty: false,
      };
    case 'h1_ou':
      return {
        label,
        value: `${trend.h1OuO ?? 0}-${trend.h1OuU ?? 0} ${pctText(trend.h1OverPct)}`.trim(),
        chips: [],
        empty: false,
      };
  }
}

function chipColor(raw: string): string {
  const v = raw.toUpperCase();
  if (v === 'W' || v === 'O' || v === 'C') return 'bg-emerald-600 text-white';
  if (v === 'L' || v === 'U') return 'bg-red-600 text-white';
  if (v === 'P' || v === 'T') return 'bg-muted-foreground/70 text-white';
  return 'bg-muted text-muted-foreground';
}

function TrendTeamCard({
  team,
  kind,
  trend,
  onOpen,
}: {
  team: TeamRef;
  kind: TeamTrendKind;
  trend: FootballTeamTrend | undefined;
  onOpen: () => void;
}) {
  const metric = metricForKind(kind, trend);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl bg-black/[0.03] p-2.5 text-left transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
    >
      <div className="flex items-center gap-1.5">
        <CollegeTeamMark team={team} size={20} />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold text-foreground">{team.abbrev}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {metric.label}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Season
          </div>
          <div
            className={cn(
              'text-[11px] font-bold tabular-nums',
              metric.empty ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {metric.value}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {metric.chips.length > 0 ? (
          <>
            <span className="text-[8px] font-bold text-muted-foreground/70">L{metric.chips.length}</span>
            {metric.chips.map((chip, i) => (
              <span
                key={`${chip}-${i}`}
                className={cn(
                  'flex h-[17px] w-[17px] items-center justify-center rounded-full text-[8px] font-black',
                  chipColor(chip),
                )}
              >
                {chip.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </>
        ) : (
          <span className="text-[8px] font-bold text-muted-foreground/70">
            {metric.empty ? 'Season not started' : 'No L5'}
          </span>
        )}
      </div>
      <span className="text-[8px] font-bold text-muted-foreground/70">
        Tap for game log
      </span>
    </button>
  );
}

/**
 * Always renders for markets that have a season analogue — empty shell when
 * Week 1 has no graded games yet.
 */
export function TeamTrendsStrip({
  cardGroup,
  away,
  home,
  trendsByKey,
  sport,
  pickTeams,
}: {
  cardGroup: string;
  away: TeamRef;
  home: TeamRef;
  trendsByKey: Record<string, FootballTeamTrend>;
  sport: FootballSport;
  /** For team_total cards, optionally restrict to the picked team names. */
  pickTeams?: Array<string | null | undefined>;
}) {
  const kind = trendKindForCardGroup(cardGroup);
  const [selectedTeam, setSelectedTeam] = useState<TeamRef | null>(null);
  if (!kind) return null;

  const resolve = (team: TeamRef): FootballTeamTrend | undefined => {
    if (sport === 'nfl') {
      return trendsByKey[String(team.abbrev || '').toUpperCase()];
    }
    return (
      trendsByKey[team.name] ||
      Object.values(trendsByKey).find(
        (t) => t.teamName?.toLowerCase() === team.name.toLowerCase(),
      )
    );
  };

  let teams: TeamRef[] = [away, home];
  if (cardGroup === 'team_total' && pickTeams && pickTeams.length > 0) {
    const filtered = [away, home].filter((t) =>
      pickTeams.some(
        (p) =>
          p &&
          (p === t.name ||
            p === t.abbrev ||
            p.toLowerCase() === t.name.toLowerCase() ||
            p.toUpperCase() === t.abbrev.toUpperCase()),
      ),
    );
    if (filtered.length > 0) teams = filtered;
  }

  return (
    <div className="mt-3 rounded-xl border border-black/5 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Team Trends
        </span>
        <span className="text-[9px] text-muted-foreground/70">
          {kind === 'ats'
            ? 'ATS this season'
            : kind === 'ou'
              ? 'O/U this season'
              : kind === 'tt'
                ? 'Team Total this season'
                : kind === 'su'
                  ? 'SU this season'
                  : kind === 'h1_ats'
                    ? '1H ATS this season'
                    : '1H O/U this season'}
        </span>
      </div>
      <div className="flex gap-2">
        {teams.map((team) => (
          <TrendTeamCard
            key={team.abbrev + team.name}
            team={team}
            kind={kind}
            trend={resolve(team)}
            onOpen={() => setSelectedTeam(team)}
          />
        ))}
      </div>
      <TrendDetailDialog
        team={selectedTeam}
        kind={kind}
        trend={selectedTeam ? resolve(selectedTeam) : undefined}
        onOpenChange={(open) => !open && setSelectedTeam(null)}
      />
    </div>
  );
}

function TrendDetailDialog({
  team,
  kind,
  trend,
  onOpenChange,
}: {
  team: TeamRef | null;
  kind: TeamTrendKind;
  trend: FootballTeamTrend | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = (trend?.gameLog || [])
    .map((game) => {
      const detail = trendResultForKind(game, kind);
      return detail.result ? { game, ...detail } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const label = metricForKind(kind, trend).label;

  return (
    <Dialog open={team !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(44rem,88vh)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{team?.abbrev} {label} trend</DialogTitle>
          <DialogDescription>Season game log · newest first</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-muted-foreground">
            No games have been played this season yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
            <table className="w-full min-w-[33rem] text-left text-xs">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Opp</th>
                  <th className="px-3 py-2">{trendLineHeader(kind)}</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {rows.map(({ game, line, result, margin }, index) => (
                  <tr key={`${game.date || 'date'}-${game.opp || 'opp'}-${index}`}>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{trendDate(game.date)}</td>
                    <td className="px-3 py-2 font-semibold">
                      {game.is_home === false ? '@ ' : ''}{game.opp || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">{trendNumber(line)}</td>
                    <td className={cn(
                      'px-3 py-2 font-black',
                      ['W', 'O', 'C'].includes(result.toUpperCase()) && 'text-emerald-600',
                      ['L', 'U'].includes(result.toUpperCase()) && 'text-red-600',
                    )}>{result}</td>
                    <td className="px-3 py-2 text-right font-mono">{trendNumber(margin, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function trendResultForKind(game: FootballTrendGameLog, kind: TeamTrendKind) {
  switch (kind) {
    case 'ats': return { line: game.spread, result: game.ats, margin: game.cover_margin };
    case 'ou': return { line: game.total, result: game.ou, margin: game.ou_margin };
    case 'tt': return { line: game.tt_line, result: game.tt, margin: game.tt_margin };
    case 'su': return { line: null, result: game.su, margin: null };
    case 'h1_ats': return { line: game.h1_spread, result: game.h1_ats, margin: game.h1_cover_margin };
    case 'h1_ou': return { line: game.h1_total, result: game.h1_ou, margin: game.h1_ou_margin };
  }
}

function trendLineHeader(kind: TeamTrendKind) {
  if (kind === 'ats') return 'Spread';
  if (kind === 'ou') return 'Total';
  if (kind === 'tt') return 'TT';
  if (kind === 'h1_ats') return '1H Spread';
  if (kind === 'h1_ou') return '1H Total';
  return 'Line';
}

function trendDate(value?: string | null) {
  return value && value.length >= 10 ? value.slice(5, 10).replace('-', '/') : '—';
}

function trendNumber(value?: number | null, signed = false) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return `${signed && number > 0 ? '+' : ''}${number % 1 === 0 ? number : number.toFixed(1)}`;
}

/** Resolve a sportsbook logo URL with DuckDuckGo favicon fallback (native parity). */
export function sportsbookFallbackUrl(bookKey?: string | null, bookName?: string | null): string | null {
  const key = (bookKey || '').toLowerCase();
  const name = (bookName || '').toLowerCase();
  let domain: string | null = null;
  switch (key) {
    case 'draftkings':
      domain = 'draftkings.com';
      break;
    case 'fanduel':
      domain = 'fanduel.com';
      break;
    case 'betmgm':
      domain = 'betmgm.com';
      break;
    case 'betrivers':
      domain = 'betrivers.com';
      break;
    case 'williamhill_us':
      domain = 'caesars.com';
      break;
    case 'espnbet':
      domain = 'espnbet.com';
      break;
    case 'fanatics':
      domain = 'fanatics.com';
      break;
    case 'bet365':
      domain = 'bet365.com';
      break;
    case 'bovada':
      domain = 'bovada.lv';
      break;
    case 'betonlineag':
      domain = 'betonline.ag';
      break;
    case 'mybookieag':
      domain = 'mybookie.ag';
      break;
    case 'betus':
      domain = 'betus.com.pa';
      break;
    case 'lowvig':
      domain = 'lowvig.ag';
      break;
    default:
      break;
  }
  if (!domain && name) {
    if (name.includes('draftkings')) domain = 'draftkings.com';
    else if (name.includes('fanduel')) domain = 'fanduel.com';
    else if (name.includes('betmgm')) domain = 'betmgm.com';
    else if (name.includes('betrivers')) domain = 'betrivers.com';
    else if (name.includes('caesars')) domain = 'caesars.com';
    else if (name.includes('espn')) domain = 'espnbet.com';
    else if (name.includes('fanatics')) domain = 'fanatics.com';
    else if (name.includes('bovada')) domain = 'bovada.lv';
    else if (name.includes('betonline')) domain = 'betonline.ag';
    else if (name.includes('mybookie')) domain = 'mybookie.ag';
    else if (name.includes('betus')) domain = 'betus.com.pa';
  }
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
}
