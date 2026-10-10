import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type PropsSport = 'mlb' | 'nfl';
export type PropsPanel = 'games' | 'board';
export type PropsBrowse = 'matchups' | 'players';
export type PropsFocus = 'all' | 'spotlight' | 'leans';
export type PropsRail = 'spotlight' | 'leans' | 'all' | `g:${string}`;

function readRail(params: URLSearchParams): PropsRail {
  const rail = params.get('rail');
  if (rail === 'leans' || rail === 'all' || rail === 'spotlight') return rail;
  if (rail?.startsWith('g:') && rail.length > 2) return rail as `g:${string}`;
  if (params.get('focus') === 'leans') return 'leans';
  if (params.get('focus') === 'all') return 'all';
  return 'spotlight';
}

function isPropsSport(value: string | null): value is PropsSport {
  return value === 'mlb' || value === 'nfl';
}

export function usePropsUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSport = searchParams.get('sport');
  const sport: PropsSport = isPropsSport(rawSport) ? rawSport : 'mlb';
  const selectedGameId = searchParams.get('game');
  const selectedPlayerId = searchParams.get('player');
  const rawPanel = searchParams.get('panel');
  const panel: PropsPanel = rawPanel === 'games' || rawPanel === 'board'
    ? rawPanel
    : sport === 'nfl' ? 'board' : 'games';
  const market = searchParams.get('market');
  const browse: PropsBrowse = searchParams.get('browse') === 'players' ? 'players' : 'matchups';
  const rawFocus = searchParams.get('focus');
  const focus: PropsFocus = rawFocus === 'spotlight' || rawFocus === 'leans' ? rawFocus : 'all';
  const rail = readRail(searchParams);

  const setSport = useCallback((next: PropsSport) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', next);
      params.delete('game');
      params.delete('player');
      params.delete('market');
      params.delete('panel');
      params.delete('browse');
      params.delete('focus');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const selectGame = useCallback((gameId: string | null, options?: { replace?: boolean }) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      if (gameId) params.set('game', gameId);
      else params.delete('game');
      return params;
    }, { replace: options?.replace ?? false });
  }, [setSearchParams, sport]);

  const selectPlayer = useCallback((playerId: string | null, options?: { replace?: boolean; market?: string | null; gameId?: string | null; rail?: PropsRail }) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      if (options?.gameId) params.set('game', options.gameId);
      if (options?.rail) {
        if (options.rail === 'spotlight') params.delete('rail');
        else params.set('rail', options.rail);
        params.delete('focus');
        params.delete('browse');
      }
      if (playerId) {
        params.set('player', playerId);
        if (options && 'market' in options) {
          if (options.market) params.set('market', options.market);
          else params.delete('market');
        } else {
          params.delete('market');
        }
      } else {
        params.delete('player');
        params.delete('market');
      }
      return params;
    }, { replace: options?.replace ?? false });
  }, [setSearchParams, sport]);

  const setBrowse = useCallback((next: PropsBrowse) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      if (next === 'players') params.set('browse', 'players');
      else params.delete('browse');
      return params;
    }, { replace: true });
  }, [setSearchParams, sport]);

  const setFocus = useCallback((next: PropsFocus) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      if (next === 'all') params.delete('focus');
      else params.set('focus', next);
      return params;
    }, { replace: true });
  }, [setSearchParams, sport]);

  const setRail = useCallback((next: PropsRail) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      if (next === 'spotlight') params.delete('rail');
      else params.set('rail', next);
      params.delete('focus');
      params.delete('browse');
      return params;
    }, { replace: true });
  }, [setSearchParams, sport]);

  const setPanel = useCallback((next: PropsPanel) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      params.set('panel', next);
      params.delete('player');
      params.delete('market');
      return params;
    }, { replace: true });
  }, [setSearchParams, sport]);

  const openPick = useCallback((next: { gameId: string | null; playerId: string; market: string }) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      params.set('panel', 'board');
      if (next.gameId) params.set('game', next.gameId);
      else params.delete('game');
      params.set('player', next.playerId);
      params.set('market', next.market);
      return params;
    }, { replace: false });
  }, [setSearchParams, sport]);

  const ensureSportInUrl = useCallback(() => {
    if (isPropsSport(rawSport)) return;
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      return params;
    }, { replace: true });
  }, [rawSport, setSearchParams, sport]);

  return { sport, panel, market, browse, focus, rail, selectedGameId, selectedPlayerId, setSport, setPanel, setBrowse, setFocus, setRail, selectGame, selectPlayer, openPick, ensureSportInUrl };
}
