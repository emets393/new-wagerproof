import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type PropsSport = 'mlb' | 'nfl';

function isPropsSport(value: string | null): value is PropsSport {
  return value === 'mlb' || value === 'nfl';
}

export function usePropsUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSport = searchParams.get('sport');
  const sport: PropsSport = isPropsSport(rawSport) ? rawSport : 'mlb';
  const selectedGameId = searchParams.get('game');
  const selectedPlayerId = searchParams.get('player');

  const setSport = useCallback((next: PropsSport) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', next);
      params.delete('game');
      params.delete('player');
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

  const selectPlayer = useCallback((playerId: string | null, options?: { replace?: boolean }) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      if (playerId) params.set('player', playerId);
      else params.delete('player');
      return params;
    }, { replace: options?.replace ?? false });
  }, [setSearchParams, sport]);

  const ensureSportInUrl = useCallback(() => {
    if (isPropsSport(rawSport)) return;
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set('sport', sport);
      return params;
    }, { replace: true });
  }, [rawSport, setSearchParams, sport]);

  return { sport, selectedGameId, selectedPlayerId, setSport, selectGame, selectPlayer, ensureSportInUrl };
}
