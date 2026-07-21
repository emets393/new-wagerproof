import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getNCAABTeamColors, getNCAABTeamInitials } from '@/utils/teamColors';
import { getNCAABTeamMappings } from '@/utils/teamLogos';
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

type LogoMapping = Map<number, { espn_team_url: string; team_abbrev: string | null }>;

function resolveTeam(row: HoopsSituationalTrendRow, logos: LogoMapping): TrendsTeam {
  const mapped = Number.isFinite(Number(row.team_id)) ? logos.get(Number(row.team_id)) : undefined;
  const logoUrl =
    mapped?.espn_team_url && mapped.espn_team_url !== '/placeholder.svg'
      ? mapped.espn_team_url
      : null;

  return {
    name: row.team_name,
    abbrev: row.team_abbr || mapped?.team_abbrev || getNCAABTeamInitials(row.team_name),
    logoUrl,
    colors: getNCAABTeamColors(row.team_name),
  };
}

async function selectTrendRows(): Promise<HoopsSituationalTrendRow[]> {
  const primary = await collegeFootballSupabase
    .from('ncaab_game_situational_trends_today')
    .select('*')
    .order('game_date', { ascending: true })
    .order('game_id', { ascending: true });

  if (!primary.error) return (primary.data ?? []) as HoopsSituationalTrendRow[];

  if (isMissingTableError(primary.error)) {
    const fallback = await collegeFootballSupabase
      .from('ncaab_game_situational_trends')
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

export async function fetchNcaabTrends(): Promise<TrendsFeed> {
  const rows = await selectTrendRows();
  if (rows.length === 0) return { games: [], fetchedAt: Date.now() };

  const paired = pairRowsByGame(rows, (row) =>
    Number.isFinite(Number(row.game_id)) ? Number(row.game_id) : null,
  );
  if (paired.size === 0) return { games: [], fetchedAt: Date.now() };

  // v_cbb_input_values supplies both the tipoff AND the api_team_ids that the
  // logo mapping is keyed on — the trends view's own team_id doesn't match it.
  const gameIds = Array.from(paired.keys());
  const inputsResult = await collegeFootballSupabase
    .from('v_cbb_input_values')
    .select('game_id, tipoff_time_et, home_team_id, away_team_id')
    .in('game_id', gameIds);

  const timeById = new Map<number, string | null>();
  const teamIdsById = new Map<number, { home: number; away: number }>();
  for (const raw of (inputsResult.data ?? []) as Record<string, unknown>[]) {
    const gameId = Number(raw.game_id);
    timeById.set(gameId, (raw.tipoff_time_et as string | null) ?? null);
    const homeId = Number(raw.home_team_id);
    const awayId = Number(raw.away_team_id);
    if (Number.isFinite(homeId) && Number.isFinite(awayId)) {
      teamIdsById.set(gameId, { home: homeId, away: awayId });
    }
  }

  const logos = await getNCAABTeamMappings();

  const games: TrendsFeedItem[] = [];
  for (const [gameId, { away, home }] of paired) {
    const ids = teamIdsById.get(gameId);
    const awayRow = ids ? { ...away, team_id: ids.away } : away;
    const homeRow = ids ? { ...home, team_id: ids.home } : home;

    const angles = buildHoopsAngles(awayRow, homeRow);
    const gameDate = String(away.game_date ?? home.game_date ?? '').slice(0, 10);
    const time = timeById.get(gameId) ?? null;

    games.push({
      sport: 'ncaab',
      id: `ncaab-${gameId}`,
      away: resolveTeam(awayRow, logos),
      home: resolveTeam(homeRow, logos),
      gameDate,
      gameTimeLabel: formatEtTime(time),
      timeSortKey: timeSortKeyFor(gameDate, time),
      angles,
      verdict: buildVerdict(angles),
      scores: scoreAngles('ncaab', angles),
    });
  }

  return { games, fetchedAt: Date.now() };
}
