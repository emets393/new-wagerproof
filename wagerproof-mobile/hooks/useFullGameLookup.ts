import { useState, useEffect } from 'react';
import { fetchNBAPredictions, fetchNCAABPredictions } from '@/services/gameDataService';
import { NBAGame } from '@/types/nba';
import { NCAABGame } from '@/types/ncaab';

// ── NBA cache ──────────────────────────────────────────────
let nbaCachedMap: Map<number, NBAGame> | null = null;
let nbaFetchPromise: Promise<Map<number, NBAGame>> | null = null;

async function fetchNBAMap(): Promise<Map<number, NBAGame>> {
  const games = await fetchNBAPredictions();
  const map = new Map<number, NBAGame>();
  for (const g of games) map.set(g.game_id, g);
  return map;
}

function getNBAMap(): Promise<Map<number, NBAGame>> {
  if (nbaCachedMap) return Promise.resolve(nbaCachedMap);
  if (!nbaFetchPromise) {
    nbaFetchPromise = fetchNBAMap().then((map) => {
      nbaCachedMap = map;
      nbaFetchPromise = null;
      return map;
    });
  }
  return nbaFetchPromise;
}

export function useNBAFullGame(gameId: number | undefined): {
  game: NBAGame | null;
  isLoading: boolean;
} {
  const [game, setGame] = useState<NBAGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setIsLoading(false); return; }
    getNBAMap().then((map) => {
      setGame(map.get(gameId) ?? null);
      setIsLoading(false);
    });
  }, [gameId]);

  return { game, isLoading };
}

export async function lookupNBAFullGame(gameId: number): Promise<NBAGame | null> {
  const map = await getNBAMap();
  return map.get(gameId) ?? null;
}

// ── NCAAB cache ────────────────────────────────────────────
let ncaabCachedMap: Map<number, NCAABGame> | null = null;
let ncaabFetchPromise: Promise<Map<number, NCAABGame>> | null = null;

async function fetchNCAABMap(): Promise<Map<number, NCAABGame>> {
  const games = await fetchNCAABPredictions();
  const map = new Map<number, NCAABGame>();
  for (const g of games) map.set(g.game_id, g);
  return map;
}

function getNCAABMap(): Promise<Map<number, NCAABGame>> {
  if (ncaabCachedMap) return Promise.resolve(ncaabCachedMap);
  if (!ncaabFetchPromise) {
    ncaabFetchPromise = fetchNCAABMap().then((map) => {
      ncaabCachedMap = map;
      ncaabFetchPromise = null;
      return map;
    });
  }
  return ncaabFetchPromise;
}

export function useNCAABFullGame(gameId: number | undefined): {
  game: NCAABGame | null;
  isLoading: boolean;
} {
  const [game, setGame] = useState<NCAABGame | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setIsLoading(false); return; }
    getNCAABMap().then((map) => {
      setGame(map.get(gameId) ?? null);
      setIsLoading(false);
    });
  }, [gameId]);

  return { game, isLoading };
}

export async function lookupNCAABFullGame(gameId: number): Promise<NCAABGame | null> {
  const map = await getNCAABMap();
  return map.get(gameId) ?? null;
}
