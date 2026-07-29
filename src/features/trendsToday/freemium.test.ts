import { describe, expect, it } from 'vitest';
import { FREE_TRENDS_GAME_COUNT, isFreemiumTrendLocked } from './freemium';
import type { TrendsFeedItem } from './types';

const games = ['first', 'second', 'third'].map((id) => ({ id }) as TrendsFeedItem);

describe('Today betting trends freemium gate', () => {
  it('keeps exactly the first two games free', () => {
    expect(FREE_TRENDS_GAME_COUNT).toBe(2);
    expect(isFreemiumTrendLocked(games, 'first', true)).toBe(false);
    expect(isFreemiumTrendLocked(games, 'second', true)).toBe(false);
    expect(isFreemiumTrendLocked(games, 'third', true)).toBe(true);
  });

  it('does not lock games for paid users', () => {
    expect(isFreemiumTrendLocked(games, 'third', false)).toBe(false);
  });
});
