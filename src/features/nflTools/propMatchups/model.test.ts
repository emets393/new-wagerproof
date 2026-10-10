import { describe, expect, it } from 'vitest';
import type { NflPropPlayerPage, PropHighlight } from '@/features/propBreakdown/types';
import { browseNflPropPlayers, compareNflPropPlayers, leanStrength } from './model';

function highlight(direction: 'up' | 'down'): PropHighlight {
  return { kind: 'scheme', direction, markets: [], text: 'signal' };
}

function player(
  playerId: string,
  playerName: string,
  highlights: PropHighlight[] = [],
): NflPropPlayerPage {
  return {
    player_id: playerId,
    player_name: playerName,
    season: 2026,
    week: 5,
    position: 'WR',
    team: 'PHI',
    opponent: 'DAL',
    is_home: true,
    game_label: null,
    kickoff: null,
    headshot_url: null,
    markets: [],
    baseline: null,
    ngs: null,
    scheme: null,
    highlights,
  };
}

describe('leanStrength', () => {
  it('counts highlights that all point the same way', () => {
    expect(leanStrength([highlight('up'), highlight('up'), highlight('up')])).toEqual({ direction: 'up', count: 3 });
    expect(leanStrength([highlight('down')])).toEqual({ direction: 'down', count: 1 });
  });

  it('rejects a mix and an empty list', () => {
    expect(leanStrength([highlight('up'), highlight('up'), highlight('down')])).toBeNull();
    expect(leanStrength([])).toBeNull();
    expect(leanStrength(null)).toBeNull();
  });
});

describe('compareNflPropPlayers', () => {
  const spotlight = player('spot', 'Zed Spotlight');
  const leanThree = player('lean3', 'Zoe Lean', [highlight('up'), highlight('up'), highlight('up')]);
  const leanOne = player('lean1', 'Amy Lean', [highlight('down')]);
  const mixed = player('mixed', 'Mia Mixed', [highlight('up'), highlight('down')]);
  const plain = player('plain', 'Ben Plain');
  const ranks = new Map<string, number>([['spot', 4]]);
  const leans = new Set(['lean3', 'lean1']);

  it('puts a spotlight pick ahead of a lean, then sorts each group by name', () => {
    expect(compareNflPropPlayers(leanThree, spotlight, ranks, leans)).toBeGreaterThan(0);
    expect(compareNflPropPlayers(spotlight, leanThree, ranks, leans)).toBeLessThan(0);
    expect(compareNflPropPlayers(leanOne, leanThree, ranks, leans)).toBeLessThan(0);
    expect(compareNflPropPlayers(leanOne, mixed, ranks, leans)).toBeLessThan(0);
  });

  it('sorts everyone else by name, with no score inside a group', () => {
    const ordered = [mixed, plain, leanThree, spotlight, leanOne].sort((a, b) => compareNflPropPlayers(a, b, ranks, leans));
    expect(ordered.map((row) => row.player_id)).toEqual(['spot', 'lean1', 'lean3', 'plain', 'mixed']);
  });

  it('filters the week list, and a search ignores the active filter', () => {
    const roster = [spotlight, leanThree, leanOne, mixed, plain];
    const games = new Map([['plain', 'nyj-bal-2026-5']]);
    expect(browseNflPropPlayers(roster, 'spotlight', '', ranks, () => null, leans).map((row) => row.player_id)).toEqual(['spot']);
    expect(browseNflPropPlayers(roster, 'leans', '', ranks, () => null, leans).map((row) => row.player_id)).toEqual(['lean1', 'lean3']);
    expect(browseNflPropPlayers(roster, 'g:nyj-bal-2026-5', '', ranks, () => null, leans, games).map((row) => row.player_id)).toEqual(['plain']);
    expect(browseNflPropPlayers(roster, 'spotlight', 'mia', ranks, () => null, leans).map((row) => row.player_id)).toEqual(['mixed']);
  });

  it('orders two spotlight picks alphabetically, not by board rank', () => {
    const later = player('later', 'Amy');
    const earlier = player('earlier', 'Zoe');
    const board = new Map<string, number>([['later', 8], ['earlier', 1]]);
    expect(compareNflPropPlayers(later, earlier, board)).toBeLessThan(0);
  });
});
