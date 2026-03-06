import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { SituationalTrendRow, NBAGameTrendsData } from '@/types/nbaBettingTrends';
import { NCAABSituationalTrendRow, NCAABGameTrendsData } from '@/types/ncaabBettingTrends';

// ── NBA cache ──────────────────────────────────────────────
let nbaCachedMap: Map<number, NBAGameTrendsData> | null = null;
let nbaFetchPromise: Promise<Map<number, NBAGameTrendsData>> | null = null;

async function fetchNBATrends(): Promise<Map<number, NBAGameTrendsData>> {
  let { data, error } = await collegeFootballSupabase
    .from('nba_game_situational_trends_today')
    .select('*')
    .order('game_date', { ascending: true })
    .order('game_id', { ascending: true });

  if (error || !data || data.length === 0) {
    const fallback = await collegeFootballSupabase
      .from('nba_game_situational_trends')
      .select('*')
      .order('game_date', { ascending: true })
      .order('game_id', { ascending: true });
    if (fallback.error) return new Map();
    data = fallback.data;
  }

  if (!data || data.length === 0) return new Map();

  const gamesMap = new Map<number, Partial<NBAGameTrendsData>>();
  data.forEach((row: SituationalTrendRow) => {
    if (row.team_side !== 'away' && row.team_side !== 'home') return;
    if (!gamesMap.has(row.game_id)) {
      gamesMap.set(row.game_id, {
        gameId: row.game_id,
        gameDate: row.game_date,
        tipoffTime: null,
        awayTeam: row.team_side === 'away' ? row : undefined,
        homeTeam: row.team_side === 'home' ? row : undefined,
      });
    } else {
      const game = gamesMap.get(row.game_id)!;
      if (row.team_side === 'away') game.awayTeam = row;
      else game.homeTeam = row;
    }
  });

  const result = new Map<number, NBAGameTrendsData>();
  gamesMap.forEach((game) => {
    if (game.awayTeam && game.homeTeam && game.gameId !== undefined && game.gameDate) {
      result.set(game.gameId!, game as NBAGameTrendsData);
    }
  });
  return result;
}

function getNBATrends(): Promise<Map<number, NBAGameTrendsData>> {
  if (nbaCachedMap) return Promise.resolve(nbaCachedMap);
  if (!nbaFetchPromise) {
    nbaFetchPromise = fetchNBATrends().then((map) => {
      nbaCachedMap = map;
      nbaFetchPromise = null;
      return map;
    });
  }
  return nbaFetchPromise;
}

export function useNBABettingTrendsForGame(gameId: number | undefined): {
  trends: NBAGameTrendsData | null;
  isLoading: boolean;
} {
  const [trends, setTrends] = useState<NBAGameTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setIsLoading(false); return; }
    getNBATrends().then((map) => {
      setTrends(map.get(gameId) ?? null);
      setIsLoading(false);
    });
  }, [gameId]);

  return { trends, isLoading };
}

// ── NCAAB cache ────────────────────────────────────────────
let ncaabCachedMap: Map<number, NCAABGameTrendsData> | null = null;
let ncaabFetchPromise: Promise<Map<number, NCAABGameTrendsData>> | null = null;

async function fetchNCAABTrends(): Promise<Map<number, NCAABGameTrendsData>> {
  let { data, error } = await collegeFootballSupabase
    .from('ncaab_game_situational_trends_today')
    .select('*')
    .order('game_date', { ascending: true })
    .order('game_id', { ascending: true });

  if (error || !data || data.length === 0) {
    const fallback = await collegeFootballSupabase
      .from('ncaab_game_situational_trends')
      .select('*')
      .order('game_date', { ascending: true })
      .order('game_id', { ascending: true });
    if (fallback.error) return new Map();
    data = fallback.data;
  }

  if (!data || data.length === 0) return new Map();

  const gamesMap = new Map<number, Partial<NCAABGameTrendsData>>();
  data.forEach((row: NCAABSituationalTrendRow) => {
    if (row.team_side !== 'away' && row.team_side !== 'home') return;
    if (!gamesMap.has(row.game_id)) {
      gamesMap.set(row.game_id, {
        gameId: row.game_id,
        gameDate: row.game_date,
        tipoffTime: null,
        awayTeam: row.team_side === 'away' ? row : undefined,
        homeTeam: row.team_side === 'home' ? row : undefined,
        awayTeamLogo: null,
        homeTeamLogo: null,
      });
    } else {
      const game = gamesMap.get(row.game_id)!;
      if (row.team_side === 'away') game.awayTeam = row;
      else game.homeTeam = row;
    }
  });

  const result = new Map<number, NCAABGameTrendsData>();
  gamesMap.forEach((game) => {
    if (game.awayTeam && game.homeTeam && game.gameId !== undefined && game.gameDate) {
      result.set(game.gameId!, game as NCAABGameTrendsData);
    }
  });
  return result;
}

function getNCAABTrends(): Promise<Map<number, NCAABGameTrendsData>> {
  if (ncaabCachedMap) return Promise.resolve(ncaabCachedMap);
  if (!ncaabFetchPromise) {
    ncaabFetchPromise = fetchNCAABTrends().then((map) => {
      ncaabCachedMap = map;
      ncaabFetchPromise = null;
      return map;
    });
  }
  return ncaabFetchPromise;
}

export function useNCAABBettingTrendsForGame(gameId: number | undefined): {
  trends: NCAABGameTrendsData | null;
  isLoading: boolean;
} {
  const [trends, setTrends] = useState<NCAABGameTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setIsLoading(false); return; }
    getNCAABTrends().then((map) => {
      setTrends(map.get(gameId) ?? null);
      setIsLoading(false);
    });
  }, [gameId]);

  return { trends, isLoading };
}
