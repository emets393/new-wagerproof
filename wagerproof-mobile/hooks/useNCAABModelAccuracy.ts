import { useState, useEffect, useCallback } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { getNCAABTeamInitials } from '@/utils/teamColors';
import {
  GameAccuracyData,
  AccuracySortMode,
  roundToNearestHalf,
} from '@/types/modelAccuracy';

interface UseNCAABModelAccuracyResult {
  games: GameAccuracyData[];
  isLoading: boolean;
  error: string | null;
  sortMode: AccuracySortMode;
  setSortMode: (mode: AccuracySortMode) => void;
  refetch: () => Promise<void>;
}

type BucketMap = Map<string, { games: number; accuracy_pct: number }>;

function buildBucketMap(rows: any[]): BucketMap {
  const map: BucketMap = new Map();
  for (const r of rows) {
    map.set(`${r.edge_type}|${r.bucket}`, { games: r.games, accuracy_pct: r.accuracy_pct });
  }
  return map;
}

function lookupAccuracy(
  bucketMap: BucketMap,
  edgeType: string,
  bucketKey: number | null
): { games: number; accuracy_pct: number } | null {
  if (bucketKey === null) return null;
  return bucketMap.get(`${edgeType}|${bucketKey}`) ?? null;
}

function getBucketKeyForSpread(diff: number | null): number | null {
  if (diff === null || Number.isNaN(diff)) return null;
  return roundToNearestHalf(Math.abs(diff));
}

function getBucketKeyForOU(diff: number | null): number | null {
  if (diff === null || Number.isNaN(diff)) return null;
  return roundToNearestHalf(diff);
}

function getBucketKeyForML(homeWinProb: number | null, awayWinProb: number | null): number | null {
  const home = homeWinProb != null && !Number.isNaN(homeWinProb) ? homeWinProb : 0;
  const away = awayWinProb != null && !Number.isNaN(awayWinProb) ? awayWinProb : 0;
  const max = Math.max(home, away);
  if (max <= 0) return null;
  return Math.round(max * 20) / 20;
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function sortGames(games: GameAccuracyData[], mode: AccuracySortMode): GameAccuracyData[] {
  const byTime = (a: GameAccuracyData, b: GameAccuracyData) => {
    if (a.gameDate !== b.gameDate) return a.gameDate.localeCompare(b.gameDate);
    return (a.tipoffTime || '').localeCompare(b.tipoffTime || '');
  };

  if (mode === 'time') return [...games].sort(byTime);

  const accuracy = (g: GameAccuracyData): number => {
    if (mode === 'spread') return g.spreadAccuracy?.accuracy_pct ?? -1;
    if (mode === 'moneyline') return g.mlAccuracy?.accuracy_pct ?? -1;
    return g.ouAccuracy?.accuracy_pct ?? -1;
  };

  return [...games].sort((a, b) => {
    const diff = accuracy(b) - accuracy(a);
    return diff !== 0 ? diff : byTime(a, b);
  });
}

export function useNCAABModelAccuracy(): UseNCAABModelAccuracyResult {
  const [games, setGames] = useState<GameAccuracyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<AccuracySortMode>('time');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const today = getTodayET();

      const [
        { data: gamesData, error: gamesError },
        { data: latestRun },
        { data: bucketData, error: bucketError },
        { data: mappingData },
      ] = await Promise.all([
        collegeFootballSupabase
          .from('v_cbb_input_values')
          .select('*')
          .eq('game_date_et', today)
          .order('game_date_et', { ascending: true })
          .order('tipoff_time_et', { ascending: true }),
        collegeFootballSupabase
          .from('ncaab_predictions')
          .select('run_id, as_of_ts_utc')
          .order('as_of_ts_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),
        collegeFootballSupabase
          .from('ncaab_edge_accuracy_by_bucket')
          .select('edge_type, bucket, games, correct, accuracy_pct'),
        collegeFootballSupabase
          .from('ncaab_team_mapping')
          .select('api_team_id, espn_team_id, team_abbrev'),
      ]);

      if (gamesError) { setError(`Games: ${gamesError.message}`); return; }
      if (bucketError) { setError(`Edge accuracy: ${bucketError.message}`); return; }

      // Build team mapping
      const teamMap = new Map<number, { logoUrl: string; abbrev: string | null }>();
      for (const row of (mappingData || []) as any[]) {
        if (row.api_team_id == null) continue;
        const id = typeof row.api_team_id === 'string' ? parseInt(row.api_team_id, 10) : row.api_team_id;
        if (Number.isNaN(id)) continue;
        let logoUrl = '';
        if (row.espn_team_id != null && row.espn_team_id !== '') {
          const espnId = typeof row.espn_team_id === 'string' ? parseInt(row.espn_team_id, 10) : row.espn_team_id;
          if (!Number.isNaN(espnId)) logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;
        }
        teamMap.set(id, { logoUrl, abbrev: row.team_abbrev || null });
      }

      const bucketMap = buildBucketMap((bucketData || []) as any[]);
      const inputGames = (gamesData || []) as any[];

      if (inputGames.length === 0) {
        setGames([]);
        return;
      }

      // Fetch predictions for today's game IDs
      const gameIds = inputGames.map((g: any) => g.game_id);
      let predictionMap = new Map<number, any>();
      if (latestRun) {
        const { data: predictions } = await collegeFootballSupabase
          .from('ncaab_predictions')
          .select('game_id, home_win_prob, away_win_prob, pred_total_points, vegas_total, vegas_home_spread, model_fair_home_spread')
          .eq('run_id', latestRun.run_id)
          .in('game_id', gameIds);
        (predictions || []).forEach((p: any) => predictionMap.set(p.game_id, p));
      }

      const merged: GameAccuracyData[] = inputGames.map((game: any) => {
        const pred = predictionMap.get(game.game_id);
        const vegasHomeSpread = pred?.vegas_home_spread ?? game.spread ?? null;
        const modelFair = pred?.model_fair_home_spread ?? null;
        const homeSpreadDiff =
          vegasHomeSpread !== null && modelFair !== null ? vegasHomeSpread - modelFair : null;
        const vegasTotal = pred?.vegas_total ?? game.over_under ?? null;
        const predTotal = pred?.pred_total_points ?? null;
        const overLineDiff =
          vegasTotal !== null && predTotal !== null ? predTotal - vegasTotal : null;
        const homeWinProb = pred?.home_win_prob != null ? Number(pred.home_win_prob) : null;
        const awayWinProb = pred?.away_win_prob != null ? Number(pred.away_win_prob) : null;
        const mlBucketKey = getBucketKeyForML(homeWinProb, awayWinProb);
        const mlPickIsHome =
          homeWinProb != null && awayWinProb != null ? homeWinProb >= awayWinProb : null;

        const spreadBucketKey = getBucketKeyForSpread(homeSpreadDiff);
        const ouBucketKey = getBucketKeyForOU(overLineDiff);

        const awayTeamId = game.away_team_id != null ? Number(game.away_team_id) : null;
        const homeTeamId = game.home_team_id != null ? Number(game.home_team_id) : null;
        const awayMapping = awayTeamId != null ? teamMap.get(awayTeamId) : null;
        const homeMapping = homeTeamId != null ? teamMap.get(homeTeamId) : null;

        return {
          gameId: game.game_id,
          awayTeam: game.away_team ?? '',
          homeTeam: game.home_team ?? '',
          awayAbbr: awayMapping?.abbrev || getNCAABTeamInitials(game.away_team ?? ''),
          homeAbbr: homeMapping?.abbrev || getNCAABTeamInitials(game.home_team ?? ''),
          gameDate: game.game_date_et ?? '',
          tipoffTime: game.tipoff_time_et ?? null,
          homeSpread: vegasHomeSpread,
          homeSpreadDiff,
          spreadAccuracy: lookupAccuracy(bucketMap, 'SPREAD_EDGE', spreadBucketKey),
          homeWinProb,
          awayWinProb,
          mlPickIsHome,
          mlPickProbRounded: mlBucketKey,
          mlAccuracy: lookupAccuracy(bucketMap, 'MONEYLINE_PROB', mlBucketKey),
          overLine: vegasTotal,
          overLineDiff,
          ouAccuracy: lookupAccuracy(bucketMap, 'OU_EDGE', ouBucketKey),
          awayTeamLogo: awayMapping?.logoUrl || null,
          homeTeamLogo: homeMapping?.logoUrl || null,
        };
      });

      setGames(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedGames = sortGames(games, sortMode);

  return {
    games: sortedGames,
    isLoading,
    error,
    sortMode,
    setSortMode,
    refetch: fetchData,
  };
}
