import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGameCompletions } from '@/services/aiCompletionService';
import { areCompletionsEnabled } from '@/utils/aiCompletionSettings';
import debug from '@/utils/debug';
import type { SportType } from '@/types/sports';
import type { GamesSport } from '../types';

export type AiCompletionsMap = Record<string, Record<string, string>>;

async function fetchForGames(sport: GamesSport, gameIds: string[]): Promise<AiCompletionsMap> {
  const completions: AiCompletionsMap = {};
  await Promise.all(
    gameIds.map(async (gameId) => {
      try {
        const text = await getGameCompletions(gameId, sport as SportType);
        if (Object.keys(text).length > 0) completions[gameId] = text;
      } catch (error) {
        debug.error(`Error fetching completions for ${gameId}:`, error);
      }
    })
  );
  return completions;
}

/**
 * Per-game AI completion bodies for the detail sections. Batched with
 * Promise.all (the legacy pages fetched serially per game).
 *
 * Headlines are NOT fetched here: the one-line verdicts are deterministic and
 * computed client-side in `../detail/headlines/`. See `.claude/docs/17_widget_headlines.md`.
 *
 * MLB used to be excluded here because it had no completion rows at all; it is
 * now generated like every other sport, so the only gate left is the sport's
 * emergency toggle.
 */
export function useAiCompletions(sport: GamesSport, gameIds: string[]) {
  const enabled = areCompletionsEnabled(sport as SportType) && gameIds.length > 0;

  const query = useQuery<AiCompletionsMap>({
    queryKey: ['ai-completions', sport, gameIds.join(',')],
    enabled,
    queryFn: () => fetchForGames(sport, gameIds),
  });

  const queryClient = useQueryClient();
  // Called by AIPayloadViewer after generating a fresh completion for one game.
  const refreshGame = async (gameId: string) => {
    try {
      const fresh = await fetchForGames(sport, [gameId]);
      queryClient.setQueryData<AiCompletionsMap>(
        ['ai-completions', sport, gameIds.join(',')],
        (prev) => ({ ...(prev ?? {}), ...fresh })
      );
    } catch (error) {
      debug.error(`Error refreshing completions for ${gameId}:`, error);
    }
  };

  return {
    ...query,
    completions: query.data ?? {},
    refreshGame,
  };
}
