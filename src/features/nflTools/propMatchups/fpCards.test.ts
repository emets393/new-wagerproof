import { describe, expect, it } from 'vitest';
import type { FpCards, FpRouteLeaf } from '@/features/propBreakdown/types';
import {
  formatPickLine,
  normalizePlayerPage,
  parseFpCards,
  rankPhrase,
  readRoute,
  sectionsFor,
} from './fpCards';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';

const cards = {
  routes: [{ route: 'Out', share: 0.2, routes: 4, games: 4, yards_per_route: 6 }],
  efficiency: { yards_per_route: 3.5, targets_per_route: 0.3 },
  role: { target_share: 0.3 },
  scheme: { player: { Man: { yards_per_route: 4, routes: 10, games: 4 } } },
  playsheet: { spots: { wide: { routes: 20, yards_per_route: 3 } } },
  throw_depth: { by: { Over20: { attempts: 4 } } },
  matchup: { vs_position: { rec_yds_actual: 40, rec_yds_rank: 4, rec_yds_of: 32 } },
  run_concept: { by: { Zone: { attempts: 8 } } },
  run_consistency: { runs_5plus: 0.2 },
  situational: { Inside10: { pass_rate: 0.46, snaps: 6 } },
  redzone: { him: { rz5_snap_share: 0.4 } },
  coverage: { by: { Cover3: { yards_per_route: 2 } } },
} as FpCards;

describe('rankPhrase', () => {
  it('reads from the near end of the league', () => {
    expect(rankPhrase(3, 32)).toBe('3rd-most of 32');
    expect(rankPhrase(23, 32)).toBe('10th-fewest of 32');
    expect(rankPhrase(1, 32)).toBe('1st-most of 32');
    expect(rankPhrase(32, 32)).toBe('1st-fewest of 32');
  });
});

describe('sectionsFor', () => {
  it('omits a section whose blob is absent', () => {
    const partial = { role: cards.role, matchup: cards.matchup } as FpCards;
    expect(sectionsFor('WR', 'player_reception_yds', partial)).toEqual(['role', 'vs_position']);
  });

  it('changes the frame with the market', () => {
    const receiving = sectionsFor('WR', 'player_reception_yds', cards);
    const receptions = sectionsFor('WR', 'player_receptions', cards);
    const rush = sectionsFor('RB', 'player_rush_yds', cards);
    const passTd = sectionsFor('QB', 'player_pass_tds', cards);
    const atd = sectionsFor('WR', 'player_anytime_td', cards);

    expect(receiving).not.toContain('run_concept');
    expect(receiving.indexOf('efficiency')).toBeGreaterThan(receiving.indexOf('routes'));
    expect(receptions[0]).toBe('efficiency');
    expect(rush).toEqual(['run_concept', 'run_consistency', 'role', 'script', 'vs_position']);
    expect(rush).not.toContain('routes');
    expect(passTd).toEqual(['redzone', 'script', 'vs_position']);
    expect(atd).toEqual(['redzone', 'vs_position', 'script']);
    expect(atd).not.toContain('routes');
  });

  it('returns nothing when the player has no cards', () => {
    expect(sectionsFor('WR', 'player_reception_yds', null)).toEqual([]);
  });
});

describe('readRoute', () => {
  const overall = 3.564;
  it('emphasises a pairing only when both samples are real and the defense leaks', () => {
    const out: FpRouteLeaf = {
      route: 'Out',
      routes: 4.25,
      games: 4,
      yards_per_route: 6.353,
      def_yards_per_route_actual: 2.571,
      def_routes_faced: 42,
      def_rank: 3,
      def_of: 32,
    };
    expect(readRoute(out, overall).highlight).toBe(true);
  });

  it('keeps a thin route, without emphasis', () => {
    const crossers: FpRouteLeaf = {
      route: 'Crossers',
      routes: 2.5,
      games: 4,
      yards_per_route: 5.1,
      def_routes_faced: 54,
      def_rank: 4,
      def_of: 32,
    };
    const read = readRoute(crossers, overall);
    expect(read.hisThin).toBe(true);
    expect(read.highlight).toBe(false);
  });

  it('treats 0 yards as a real number', () => {
    const post: FpRouteLeaf = { route: 'Post', routes: 2.75, games: 4, yards_per_route: 0 };
    expect(post.yards_per_route).toBe(0);
    expect(readRoute(post, overall).highlight).toBe(false);
  });
});

describe('normalizePlayerPage', () => {
  const row = {
    player_id: 'x',
    player_name: 'Test',
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
    highlights: [],
  } as NflPropPlayerPage;

  it('leaves missing blobs null and does not invent a rookie flag', () => {
    const page = normalizePlayerPage({
      ...row,
      projection: null,
      research: null,
      scheme_game_splits: null,
      fp_cards: null,
      rookie: null as unknown as boolean,
    });
    expect(page.projection).toBeNull();
    expect(page.research).toBeNull();
    expect(page.scheme_game_splits).toBeNull();
    expect(page.fp_cards).toBeNull();
    expect(page.rookie).toBeUndefined();
  });

  it('keeps a real route rank of 32 and a stored delta, without filling gaps', () => {
    const page = normalizePlayerPage({
      ...row,
      rookie: false,
      fp_cards: {
        routes: [{ route: 'Go', yards_per_route: 4.8, def_rank: 21, def_of: 32 }],
        role: {},
      },
    });
    expect(page.fp_cards?.routes?.[0]).toMatchObject({ route: 'Go', def_rank: 21, def_of: 32 });
    expect(page.fp_cards?.role).toBeUndefined();
    expect(page.rookie).toBe(false);
  });
});

describe('parseFpCards', () => {
  it('drops empty blobs so they are not rendered as zeroes', () => {
    expect(parseFpCards({ routes: [], role: { target_share: 0.2 }, scheme: {} })).toEqual({
      role: { target_share: 0.2 },
    });
  });

  it('decodes a blob that arrived as a JSON string', () => {
    const parsed = parseFpCards({ role: '{"snap_share":0.8}' });
    expect(parsed?.role?.snap_share).toBe(0.8);
  });
});

describe('formatPickLine', () => {
  it('does not print a null line on anytime touchdowns', () => {
    const text = formatPickLine({
      market: 'player_anytime_td',
      market_label: 'Anytime TD',
      side: 'over',
      line: null,
    });
    expect(text).toBe('Anytime TD · Over');
    expect(text.toLowerCase()).not.toContain('null');
  });
});
