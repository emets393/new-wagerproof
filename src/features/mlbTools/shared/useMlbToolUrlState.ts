import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * URL model for the per-game MLB tool split views: `?game=<game_pk>`. Simpler
 * than /games or /todays-trends because these tools are MLB-only — there is no
 * sport axis to carry, just the selection.
 */
export function useMlbToolUrlState() {
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
        // Desktop auto-select replaces so Back doesn't bounce through it; an
        // explicit tap pushes so mobile's back button pops the detail.
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  return { selectedGameId, selectGame };
}
