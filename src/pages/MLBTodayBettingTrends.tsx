import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  espnMlb500LogoUrlFromAbbrev,
  mlbEspn500UrlFromSlug,
  mlbStatsApiTeamBrand,
} from '@/utils/mlbTeamLogos';

/** One row of `mlb_team_mapping`: join `mlb_situational_trends_today.team_id` = `mlb_api_id`. */
interface MlbTeamMapEntry {
  team: string;
  logo_url: string | null;
}

/** Row shape from `mlb_situational_trends_today` (percent fields may be numeric or string from PostgREST). */
interface MlbSituationalTrendRow {
  game_pk: number;
  game_date_et: string;
  team_id: number | string;
  team_name: string;
  team_side: 'home' | 'away';
  last_game_situation: string;
  home_away_situation: string | null;
  fav_dog_situation: string;
  rest_bucket: string;
  rest_comp: string;
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

interface MlbGameTrends {
  game_pk: number;
  game_date_et: string;
  game_time_et: string | null;
  away_team: MlbSituationalTrendRow;
  home_team: MlbSituationalTrendRow;
}

/** Avoid infinite onError loops: try ESPN CDN once after primary `src` fails. */
function mlbTrendsLogoImgOnError(e: React.SyntheticEvent<HTMLImageElement>, abbrev: string) {
  const el = e.currentTarget;
  if (el.getAttribute('data-logo-fb') === '1') {
    el.style.display = 'none';
    return;
  }
  el.setAttribute('data-logo-fb', '1');
  el.src = espnMlb500LogoUrlFromAbbrev(abbrev);
}

function toTrendPct(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(String(value).replace(/%/g, '').trim()) : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 1) return n * 100;
  return n;
}

function formatSituation(situation: string | null | undefined): string {
  if (!situation) return '—';
  const map: Record<string, string> = {
    is_after_loss: 'After loss',
    is_after_win: 'After win',
    is_fav: 'Favorite',
    is_dog: 'Underdog',
    is_home: 'Home',
    is_away: 'Away',
    is_home_fav: 'Home favorite',
    is_away_fav: 'Away favorite',
    is_home_dog: 'Home underdog',
    is_away_dog: 'Away underdog',
    one_day_off: '1 day off',
    two_three_days_off: '2–3 days off',
    four_plus_days_off: '4+ days off',
    no_rest: 'No rest',
    rest_advantage: 'Rest advantage',
    rest_disadvantage: 'Rest disadvantage',
    rest_equal: 'Equal rest',
    equal_rest: 'Equal rest',
    non_league: 'Non-league',
    non_division: 'Non-division',
    league: 'League',
    division: 'Division',
  };
  return map[situation] ?? situation.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatGameTimeEt(timeString: string | null): string {
  if (!timeString) return '';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getPercentageColor(pct: number | null): string {
  if (pct === null) return 'text-gray-500';
  if (pct > 55) return 'text-green-600 dark:text-green-400';
  if (pct < 45) return 'text-red-600 dark:text-red-400';
  return 'text-yellow-600 dark:text-yellow-400';
}

function isGreen(pct: number | null): boolean {
  return pct !== null && pct > 55;
}

function isYellow(pct: number | null): boolean {
  return pct !== null && pct >= 45 && pct <= 55;
}

function getMlConsensus(
  awayPct: number | null,
  homePct: number | null,
  awayTeamName: string,
  homeTeamName: string,
  awayAbbr: string,
  homeAbbr: string,
  awayLogo: string | null,
  homeLogo: string | null,
  awayTeamId: number,
  homeTeamId: number,
) {
  if (awayPct === null || homePct === null) return null;
  if (awayPct > homePct) {
    return { teamName: awayTeamName, teamAbbr: awayAbbr, logo: awayLogo, teamId: awayTeamId };
  }
  if (homePct > awayPct) {
    return { teamName: homeTeamName, teamAbbr: homeAbbr, logo: homeLogo, teamId: homeTeamId };
  }
  return null;
}

function getOuConsensusMlb(awayOver: number | null, homeOver: number | null): { type: 'over' | 'under' | 'no_consensus' } {
  const aG = isGreen(awayOver);
  const aY = isYellow(awayOver);
  const hG = isGreen(homeOver);
  const hY = isYellow(homeOver);
  const aLow = awayOver !== null && awayOver < 45;
  const hLow = homeOver !== null && homeOver < 45;

  if (aG && hG) {
    return { type: 'over' };
  }
  if (aLow && hLow) {
    return { type: 'under' };
  }
  if (aG && hY) return { type: 'over' };
  if (hG && aY) return { type: 'over' };
  if (aLow && hY) return { type: 'under' };
  if (hLow && aY) return { type: 'under' };
  if (aY && hY) return { type: 'no_consensus' };
  return { type: 'no_consensus' };
}

function winPctPairs(game: MlbGameTrends): [number | null, number | null][] {
  return [
    [toTrendPct(game.away_team.win_pct_last_game), toTrendPct(game.home_team.win_pct_last_game)],
    [toTrendPct(game.away_team.win_pct_home_away), toTrendPct(game.home_team.win_pct_home_away)],
    [toTrendPct(game.away_team.win_pct_fav_dog), toTrendPct(game.home_team.win_pct_fav_dog)],
    [toTrendPct(game.away_team.win_pct_rest_bucket), toTrendPct(game.home_team.win_pct_rest_bucket)],
    [toTrendPct(game.away_team.win_pct_rest_comp), toTrendPct(game.home_team.win_pct_rest_comp)],
    [toTrendPct(game.away_team.win_pct_league), toTrendPct(game.home_team.win_pct_league)],
    [toTrendPct(game.away_team.win_pct_division), toTrendPct(game.home_team.win_pct_division)],
  ];
}

function overPctPairs(game: MlbGameTrends): [number | null, number | null][] {
  return [
    [toTrendPct(game.away_team.over_pct_last_game), toTrendPct(game.home_team.over_pct_last_game)],
    [toTrendPct(game.away_team.over_pct_home_away), toTrendPct(game.home_team.over_pct_home_away)],
    [toTrendPct(game.away_team.over_pct_fav_dog), toTrendPct(game.home_team.over_pct_fav_dog)],
    [toTrendPct(game.away_team.over_pct_rest_bucket), toTrendPct(game.home_team.over_pct_rest_bucket)],
    [toTrendPct(game.away_team.over_pct_rest_comp), toTrendPct(game.home_team.over_pct_rest_comp)],
    [toTrendPct(game.away_team.over_pct_league), toTrendPct(game.home_team.over_pct_league)],
    [toTrendPct(game.away_team.over_pct_division), toTrendPct(game.home_team.over_pct_division)],
  ];
}

function calculateMlDominance(game: MlbGameTrends): number {
  let total = 0;
  const minDiff = 10;
  for (const [a, h] of winPctPairs(game)) {
    if (a !== null && h !== null && Math.abs(a - h) >= minDiff) {
      total += Math.abs(a - h);
    }
  }
  return total;
}

function calculateOuConsensusStrength(game: MlbGameTrends): number {
  let total = 0;
  for (const [a, h] of overPctPairs(game)) {
    if (a !== null && h !== null && a > 55 && h > 55) {
      total += a + h;
    }
    if (a !== null && h !== null && a < 45 && h < 45) {
      total += 200 - a - h;
    }
  }
  return total;
}

function buildTeamMapFromMappingRows(rows: Record<string, unknown>[]): Map<number, MlbTeamMapEntry> {
  const map = new Map<number, MlbTeamMapEntry>();
  for (const raw of rows) {
    const id = Math.trunc(Number(raw.mlb_api_id));
    if (!Number.isFinite(id) || Number.isNaN(id)) continue;
    const team = String(raw.team ?? '').trim();
    const logoRaw = raw.logo_url;
    const logo_url =
      logoRaw !== null && logoRaw !== undefined && String(logoRaw).trim() !== ''
        ? String(logoRaw).trim()
        : null;
    map.set(id, { team, logo_url });
  }
  return map;
}

export default function MLBTodayBettingTrends() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [games, setGames] = useState<MlbGameTrends[]>([]);
  /** `team_id` from situational table === `mlb_api_id` in mapping. */
  const [teamByMlbApiId, setTeamByMlbApiId] = useState<Map<number, MlbTeamMapEntry>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());
  const [highlightGamePk, setHighlightGamePk] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<'time' | 'ou-consensus' | 'ml-dominance'>('time');

  /** Abbrev + logo from official MLB `team_id` → Stats API brand (avoids wrong DB `team` / `logo_url`). */
  const teamDisplay = useCallback(
    (row: MlbSituationalTrendRow): { abbrev: string; logoSrc: string; teamId: number } => {
      const tid = Math.trunc(Number(row.team_id));
      const fallbackAbbrev = row.team_name?.trim().slice(0, 3).toUpperCase() || '?';
      if (!Number.isFinite(tid) || Number.isNaN(tid)) {
        return {
          abbrev: fallbackAbbrev,
          logoSrc: espnMlb500LogoUrlFromAbbrev(fallbackAbbrev),
          teamId: NaN,
        };
      }
      const brand = mlbStatsApiTeamBrand(tid);
      if (brand) {
        return {
          abbrev: brand.abbrev,
          logoSrc: mlbEspn500UrlFromSlug(brand.espnSlug),
          teamId: tid,
        };
      }
      const m = teamByMlbApiId.get(tid);
      const abbrev = m?.team?.trim() || fallbackAbbrev;
      const fromMap =
        m?.logo_url && String(m.logo_url).trim().startsWith('http') ? String(m.logo_url).trim() : '';
      return {
        abbrev,
        logoSrc: fromMap || espnMlb500LogoUrlFromAbbrev(abbrev),
        teamId: tid,
      };
    },
    [teamByMlbApiId],
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = collegeFootballSupabase
        .from('mlb_situational_trends_today')
        .select('*')
        .order('game_date_et', { ascending: true })
        .order('game_pk', { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        if (fetchError.code === '42P01' || fetchError.message.includes('does not exist')) {
          const { data: altData, error: altErr } = await collegeFootballSupabase
            .from('mlb_situational_trends')
            .select('*')
            .order('game_date_et', { ascending: true })
            .order('game_pk', { ascending: true });
          if (!altErr && altData?.length) {
            setError(
              `Table 'mlb_situational_trends_today' was not found; found 'mlb_situational_trends' with ${altData.length} rows. Confirm the today view exists in Supabase.`,
            );
            setLoading(false);
            return;
          }
        }
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const { data: mappingRows, error: mappingError } = await collegeFootballSupabase
        .from('mlb_team_mapping')
        .select('*');
      if (mappingError) {
        console.warn('[MLB trends] mlb_team_mapping:', mappingError.message);
      }
      const teamMap = buildTeamMapFromMappingRows((mappingRows || []) as Record<string, unknown>[]);
      setTeamByMlbApiId(teamMap);

      if (!data?.length) {
        setGames([]);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      const gamesMap = new Map<number, MlbGameTrends>();
      (data as MlbSituationalTrendRow[]).forEach((row) => {
        const pk = Number(row.game_pk);
        if (Number.isNaN(pk)) return;
        if (row.team_side !== 'away' && row.team_side !== 'home') return;

        if (!gamesMap.has(pk)) {
          gamesMap.set(pk, {
            game_pk: pk,
            game_date_et: row.game_date_et,
            game_time_et: null,
            away_team: row.team_side === 'away' ? row : ({} as MlbSituationalTrendRow),
            home_team: row.team_side === 'home' ? row : ({} as MlbSituationalTrendRow),
          });
        } else {
          const g = gamesMap.get(pk)!;
          if (row.team_side === 'away') g.away_team = row;
          if (row.team_side === 'home') g.home_team = row;
        }
      });

      const gamesArray = Array.from(gamesMap.values()).filter((g) => {
        const awayOk = g.away_team?.team_name && g.away_team.team_side === 'away';
        const homeOk = g.home_team?.team_name && g.home_team.team_side === 'home';
        return awayOk && homeOk;
      });

      const pks = gamesArray.map((g) => g.game_pk);
      if (pks.length > 0) {
        const { data: gameRows } = await collegeFootballSupabase
          .from('mlb_games_today')
          .select('game_pk, game_time_et')
          .in('game_pk', pks);
        const timeByPk = new Map<number, string | null>();
        (gameRows || []).forEach((r: Record<string, unknown>) => {
          const pk = Math.trunc(Number(r.game_pk));
          if (!Number.isNaN(pk)) {
            timeByPk.set(pk, (r.game_time_et as string | null | undefined) ?? null);
          }
        });
        gamesArray.forEach((g) => {
          g.game_time_et = timeByPk.get(g.game_pk) ?? null;
        });
      }

      const scored = gamesArray.map((g) => ({
        ...g,
        _ou: calculateOuConsensusStrength(g),
        _ml: calculateMlDominance(g),
      }));

      const sortFn = (a: typeof scored[0], b: typeof scored[0]) => {
        if (sortMode === 'ou-consensus') return b._ou - a._ou;
        if (sortMode === 'ml-dominance') return b._ml - a._ml;
        if (a.game_time_et && b.game_time_et) {
          return new Date(a.game_time_et).getTime() - new Date(b.game_time_et).getTime();
        }
        if (a.game_time_et && !b.game_time_et) return -1;
        if (!a.game_time_et && b.game_time_et) return 1;
        return String(a.game_date_et).localeCompare(String(b.game_date_et));
      };
      scored.sort(sortFn);
      setGames(scored.map(({ _ou, _ml, ...g }) => g));
      setLastUpdated(new Date());
    } catch {
      setError('An unexpected error occurred while loading MLB situational trends.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (games.length === 0) return;
    const param = searchParams.get('focusGamePk') ?? searchParams.get('focusGameId');
    if (!param) return;
    const pk = Number(param);
    if (!Number.isFinite(pk)) return;
    if (!games.some((g) => g.game_pk === pk)) return;

    setExpandedGames((prev) => new Set(prev).add(pk));
    setHighlightGamePk(pk);
    requestAnimationFrame(() => {
      document.querySelector(`[data-game-pk="${pk}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const t = window.setTimeout(() => {
      setHighlightGamePk((c) => (c === pk ? null : c));
    }, 2000);
    const next = new URLSearchParams(searchParams);
    next.delete('focusGamePk');
    next.delete('focusGameId');
    setSearchParams(next, { replace: true });
    return () => window.clearTimeout(t);
  }, [games, searchParams, setSearchParams]);

  useEffect(() => {
    setGames((prev) => {
      if (prev.length === 0) return prev;
      const scored = prev.map((g) => ({
        ...g,
        _ou: calculateOuConsensusStrength(g),
        _ml: calculateMlDominance(g),
      }));
      scored.sort((a, b) => {
        if (sortMode === 'ou-consensus') return b._ou - a._ou;
        if (sortMode === 'ml-dominance') return b._ml - a._ml;
        if (a.game_time_et && b.game_time_et) {
          return new Date(a.game_time_et).getTime() - new Date(b.game_time_et).getTime();
        }
        if (a.game_time_et && !b.game_time_et) return -1;
        if (!a.game_time_et && b.game_time_et) return 1;
        return String(a.game_date_et).localeCompare(String(b.game_date_et));
      });
      return scored.map(({ _ou, _ml, ...g }) => g);
    });
  }, [sortMode]);

  const toggleGame = (pk: number) => {
    setExpandedGames((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const renderSituationBlock = (
    label: string,
    game: MlbGameTrends,
    awaySit: string | null,
    homeSit: string | null,
    awayWin: number | string | null,
    homeWin: number | string | null,
    awayOver: number | string | null,
    homeOver: number | string | null,
  ) => {
    const awayW = toTrendPct(awayWin);
    const homeW = toTrendPct(homeWin);
    const awayO = toTrendPct(awayOver);
    const homeO = toTrendPct(homeOver);

    const awayV = teamDisplay(game.away_team);
    const homeV = teamDisplay(game.home_team);
    const awayAbbr = awayV.abbrev;
    const homeAbbr = homeV.abbrev;
    const awayLogo = awayV.logoSrc;
    const homeLogo = homeV.logoSrc;
    const awayName = game.away_team.team_name;
    const homeName = game.home_team.team_name;

    const mlConsensus = getMlConsensus(awayW, homeW, awayName, homeName, awayAbbr, homeAbbr, awayLogo, homeLogo, awayV.teamId, homeV.teamId);
    const ouConsensus = getOuConsensusMlb(awayO, homeO);

    const grid = 'grid grid-cols-[120px_200px_0_0_200px_0_0_auto] gap-1 text-sm items-center';

    return (
      <div className="space-y-2 py-3 border-b border-border last:border-b-0">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">{label}</h4>

        <div className={`${grid}`}>
          <div className="font-medium text-xs text-gray-700 dark:text-gray-300">Situation</div>
          <div className="pl-16 text-sm text-left min-w-0">{formatSituation(awaySit)}</div>
          <div />
          <div />
          <div className="pl-16 text-sm text-left min-w-0">{formatSituation(homeSit)}</div>
          <div />
          <div />
          <div className="flex items-center justify-center">
            {mlConsensus ? (
              <img
                key={`mlc-${game.game_pk}-${label}-${mlConsensus.teamId}`}
                src={mlConsensus.logo || espnMlb500LogoUrlFromAbbrev(mlConsensus.teamAbbr)}
                alt={mlConsensus.teamName}
                className="w-10 h-10 object-contain"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => mlbTrendsLogoImgOnError(e, mlConsensus.teamAbbr)}
              />
            ) : (
              <span className="text-sm text-gray-500">—</span>
            )}
          </div>
        </div>

        <div className={`${grid} mt-1`}>
          <div className="font-medium text-xs text-gray-700 dark:text-gray-300">ML (W%)</div>
          <div className="pl-16 text-sm text-left min-w-0">
            <span className={getPercentageColor(awayW)}>{awayW !== null ? `${awayW.toFixed(1)}%` : 'N/A'}</span>
          </div>
          <div />
          <div />
          <div className="pl-16 text-sm text-left min-w-0">
            <span className={getPercentageColor(homeW)}>{homeW !== null ? `${homeW.toFixed(1)}%` : 'N/A'}</span>
          </div>
          <div />
          <div />
          <div className="flex items-center justify-center">
            {mlConsensus ? (
              <span className="text-sm font-semibold text-white">{mlConsensus.teamAbbr}</span>
            ) : (
              <span className="text-sm text-gray-500">—</span>
            )}
          </div>
        </div>

        <div className={`${grid}`}>
          <div className="font-medium text-xs text-gray-700 dark:text-gray-300">Over %</div>
          <div className="pl-16 text-sm text-left min-w-0">
            <span className={getPercentageColor(awayO)}>{awayO !== null ? `${awayO.toFixed(1)}%` : 'N/A'}</span>
          </div>
          <div />
          <div />
          <div className="pl-16 text-sm text-left min-w-0">
            <span className={getPercentageColor(homeO)}>{homeO !== null ? `${homeO.toFixed(1)}%` : 'N/A'}</span>
          </div>
          <div />
          <div />
          <div className="flex items-center justify-center gap-1.5">
            {ouConsensus.type === 'over' && (
              <>
                <ArrowUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">Over</span>
              </>
            )}
            {ouConsensus.type === 'under' && (
              <>
                <ArrowDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                <span className="text-lg font-semibold text-red-600 dark:text-red-400">Under</span>
              </>
            )}
            {ouConsensus.type === 'no_consensus' && (
              <span className="text-base font-semibold text-gray-500">No consensus</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Today&apos;s betting trends</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Today&apos;s betting trends</h1>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Today&apos;s betting trends
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Situational moneyline and over rates for today&apos;s MLB games (from{' '}
            <code className="text-xs bg-muted px-1 rounded">mlb_situational_trends_today</code>)
            {lastUpdated && <span className="ml-2">• Last updated: {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              type="button"
              onClick={() => setSortMode('time')}
              variant={sortMode === 'time' ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
            >
              Game time
            </Button>
            <Button
              type="button"
              onClick={() => setSortMode('ou-consensus')}
              variant={sortMode === 'ou-consensus' ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
            >
              O/U consensus
            </Button>
            <Button
              type="button"
              onClick={() => setSortMode('ml-dominance')}
              variant={sortMode === 'ml-dominance' ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
            >
              ML dominance
            </Button>
          </div>
          <Button type="button" onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {games.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No situational trend rows for today. Confirm <code className="text-xs">mlb_situational_trends_today</code>{' '}
            has data for current slates.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => {
            const isExpanded = expandedGames.has(game.game_pk);
            const awayV = teamDisplay(game.away_team);
            const homeV = teamDisplay(game.home_team);
            const awayAbbr = awayV.abbrev;
            const homeAbbr = homeV.abbrev;
            const awayLogo = awayV.logoSrc;
            const homeLogo = homeV.logoSrc;

            return (
              <Card
                key={game.game_pk}
                data-game-pk={game.game_pk}
                className={`overflow-hidden transition-all ${
                  highlightGamePk === game.game_pk ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background' : ''
                }`}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleGame(game.game_pk)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <img
                              key={`h-${game.game_pk}-a-${game.away_team.team_id}`}
                              src={awayLogo}
                              alt={game.away_team.team_name}
                              className="w-8 h-8 object-contain"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(e) => mlbTrendsLogoImgOnError(e, awayAbbr)}
                            />
                            <span className="font-semibold">{awayAbbr}</span>
                          </div>
                          <span className="text-gray-400">@</span>
                          <div className="flex items-center gap-2">
                            <img
                              key={`h-${game.game_pk}-h-${game.home_team.team_id}`}
                              src={homeLogo}
                              alt={game.home_team.team_name}
                              className="w-8 h-8 object-contain"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(e) => mlbTrendsLogoImgOnError(e, homeAbbr)}
                            />
                            <span className="font-semibold">{homeAbbr}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {game.game_time_et
                              ? `${formatGameTimeEt(game.game_time_et)} ET`
                              : game.game_date_et}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-2">
                      <div className="text-xs text-muted-foreground mb-3">
                        Percentages are historical win / over rates for the current season in each listed spot (not model
                        projections).
                      </div>
                      <div className="grid grid-cols-[120px_200px_0_0_200px_0_0_auto] gap-1 mb-4 pb-3 border-b">
                        <div />
                        <div className="pl-16 text-left font-semibold text-lg text-white">{awayAbbr}</div>
                        <div />
                        <div />
                        <div className="pl-16 text-left font-semibold text-lg text-white">{homeAbbr}</div>
                        <div />
                        <div />
                        <div className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Consensus
                        </div>
                      </div>

                      {renderSituationBlock(
                        'Last game',
                        game,
                        game.away_team.last_game_situation,
                        game.home_team.last_game_situation,
                        game.away_team.win_pct_last_game,
                        game.home_team.win_pct_last_game,
                        game.away_team.over_pct_last_game,
                        game.home_team.over_pct_last_game,
                      )}
                      {renderSituationBlock(
                        'Home / away',
                        game,
                        game.away_team.home_away_situation,
                        game.home_team.home_away_situation,
                        game.away_team.win_pct_home_away,
                        game.home_team.win_pct_home_away,
                        game.away_team.over_pct_home_away,
                        game.home_team.over_pct_home_away,
                      )}
                      {renderSituationBlock(
                        'Favorite / underdog',
                        game,
                        game.away_team.fav_dog_situation,
                        game.home_team.fav_dog_situation,
                        game.away_team.win_pct_fav_dog,
                        game.home_team.win_pct_fav_dog,
                        game.away_team.over_pct_fav_dog,
                        game.home_team.over_pct_fav_dog,
                      )}
                      {renderSituationBlock(
                        'Rest bucket',
                        game,
                        game.away_team.rest_bucket,
                        game.home_team.rest_bucket,
                        game.away_team.win_pct_rest_bucket,
                        game.home_team.win_pct_rest_bucket,
                        game.away_team.over_pct_rest_bucket,
                        game.home_team.over_pct_rest_bucket,
                      )}
                      {renderSituationBlock(
                        'Rest vs opponent',
                        game,
                        game.away_team.rest_comp,
                        game.home_team.rest_comp,
                        game.away_team.win_pct_rest_comp,
                        game.home_team.win_pct_rest_comp,
                        game.away_team.over_pct_rest_comp,
                        game.home_team.over_pct_rest_comp,
                      )}
                      {renderSituationBlock(
                        'League',
                        game,
                        game.away_team.league_situation,
                        game.home_team.league_situation,
                        game.away_team.win_pct_league,
                        game.home_team.win_pct_league,
                        game.away_team.over_pct_league,
                        game.home_team.over_pct_league,
                      )}
                      {renderSituationBlock(
                        'Division',
                        game,
                        game.away_team.division_situation,
                        game.home_team.division_situation,
                        game.away_team.win_pct_division,
                        game.home_team.win_pct_division,
                        game.away_team.over_pct_division,
                        game.home_team.over_pct_division,
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
