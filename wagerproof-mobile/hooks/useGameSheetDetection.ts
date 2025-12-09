/**
 * useGameSheetDetection Hook
 *
 * Detects when any game sheet (NFL, CFB, NBA, NCAAB) is open
 * and provides the current game data and sport type.
 * Used by the floating WagerBot assistant to auto-scan game details.
 */

import { useEffect, useRef } from 'react';
import { useNFLGameSheet } from '@/contexts/NFLGameSheetContext';
import { useCFBGameSheet } from '@/contexts/CFBGameSheetContext';
import { useNBAGameSheet } from '@/contexts/NBAGameSheetContext';
import { useNCAABGameSheet } from '@/contexts/NCAABGameSheetContext';
import { NFLPrediction } from '@/types/nfl';
import { CFBPrediction } from '@/types/cfb';
import { NBAGame } from '@/types/nba';
import { NCAABGame } from '@/types/ncaab';

export type Sport = 'nfl' | 'cfb' | 'nba' | 'ncaab';
export type GameData = NFLPrediction | CFBPrediction | NBAGame | NCAABGame;

interface GameSheetDetectionResult {
  /** The currently open game, or null if no game sheet is open */
  openGame: GameData | null;
  /** The sport of the currently open game */
  sport: Sport | null;
  /** Whether any game sheet is currently open */
  isGameSheetOpen: boolean;
  /** Previous game that was open (for detecting changes) */
  previousGame: GameData | null;
}

/**
 * Hook to detect when a game details sheet is opened across any sport.
 * Returns the current game data, sport type, and open state.
 */
export function useGameSheetDetection(): GameSheetDetectionResult {
  const nfl = useNFLGameSheet();
  const cfb = useCFBGameSheet();
  const nba = useNBAGameSheet();
  const ncaab = useNCAABGameSheet();

  // Track the previous game to detect changes
  const previousGameRef = useRef<GameData | null>(null);

  // Determine which game sheet is currently open (if any)
  const openGame = nfl.selectedGame || cfb.selectedGame ||
                   nba.selectedGame || ncaab.selectedGame || null;

  // Determine the sport based on which context has a selected game
  const sport: Sport | null = nfl.selectedGame ? 'nfl' :
                              cfb.selectedGame ? 'cfb' :
                              nba.selectedGame ? 'nba' :
                              ncaab.selectedGame ? 'ncaab' : null;

  const isGameSheetOpen = !!openGame;

  // Update previous game ref when game changes
  useEffect(() => {
    if (openGame !== previousGameRef.current) {
      previousGameRef.current = openGame;
    }
  }, [openGame]);

  return {
    openGame,
    sport,
    isGameSheetOpen,
    previousGame: previousGameRef.current,
  };
}

/**
 * Hook that calls a callback when a new game sheet is opened.
 * Useful for triggering auto-scan when navigating to game details.
 */
export function useOnGameSheetOpen(
  callback: (game: GameData, sport: Sport) => void,
  enabled: boolean = true
) {
  const { openGame, sport, isGameSheetOpen } = useGameSheetDetection();
  const previousGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !isGameSheetOpen || !openGame || !sport) {
      return;
    }

    // Get a unique identifier for the game
    const gameId = getGameId(openGame);

    // Only trigger callback if this is a new game (not the same one)
    if (gameId !== previousGameIdRef.current) {
      previousGameIdRef.current = gameId;
      callback(openGame, sport);
    }
  }, [openGame, sport, isGameSheetOpen, enabled, callback]);

  // Reset when game sheet closes
  useEffect(() => {
    if (!isGameSheetOpen) {
      previousGameIdRef.current = null;
    }
  }, [isGameSheetOpen]);
}

/**
 * Helper to get a unique ID from any game type
 */
function getGameId(game: GameData): string {
  return String(
    (game as any).id ||
    (game as any).unique_id ||
    (game as any).training_key ||
    (game as any).game_id ||
    `${game.away_team}_${game.home_team}`
  );
}
