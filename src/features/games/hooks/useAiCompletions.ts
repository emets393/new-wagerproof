import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGameCompletions } from '@/services/aiCompletionService';
import { areCompletionsEnabled } from '@/utils/aiCompletionSettings';
import debug from '@/utils/debug';
import type { SportType } from '@/types/sports';
import type { GamesSport } from '../types';

export type AiCompletionsMap = Record<string, Record<string, string>>;

/**
 * Per-game AI completion texts for the detail sections. Batched with
 * Promise.all (the legacy pages fetched serially per game). Disabled for MLB
 * (no completions) and when the sport's emergency toggle is off.
 */
export function useAiCompletions(sport: GamesSport, gameIds: string[]) {
  const enabled =
    sport !== 'mlb' && areCompletionsEnabled(sport as SportType) && gameIds.length > 0;

  const query = useQuery<AiCompletionsMap>({
    queryKey: ['ai-completions', sport, gameIds.join(',')],
    enabled,
    queryFn: async () => {
      const completionsMap: AiCompletionsMap = {};
      await Promise.all(
        gameIds.map(async (gameId) => {
          try {
            const completions = await getGameCompletions(gameId, sport as SportType);
            if (Object.keys(completions).length > 0) {
              completionsMap[gameId] = completions;
            }
          } catch (error) {
            debug.error(`Error fetching completions for ${gameId}:`, error);
          }
        })
      );
      return completionsMap;
    },
  });

  const queryClient = useQueryClient();
  // Called by AIPayloadViewer after generating a fresh completion for one game.
  const refreshGame = async (gameId: string) => {
    if (sport === 'mlb') return;
    try {
      const completions = await getGameCompletions(gameId, sport as SportType);
      queryClient.setQueryData<AiCompletionsMap>(
        ['ai-completions', sport, gameIds.join(',')],
        (prev) => ({ ...(prev ?? {}), [gameId]: completions })
      );
    } catch (error) {
      debug.error(`Error refreshing completions for ${gameId}:`, error);
    }
  };

  return { ...query, completions: query.data ?? {}, refreshGame };
}
