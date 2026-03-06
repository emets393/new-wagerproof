import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { getNBATeamInitials, getNCAABTeamInitials } from '@/utils/teamColors';
import { GameAccuracyData, roundToNearestHalf } from '@/types/modelAccuracy';

// ── NBA cache ──────────────────────────────────────────────
let nbaCachedMap: Map<number, GameAccuracyData> | null = null;
let nbaFetchPromise: Promise<Map<number, GameAccuracyData>> | null = null;

async function fetchNBAAccuracy(): Promise<Map<number, GameAccuracyData>> {
  const { data: rows, error } = await collegeFootballSupabase
    .from('nba_todays_games_predictions_with_accuracy')
    .select('*');

  if (error || !rows) return new Map();

  const map = new Map<number, GameAccuracyData>();
  for (const row of rows as any[]) {
    const vegasHomeSpread = row.vegas_home_spread != null ? Number(row.vegas_home_spread) : null;
    const vegasTotal = row.vegas_total != null ? Number(row.vegas_total) : null;
    const modelFair = row.model_fair_home_spread != null ? Number(row.model_fair_home_spread) : null;
    const predTotal = row.pred_total_points != null ? Number(row.pred_total_points) : null;
    const homeSpreadDiff = vegasHomeSpread !== null && modelFair !== null ? vegasHomeSpread - modelFair : null;
    const overLineDiff = vegasTotal !== null && predTotal !== null ? predTotal - vegasTotal : null;
    const homeWinProb = row.home_win_prob != null ? Number(row.home_win_prob) : null;
    const awayWinProb = row.away_win_prob != null ? Number(row.away_win_prob) : null;
    const mlPickIsHome = row.model_ml_winner === 'home' ? true : row.model_ml_winner === 'away' ? false : null;

    const spreadAcc = row.spread_accuracy_pct != null && row.spread_bucket_games != null
      ? { games: Number(row.spread_bucket_games), accuracy_pct: Number(row.spread_accuracy_pct) } : null;
    const ouAcc = row.ou_accuracy_pct != null && row.ou_bucket_games != null
      ? { games: Number(row.ou_bucket_games), accuracy_pct: Number(row.ou_accuracy_pct) } : null;
    const mlAcc = row.ml_accuracy_pct != null && row.ml_bucket_games != null
      ? { games: Number(row.ml_bucket_games), accuracy_pct: Number(row.ml_accuracy_pct) } : null;

    map.set(row.game_id, {
      gameId: row.game_id,
      awayTeam: row.away_team ?? '',
      homeTeam: row.home_team ?? '',
      awayAbbr: getNBATeamInitials(row.away_team ?? ''),
      homeAbbr: getNBATeamInitials(row.home_team ?? ''),
      gameDate: row.game_date ?? '',
      tipoffTime: row.tipoff_time_et ?? null,
      homeSpread: vegasHomeSpread,
      homeSpreadDiff,
      spreadAccuracy: spreadAcc,
      homeWinProb,
      awayWinProb,
      mlPickIsHome,
      mlPickProbRounded: row.ml_bucket != null ? Number(row.ml_bucket) : null,
      mlAccuracy: mlAcc,
      overLine: vegasTotal,
      overLineDiff,
      ouAccuracy: ouAcc,
    });
  }
  return map;
}

function getNBAAccuracy(): Promise<Map<number, GameAccuracyData>> {
  if (nbaCachedMap) return Promise.resolve(nbaCachedMap);
  if (!nbaFetchPromise) {
    nbaFetchPromise = fetchNBAAccuracy().then((map) => {
      nbaCachedMap = map;
      nbaFetchPromise = null;
      return map;
    });
  }
  return nbaFetchPromise;
}

export function useNBAModelAccuracyForGame(gameId: number | undefined): {
  accuracy: GameAccuracyData | null;
  isLoading: boolean;
} {
  const [accuracy, setAccuracy] = useState<GameAccuracyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setIsLoading(false); return; }
    getNBAAccuracy().then((map) => {
      setAccuracy(map.get(gameId) ?? null);
      setIsLoading(false);
    });
  }, [gameId]);

  return { accuracy, isLoading };
}

// ── NCAAB cache ────────────────────────────────────────────
let ncaabCachedMap: Map<number, GameAccuracyData> | null = null;
let ncaabFetchPromise: Promise<Map<number, GameAccuracyData>> | null = null;

type BucketMap = Map<string, { games: number; accuracy_pct: number }>;

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

async function fetchNCAABAccuracy(): Promise<Map<number, GameAccuracyData>> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const [
    { data: gamesData, error: gamesError },
    { data: latestRun },
    { data: bucketData, error: bucketError },
    { data: mappingData },
  ] = await Promise.all([
    collegeFootballSupabase
      .from('v_cbb_input_values')
      .select('*')
      .eq('game_date_et', today),
    collegeFootballSupabase
      .from('ncaab_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle(),
    collegeFootballSupabase
      .from('ncaab_edge_accuracy_by_bucket')
      .select('edge_type, bucket, games, accuracy_pct'),
    collegeFootballSupabase
      .from('ncaab_team_mapping')
      .select('api_team_id, espn_team_id, team_abbrev'),
  ]);

  if (gamesError || bucketError) return new Map();

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

  const bucketMap: BucketMap = new Map();
  for (const r of (bucketData || []) as any[]) {
    bucketMap.set(`${r.edge_type}|${r.bucket}`, { games: r.games, accuracy_pct: r.accuracy_pct });
  }

  const inputGames = (gamesData || []) as any[];
  if (inputGames.length === 0) return new Map();

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

  const result = new Map<number, GameAccuracyData>();
  for (const game of inputGames) {
    const pred = predictionMap.get(game.game_id);
    const vegasHomeSpread = pred?.vegas_home_spread ?? game.spread ?? null;
    const modelFair = pred?.model_fair_home_spread ?? null;
    const homeSpreadDiff = vegasHomeSpread !== null && modelFair !== null ? vegasHomeSpread - modelFair : null;
    const vegasTotal = pred?.vegas_total ?? game.over_under ?? null;
    const predTotal = pred?.pred_total_points ?? null;
    const overLineDiff = vegasTotal !== null && predTotal !== null ? predTotal - vegasTotal : null;
    const homeWinProb = pred?.home_win_prob != null ? Number(pred.home_win_prob) : null;
    const awayWinProb = pred?.away_win_prob != null ? Number(pred.away_win_prob) : null;
    const mlBucketKey = getBucketKeyForML(homeWinProb, awayWinProb);
    const mlPickIsHome = homeWinProb != null && awayWinProb != null ? homeWinProb >= awayWinProb : null;

    const spreadBucketKey = getBucketKeyForSpread(homeSpreadDiff);
    const ouBucketKey = getBucketKeyForOU(overLineDiff);

    const awayTeamId = game.away_team_id != null ? Number(game.away_team_id) : null;
    const homeTeamId = game.home_team_id != null ? Number(game.home_team_id) : null;
    const awayMapping = awayTeamId != null ? teamMap.get(awayTeamId) : null;
    const homeMapping = homeTeamId != null ? teamMap.get(homeTeamId) : null;

    result.set(game.game_id, {
      gameId: game.game_id,
      awayTeam: game.away_team ?? '',
      homeTeam: game.home_team ?? '',
      awayAbbr: awayMapping?.abbrev || getNCAABTeamInitials(game.away_team ?? ''),
      homeAbbr: homeMapping?.abbrev || getNCAABTeamInitials(game.home_team ?? ''),
      gameDate: game.game_date_et ?? '',
      tipoffTime: game.tipoff_time_et ?? null,
      homeSpread: vegasHomeSpread,
      homeSpreadDiff,
      spreadAccuracy: spreadBucketKey !== null ? (bucketMap.get(`SPREAD_EDGE|${spreadBucketKey}`) ?? null) : null,
      homeWinProb,
      awayWinProb,
      mlPickIsHome,
      mlPickProbRounded: mlBucketKey,
      mlAccuracy: mlBucketKey !== null ? (bucketMap.get(`MONEYLINE_PROB|${mlBucketKey}`) ?? null) : null,
      overLine: vegasTotal,
      overLineDiff,
      ouAccuracy: ouBucketKey !== null ? (bucketMap.get(`OU_EDGE|${ouBucketKey}`) ?? null) : null,
      awayTeamLogo: awayMapping?.logoUrl || null,
      homeTeamLogo: homeMapping?.logoUrl || null,
    });
  }
  return result;
}

function getNCAABAccuracy(): Promise<Map<number, GameAccuracyData>> {
  if (ncaabCachedMap) return Promise.resolve(ncaabCachedMap);
  if (!ncaabFetchPromise) {
    ncaabFetchPromise = fetchNCAABAccuracy().then((map) => {
      ncaabCachedMap = map;
      ncaabFetchPromise = null;
      return map;
    });
  }
  return ncaabFetchPromise;
}

export function useNCAABModelAccuracyForGame(gameId: number | undefined): {
  accuracy: GameAccuracyData | null;
  isLoading: boolean;
} {
  const [accuracy, setAccuracy] = useState<GameAccuracyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setIsLoading(false); return; }
    getNCAABAccuracy().then((map) => {
      setAccuracy(map.get(gameId) ?? null);
      setIsLoading(false);
    });
  }, [gameId]);

  return { accuracy, isLoading };
}
