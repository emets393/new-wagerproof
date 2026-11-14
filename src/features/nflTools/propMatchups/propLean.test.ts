import { describe, expect, it } from 'vitest';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { LEAN_MIN_POP, bestMarket, playerHasLean, scoreMarket } from './propLean';

function page(overrides: Partial<NflPropPlayerPage> = {}): NflPropPlayerPage {
  return {
    player_id: 'p',
    season: 2026,
    week: 5,
    player_name: 'Test Player',
    position: 'WR',
    team: 'LA',
    opponent: 'BUF',
    is_home: false,
    game_label: null,
    kickoff: null,
    headshot_url: null,
    markets: [
      { key: 'player_reception_yds', label: 'Receiving yards', line: 60, over_price: -110, under_price: -110, status: 'posted' },
      { key: 'player_pass_tds', label: 'Pass TDs', line: 1.5, over_price: -120, under_price: -110, status: 'posted' },
    ],
    baseline: { season: 2025, games: 10, rec_yds: 70, pass_td: 2 },
    ngs: null,
    scheme: null,
    highlights: [],
    projection: null,
    ...overrides,
  };
}

describe('prop lean', () => {
  it('tags a unanimous 4-reading market and ignores a 3-reading majority', () => {
    const unanimous = page({
      projection: { player_reception_yds: { kind: 'point', value: 80, n: 4, status: 'model', source: 'test' } },
      fp_cards: {
        matchup: { vs_position: { rec_yds_actual: 90, rec_yds_league: 70 } },
        routes: [{ routes: 10, def_yards_per_route_actual: 2, def_yards_per_route_league: 1 }],
      },
      scheme: {
        opponent: 'BUF',
        defense: { identity: 'MAN', man: { rate: 0.4, pctile: 10 } },
        kind: 'receiving',
        player_overall: { ypt: 8, targets: 100, pctile: 50 },
        player_splits: { man: { ypt: 10, targets: 40, pctile: 60 } },
      },
    });
    const scored = scoreMarket(unanimous, 'player_reception_yds');
    expect(scored.populated).toBeGreaterThanOrEqual(4);
    expect(scored.lean).toBe(true);
    expect(scored.direction).toBe('over');
    expect(bestMarket(unanimous)?.market).toBe('player_reception_yds');
    expect(playerHasLean(unanimous)).toBe(true);

    const thin = page({
      projection: { player_reception_yds: { kind: 'point', value: 80, n: 4, status: 'model', source: 'test' } },
      fp_cards: { matchup: { vs_position: { rec_yds_actual: 90, rec_yds_league: 70 } } },
    });
    expect(scoreMarket(thin, 'player_reception_yds').populated).toBe(3);
    expect(scoreMarket(thin, 'player_reception_yds').lean).toBe(false);
    expect(bestMarket(thin)?.market).toBe('player_reception_yds');
  });

  it('abstains inside the dead zone and never tags pass touchdowns', () => {
    const close = page({
      baseline: { season: 2025, games: 10, rec_yds: 61 },
      projection: { player_reception_yds: { kind: 'point', value: 61, n: 4, status: 'model', source: 'test' } },
    });
    const votes = scoreMarket(close, 'player_reception_yds');
    expect(votes.readings.filter((row) => row.vote !== 0)).toHaveLength(0);
    expect(bestMarket(close)).toBeNull();

    const tds = page({
      projection: { player_pass_tds: { kind: 'point', value: 2.4, n: 4, status: 'model', source: 'test' } },
      fp_cards: { matchup: { vs_position: { pass_td_actual: 2, pass_td_league: 1 } } },
    });
    expect(scoreMarket(tds, 'player_pass_tds').populated).toBeLessThan(LEAN_MIN_POP);
    expect(scoreMarket(tds, 'player_pass_tds').lean).toBe(false);
    expect(playerHasLean(tds)).toBe(false);
  });

  it('picks the more one-sided market, then the one with more readings', () => {
    const row = page({
      markets: [
        { key: 'player_reception_yds', label: 'Receiving yards', line: 60, over_price: -110, under_price: -110, status: 'posted' },
        { key: 'player_receptions', label: 'Receptions', line: 5, over_price: -110, under_price: -110, status: 'posted' },
      ],
      baseline: { season: 2025, games: 10, rec_yds: 80, receptions: 8 },
      projection: {
        player_reception_yds: { kind: 'point', value: 40, n: 4, status: 'model', source: 'test' },
        player_receptions: { kind: 'point', value: 8, n: 4, status: 'model', source: 'test' },
      },
      fp_cards: {
        matchup: {
          vs_position: {
            rec_yds_actual: 40,
            rec_yds_league: 70,
            receptions_actual: 8,
            receptions_league: 5,
          },
        },
      },
    });
    expect(bestMarket(row)?.market).toBe('player_receptions');
  });
});
