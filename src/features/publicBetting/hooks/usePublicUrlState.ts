import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BoardSort, PublicMarket, SportFilter, TierFilter } from '../types';
import { PUBLIC_MARKETS, PUBLIC_SPORTS } from '../types';

function isSport(value: string | null): value is SportFilter {
  return value === 'all' || (value !== null && (PUBLIC_SPORTS as string[]).includes(value));
}

function isMarket(value: string | null): value is PublicMarket {
  return value !== null && (PUBLIC_MARKETS as string[]).includes(value);
}

function isSort(value: string | null): value is BoardSort {
  return value === 'sharp' || value === 'time' || value === 'tickets' || value === 'money' || value === 'diff';
}

/**
 * `?sport=&market=&signal=sharp|all&game=`. An absent sport stays unset until
 * the board loads, so the page can land on the in-season league. An explicit
 * `sport=all` is kept. `tier` is read once so older links still open.
 */
export function usePublicUrlState(landing: SportFilter | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSport = searchParams.get('sport');
  const sportExplicit = isSport(rawSport) ? rawSport : null;
  const sport: SportFilter = sportExplicit ?? landing ?? 'nfl';
  const rawMarket = searchParams.get('market');
  const rawSignalParam = searchParams.get('signal');
  const rawLegacyTier = searchParams.get('tier');
  const rawSignal = rawSignalParam ?? rawLegacyTier;
  const market: PublicMarket = isMarket(rawMarket) ? rawMarket : 'spread';
  const tier: TierFilter = rawSignal === 'sharp' ? 'sharp' : 'all';
  const rawSort = searchParams.get('sort');
  const sort: BoardSort = isSort(rawSort) ? rawSort : 'sharp';
  const selectedGameId = searchParams.get('game');

  const setSport = useCallback(
    (next: SportFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('sport', next);
          params.delete('game');
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setMarket = useCallback(
    (next: PublicMarket) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('market', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (next: BoardSort) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'sharp') params.delete('sort');
          else params.set('sort', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setTier = useCallback(
    (next: TierFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete('tier');
          params.set('signal', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const selectGame = useCallback(
    (gameId: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (gameId) params.set('game', gameId);
          else params.delete('game');
          return params;
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const ensureFiltersInUrl = useCallback(() => {
    const sportOk = isSport(rawSport);
    const marketOk = isMarket(rawMarket);
    const signalOk = rawSignal === 'sharp' || rawSignal === 'all';
    if (sportOk && marketOk && signalOk && rawLegacyTier === null && rawSignalParam !== null) return;
    // An absent sport waits for the board so the landing league can be written.
    if (!sportOk && !landing) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (!isSport(params.get('sport'))) params.set('sport', landing ?? 'nfl');
        if (!isMarket(params.get('market'))) params.set('market', 'spread');
        params.delete('tier');
        const nextSignal = params.get('signal');
        if (nextSignal !== 'sharp' && nextSignal !== 'all') params.set('signal', 'all');
        return params;
      },
      { replace: true },
    );
  }, [landing, rawLegacyTier, rawMarket, rawSignal, rawSignalParam, rawSport, setSearchParams]);

  return {
    sport,
    market,
    tier,
    sort,
    selectedGameId,
    sportExplicit,
    setSport,
    setMarket,
    setTier,
    setSort,
    selectGame,
    ensureFiltersInUrl,
  };
}
