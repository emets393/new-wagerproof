import type { TrendsFeedItem } from './types';

export const FREE_TRENDS_GAME_COUNT = 2;

export function isFreemiumTrendLocked(
  games: TrendsFeedItem[],
  gameId: string,
  isFreemiumUser: boolean,
) {
  if (!isFreemiumUser) return false;
  const gameIndex = games.findIndex((game) => game.id === gameId);
  return gameIndex >= FREE_TRENDS_GAME_COUNT;
}
