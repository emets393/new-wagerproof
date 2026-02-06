import { useCallback } from 'react';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import {
  fetchNFLPredictions,
  fetchCFBPredictions,
  fetchNBAPredictions,
  fetchNCAABPredictions,
} from '@/services/gameDataService';
import { Sport } from '@/types/agent';

/**
 * Hook that provides a function to look up a game by sport + game_id
 * and open the corresponding game bottom sheet.
 *
 * Returns false if the game couldn't be found (e.g., historical game
 * no longer in prediction tables).
 */
export function useGameLookup() {
  const { openGameSheet: openNFLSheet } = useNFLGameSheet();
  const { openGameSheet: openCFBSheet } = useCFBGameSheet();
  const { openGameSheet: openNBASheet } = useNBAGameSheet();
  const { openGameSheet: openNCAABSheet } = useNCAABGameSheet();

  const openGameForPick = useCallback(
    async (sport: Sport, gameId: string): Promise<boolean> => {
      try {
        switch (sport) {
          case 'nfl': {
            const games = await fetchNFLPredictions();
            const game = games.find(
              (g) =>
                g.training_key === gameId ||
                g.unique_id === gameId ||
                `${g.away_team}_${g.home_team}` === gameId,
            );
            if (game) {
              openNFLSheet(game);
              return true;
            }
            return false;
          }
          case 'cfb': {
            const games = await fetchCFBPredictions();
            const game = games.find(
              (g) =>
                g.unique_id === gameId ||
                g.training_key === gameId ||
                `${g.away_team}_${g.home_team}` === gameId,
            );
            if (game) {
              openCFBSheet(game);
              return true;
            }
            return false;
          }
          case 'nba': {
            const games = await fetchNBAPredictions();
            const game = games.find(
              (g) =>
                String(g.game_id) === gameId ||
                g.training_key === gameId ||
                g.unique_id === gameId,
            );
            if (game) {
              openNBASheet(game);
              return true;
            }
            return false;
          }
          case 'ncaab': {
            const games = await fetchNCAABPredictions();
            const game = games.find(
              (g) =>
                String(g.game_id) === gameId ||
                g.training_key === gameId ||
                g.unique_id === gameId,
            );
            if (game) {
              openNCAABSheet(game);
              return true;
            }
            return false;
          }
          default:
            return false;
        }
      } catch (error) {
        console.error('Error looking up game:', error);
        return false;
      }
    },
    [openNFLSheet, openCFBSheet, openNBASheet, openNCAABSheet],
  );

  return { openGameForPick };
}
