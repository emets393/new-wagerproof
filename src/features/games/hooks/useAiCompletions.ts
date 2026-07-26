import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGameCompletions, getGameHeadlines } from '@/services/aiCompletionService';
import { areCompletionsEnabled } from '@/utils/aiCompletionSettings';
import debug from '@/utils/debug';
import type { SportType } from '@/types/sports';
import type { GamesSport } from '../types';

export type AiCompletionsMap = Record<string, Record<string, string>>;

interface AiCompletionsPayload {
  completions: AiCompletionsMap;
  /** Published headline verdicts, same [gameId][widgetType] shape. */
  headlines: AiCompletionsMap;
}

async function fetchForGames(sport: GamesSport, gameIds: string[]): Promise<AiCompletionsPayload> {
  const completions: AiCompletionsMap = {};
  const headlines: AiCompletionsMap = {};
  await Promise.all(
    gameIds.map(async (gameId) => {
      try {
        // Bodies and headlines live on the same row but are fetched separately —
        // headlines are QC-gated and bodies are not, so they can't share a filter.
        const [text, head] = await Promise.all([
          getGameCompletions(gameId, sport as SportType),
          getGameHeadlines(gameId, sport as SportType),
        ]);
        if (Object.keys(text).length > 0) completions[gameId] = text;
        if (Object.keys(head).length > 0) headlines[gameId] = head;
      } catch (error) {
        debug.error(`Error fetching completions for ${gameId}:`, error);
      }
    })
  );
  return { completions, headlines };
}

/**
 * Per-game AI completion texts and headline verdicts for the detail sections.
 * Batched with Promise.all (the legacy pages fetched serially per game).
 *
 * MLB used to be excluded here because it had no completion rows at all; it is
 * now generated like every other sport, so the only gate left is the sport's
 * emergency toggle.
 */
export function useAiCompletions(sport: GamesSport, gameIds: string[]) {
  const enabled = areCompletionsEnabled(sport as SportType) && gameIds.length > 0;

  const query = useQuery<AiCompletionsPayload>({
    queryKey: ['ai-completions', sport, gameIds.join(',')],
    enabled,
    queryFn: () => fetchForGames(sport, gameIds),
  });

  const queryClient = useQueryClient();
  // Called by AIPayloadViewer after generating a fresh completion for one game.
  const refreshGame = async (gameId: string) => {
    try {
      const fresh = await fetchForGames(sport, [gameId]);
      queryClient.setQueryData<AiCompletionsPayload>(
        ['ai-completions', sport, gameIds.join(',')],
        (prev) => ({
          completions: { ...(prev?.completions ?? {}), ...fresh.completions },
          headlines: { ...(prev?.headlines ?? {}), ...fresh.headlines },
        })
      );
    } catch (error) {
      debug.error(`Error refreshing completions for ${gameId}:`, error);
    }
  };

  return {
    ...query,
    completions: query.data?.completions ?? {},
    headlines: query.data?.headlines ?? {},
    refreshGame,
  };
}
