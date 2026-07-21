import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import {
  espnMlb500LogoUrlFromAbbrev,
  mlbEspn500UrlFromSlug,
  mlbStatsApiTeamBrand,
} from '@/utils/mlbTeamLogos';
import { getMLBTeamColors } from '@/utils/teamColors';
import type { TrendAngle, TrendsFeed, TrendsFeedItem, TrendsTeam } from '../types';
import {
  buildVerdict,
  formatEtTime,
  formatSituation,
  isMissingTableError,
  mlbOuLean,
  pairRowsByGame,
  scoreAngles,
  sideLeanFor,
  timeSortKeyFor,
  todayInEt,
  toTrendPct,
} from './shared';

/**
 * `mlb_situational_trends_today` row. Percent columns come back as numeric or
 * string depending on the view, hence the union type — `toTrendPct` normalizes.
 */
export interface MlbSituationalTrendRow {
  game_pk: number | string;
  game_date_et: string;
  team_id: number | string;
  team_name: string;
  team_side: 'home' | 'away';
  last_game_situation: string | null;
  home_away_situation: string | null;
  fav_dog_situation: string | null;
  rest_bucket: string | null;
  rest_comp: string | null;
  league_situation: string | null;
  division_situation: string | null;
  win_pct_last_game: number | string | null;
  win_pct_home_away: number | string | null;
  win_pct_fav_dog: number | string | null;
  win_pct_rest_bucket: number | string | null;
  win_pct_rest_comp: number | string | null;
  win_pct_league: number | string | null;
  win_pct_division: number | string | null;
  over_pct_last_game: number | string | null;
  over_pct_home_away: number | string | null;
  over_pct_fav_dog: number | string | null;
  over_pct_rest_bucket: number | string | null;
  over_pct_rest_comp: number | string | null;
  over_pct_league: number | string | null;
  over_pct_division: number | string | null;
}

/** The seven angles the MLB view exposes, in the order the legacy page showed them. */
const MLB_ANGLES: {
  key: string;
  label: string;
  situation: keyof MlbSituationalTrendRow;
  win: keyof MlbSituationalTrendRow;
  over: keyof MlbSituationalTrendRow;
}[] = [
  { key: 'last_game', label: 'Last game', situation: 'last_game_situation', win: 'win_pct_last_game', over: 'over_pct_last_game' },
  { key: 'home_away', label: 'Home / away', situation: 'home_away_situation', win: 'win_pct_home_away', over: 'over_pct_home_away' },
  { key: 'fav_dog', label: 'Favorite / underdog', situation: 'fav_dog_situation', win: 'win_pct_fav_dog', over: 'over_pct_fav_dog' },
  { key: 'rest_bucket', label: 'Rest bucket', situation: 'rest_bucket', win: 'win_pct_rest_bucket', over: 'over_pct_rest_bucket' },
  { key: 'rest_comp', label: 'Rest vs opponent', situation: 'rest_comp', win: 'win_pct_rest_comp', over: 'over_pct_rest_comp' },
  { key: 'league', label: 'League', situation: 'league_situation', win: 'win_pct_league', over: 'over_pct_league' },
  { key: 'division', label: 'Division', situation: 'division_situation', win: 'win_pct_division', over: 'over_pct_division' },
];

interface MlbTeamMapEntry {
  team: string;
  logoUrl: string | null;
}

function buildTeamMap(rows: Record<string, unknown>[]): Map<number, MlbTeamMapEntry> {
  const map = new Map<number, MlbTeamMapEntry>();
  for (const raw of rows) {
    const id = Math.trunc(Number(raw.mlb_api_id));
    if (!Number.isFinite(id)) continue;
    const logoRaw = raw.logo_url;
    const logoUrl =
      logoRaw !== null && logoRaw !== undefined && String(logoRaw).trim() !== ''
        ? String(logoRaw).trim()
        : null;
    map.set(id, { team: String(raw.team ?? '').trim(), logoUrl });
  }
  return map;
}

/**
 * Resolves brand from the official MLB `team_id` first: the Stats API table is
 * authoritative, while `mlb_team_mapping.team` / `logo_url` have been wrong for
 * relocated clubs (Athletics). The mapping row is only a fallback.
 */
function resolveTeam(
  row: MlbSituationalTrendRow,
  mapping: Map<number, MlbTeamMapEntry>,
): TrendsTeam {
  const teamId = Math.trunc(Number(row.team_id));
  const fallbackAbbrev = row.team_name?.trim().slice(0, 3).toUpperCase() || '?';

  let abbrev = fallbackAbbrev;
  let logoUrl: string | null = espnMlb500LogoUrlFromAbbrev(fallbackAbbrev);

  if (Number.isFinite(teamId)) {
    const brand = mlbStatsApiTeamBrand(teamId);
    if (brand) {
      abbrev = brand.abbrev;
      logoUrl = mlbEspn500UrlFromSlug(brand.espnSlug);
    } else {
      const mapped = mapping.get(teamId);
      abbrev = mapped?.team?.trim() || fallbackAbbrev;
      const fromMap =
        mapped?.logoUrl && mapped.logoUrl.startsWith('http') ? mapped.logoUrl : null;
      logoUrl = fromMap ?? espnMlb500LogoUrlFromAbbrev(abbrev);
    }
  }

  return {
    name: row.team_name,
    abbrev,
    logoUrl,
    colors: getMLBTeamColors(abbrev),
  };
}

function buildAngles(away: MlbSituationalTrendRow, home: MlbSituationalTrendRow): TrendAngle[] {
  return MLB_ANGLES.map(({ key, label, situation, win, over }) => {
    const awayWin = toTrendPct(away[win] as number | string | null);
    const homeWin = toTrendPct(home[win] as number | string | null);
    const awayOver = toTrendPct(away[over] as number | string | null);
    const homeOver = toTrendPct(home[over] as number | string | null);

    return {
      key,
      label,
      away: {
        situation: formatSituation(away[situation] as string | null),
        sidePct: awayWin,
        // MLB's view exposes rates only — no W-L strings, so no sample size.
        sideRecord: null,
        sideGames: null,
        overPct: awayOver,
        underPct: awayOver === null ? null : 100 - awayOver,
        ouRecord: null,
        ouGames: null,
      },
      home: {
        situation: formatSituation(home[situation] as string | null),
        sidePct: homeWin,
        sideRecord: null,
        sideGames: null,
        overPct: homeOver,
        underPct: homeOver === null ? null : 100 - homeOver,
        ouRecord: null,
        ouGames: null,
      },
      sideLean: sideLeanFor(awayWin, homeWin),
      ouLean: mlbOuLean(awayOver, homeOver),
    };
  });
}

async function selectTrendRows(): Promise<MlbSituationalTrendRow[]> {
  const primary = await collegeFootballSupabase
    .from('mlb_situational_trends_today')
    .select('*')
    .order('game_date_et', { ascending: true })
    .order('game_pk', { ascending: true });

  if (!primary.error) return (primary.data ?? []) as MlbSituationalTrendRow[];

  // The legacy page surfaced "the today view is missing" as a hard error. Here
  // the full table is a real fallback so the tool still renders a slate — but
  // it's the full history, so it must be date-bounded or it returns every game
  // ever played. `gte` rather than `eq` because the column is a date on the
  // view and a timestamp on some snapshots.
  if (isMissingTableError(primary.error)) {
    const fallback = await collegeFootballSupabase
      .from('mlb_situational_trends')
      .select('*')
      .gte('game_date_et', todayInEt())
      .order('game_date_et', { ascending: true })
      .order('game_pk', { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []) as MlbSituationalTrendRow[];
  }

  throw new Error(primary.error.message);
}

export async function fetchMlbTrends(): Promise<TrendsFeed> {
  const rows = await selectTrendRows();
  if (rows.length === 0) return { games: [], fetchedAt: Date.now() };

  const paired = pairRowsByGame(rows, (row) => {
    const pk = Math.trunc(Number(row.game_pk));
    return Number.isFinite(pk) ? pk : null;
  });
  if (paired.size === 0) return { games: [], fetchedAt: Date.now() };

  const mappingResult = await collegeFootballSupabase.from('mlb_team_mapping').select('*');
  const mapping = buildTeamMap((mappingResult.data ?? []) as Record<string, unknown>[]);

  // First pitch lives on the slate table, not the trends view.
  const pks = Array.from(paired.keys());
  const timesResult = await collegeFootballSupabase
    .from('mlb_games_today')
    .select('game_pk, game_time_et')
    .in('game_pk', pks);
  const timeByPk = new Map<number, string | null>();
  for (const raw of (timesResult.data ?? []) as Record<string, unknown>[]) {
    const pk = Math.trunc(Number(raw.game_pk));
    if (Number.isFinite(pk)) timeByPk.set(pk, (raw.game_time_et as string | null) ?? null);
  }

  const games: TrendsFeedItem[] = [];
  for (const [pk, { away, home }] of paired) {
    const angles = buildAngles(away, home);
    const gameDate = String(away.game_date_et ?? home.game_date_et ?? '').slice(0, 10);
    const time = timeByPk.get(pk) ?? null;

    games.push({
      sport: 'mlb',
      id: `mlb-${pk}`,
      away: resolveTeam(away, mapping),
      home: resolveTeam(home, mapping),
      gameDate,
      gameTimeLabel: formatEtTime(time),
      timeSortKey: timeSortKeyFor(gameDate, time),
      angles,
      verdict: buildVerdict(angles),
      scores: scoreAngles('mlb', angles),
    });
  }

  return { games, fetchedAt: Date.now() };
}
