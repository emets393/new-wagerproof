import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GAMES_SPORTS, type GamesSport } from '../types';

const LAST_SPORT_KEY = 'wagerproof_games_last_sport';

function isGamesSport(value: string | null): value is GamesSport {
  return !!value && (GAMES_SPORTS as string[]).includes(value);
}

// Rough in-season default when the user has no saved sport.
function seasonDefaultSport(): GamesSport {
  const month = new Date().getMonth() + 1;
  if (month >= 4 && month <= 8) return 'mlb'; // Apr–Aug: baseball season
  if (month >= 9 && month <= 12) return 'nfl'; // fall: football
  return 'nba'; // Jan–Mar: basketball
}

/**
 * URL model for /games: ?sport=nfl&game=<id>. Sport falls back to the last
 * visited sport (localStorage), then a season-aware default. Selecting a game
 * pushes history (mobile back returns to the list); auto-select uses replace.
 */
export function useGamesUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSport = searchParams.get('sport');
  let sport: GamesSport;
  if (isGamesSport(rawSport)) {
    sport = rawSport;
  } else {
    const saved = localStorage.getItem(LAST_SPORT_KEY);
    sport = isGamesSport(saved) ? saved : seasonDefaultSport();
  }

  const selectedGameId = searchParams.get('game');

  const setSport = useCallback(
    (next: GamesSport) => {
      localStorage.setItem(LAST_SPORT_KEY, next);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('sport', next);
          params.delete('game'); // selection doesn't carry across sports
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const selectGame = useCallback(
    (gameId: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (gameId) {
            params.set('game', gameId);
          } else {
            params.delete('game');
          }
          return params;
        },
        { replace: options?.replace ?? false }
      );
    },
    [setSearchParams]
  );

  // Normalize the URL once so shared links always carry an explicit sport.
  const ensureSportInUrl = useCallback(() => {
    if (!isGamesSport(rawSport)) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('sport', sport);
          return params;
        },
        { replace: true }
      );
    }
  }, [rawSport, sport, setSearchParams]);

  return { sport, selectedGameId, setSport, selectGame, ensureSportInUrl };
}
