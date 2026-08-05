import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** URL model for NFL prop matchups: `?game=<away-home-season-week>`. */
export function useNflPropMatchupsUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGameId = searchParams.get('game');

  const selectGame = useCallback(
    (gameId: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (gameId) params.set('game', gameId);
          else params.delete('game');
          return params;
        },
        { replace: options?.replace ?? false }
      );
    },
    [setSearchParams]
  );

  return { selectedGameId, selectGame };
}
