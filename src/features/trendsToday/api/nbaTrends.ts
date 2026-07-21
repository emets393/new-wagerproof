import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getNBATeamColors, getNBATeamInitials } from '@/utils/teamColors';
import type { TrendsFeed, TrendsFeedItem, TrendsTeam } from '../types';
import {
  buildVerdict,
  formatEtTime,
  isMissingTableError,
  pairRowsByGame,
  scoreAngles,
  timeSortKeyFor,
  todayInEt,
} from './shared';
import { buildHoopsAngles, type HoopsSituationalTrendRow } from './hoopsShared';

/**
 * ESPN logo slugs by the team names the trends view uses. Ported from
 * NBATodayBettingTrends.tsx — `getNBATeamLogo()` in utils/teamLogos.ts is a
 * stub that always returns the placeholder, so this map is the real source.
 */
const NBA_ESPN_SLUGS: Record<string, string> = {
  atlanta: 'atl',
  boston: 'bos',
  brooklyn: 'bkn',
  charlotte: 'cha',
  chicago: 'chi',
  cleveland: 'cle',
  dallas: 'dal',
  denver: 'den',
  detroit: 'det',
  'golden state': 'gs',
  houston: 'hou',
  indiana: 'ind',
  'la clippers': 'lac',
  'los angeles clippers': 'lac',
  'la lakers': 'lal',
  'los angeles lakers': 'lal',
  memphis: 'mem',
  miami: 'mia',
  milwaukee: 'mil',
  minnesota: 'min',
  'new orleans': 'no',
  'new york': 'ny',
  'oklahoma city': 'okc',
  'okla city': 'okc',
  orlando: 'orl',
  philadelphia: 'phi',
  phoenix: 'phx',
  portland: 'por',
  sacramento: 'sac',
  'san antonio': 'sa',
  toronto: 'tor',
  utah: 'utah',
  washington: 'wsh',
};

/** Full club names ("Boston Celtics") resolve via their city prefix. */
function nbaLogoUrl(teamName: string): string | null {
  if (!teamName) return null;
  const key = teamName.trim().toLowerCase();
  const exact = NBA_ESPN_SLUGS[key];
  if (exact) return `https://a.espncdn.com/i/teamlogos/nba/500/${exact}.png`;

  for (const [city, slug] of Object.entries(NBA_ESPN_SLUGS)) {
    if (key.startsWith(city)) return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
  }
  return null;
}

function resolveTeam(row: HoopsSituationalTrendRow): TrendsTeam {
  return {
    name: row.team_name,
    abbrev: row.team_abbr || getNBATeamInitials(row.team_name),
    logoUrl: nbaLogoUrl(row.team_name),
    colors: getNBATeamColors(row.team_name),
  };
}

async function selectTrendRows(): Promise<HoopsSituationalTrendRow[]> {
  const primary = await collegeFootballSupabase
    .from('nba_game_situational_trends_today')
    .select('*')
    .order('game_date', { ascending: true })
    .order('game_id', { ascending: true });

  if (!primary.error) return (primary.data ?? []) as HoopsSituationalTrendRow[];

  if (isMissingTableError(primary.error)) {
    const fallback = await collegeFootballSupabase
      .from('nba_game_situational_trends')
      .select('*')
      // Date-bounded: the non-_today table carries full history.
      .gte('game_date', todayInEt())
      .order('game_date', { ascending: true })
      .order('game_id', { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []) as HoopsSituationalTrendRow[];
  }

  throw new Error(primary.error.message);
}

export async function fetchNbaTrends(): Promise<TrendsFeed> {
  const rows = await selectTrendRows();
  if (rows.length === 0) return { games: [], fetchedAt: Date.now() };

  const paired = pairRowsByGame(rows, (row) =>
    Number.isFinite(Number(row.game_id)) ? Number(row.game_id) : null,
  );
  if (paired.size === 0) return { games: [], fetchedAt: Date.now() };

  // Tipoffs live on the predictions input view, not the trends table.
  const gameIds = Array.from(paired.keys());
  const timesResult = await collegeFootballSupabase
    .from('nba_input_values_view')
    .select('game_id, tipoff_time_et')
    .in('game_id', gameIds);
  const timeById = new Map<number, string | null>();
  for (const raw of (timesResult.data ?? []) as Record<string, unknown>[]) {
    timeById.set(Number(raw.game_id), (raw.tipoff_time_et as string | null) ?? null);
  }

  const games: TrendsFeedItem[] = [];
  for (const [gameId, { away, home }] of paired) {
    const angles = buildHoopsAngles(away, home);
    const gameDate = String(away.game_date ?? home.game_date ?? '').slice(0, 10);
    const time = timeById.get(gameId) ?? null;

    games.push({
      sport: 'nba',
      id: `nba-${gameId}`,
      away: resolveTeam(away),
      home: resolveTeam(home),
      gameDate,
      gameTimeLabel: formatEtTime(time),
      timeSortKey: timeSortKeyFor(gameDate, time),
      angles,
      verdict: buildVerdict(angles),
      scores: scoreAngles('nba', angles),
    });
  }

  return { games, fetchedAt: Date.now() };
}
