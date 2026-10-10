import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { FpCards, NflPropPlayerPage, NflPropSpotlight, TrendGameLogEntry } from '@/features/propBreakdown/types';
import { PlayerStatDetail } from './PlayerStatDetail';

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

function withWidth(width: number) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: width,
      matchMedia: () => ({
        matches: width >= 1024,
        addEventListener() {},
        removeEventListener() {},
      }),
    },
  });
}

const cards = {
  baseline: {
    rec_yds: { blended: 70.2, season_to_date: 56.25, prior_season: 84.06, games: 4, weight_this_season: 0.5, rookie: false },
    receptions: { blended: 4.2, season_to_date: 3.5, prior_season: 5.1, games: 4, weight_this_season: 0.5, rookie: false },
  },
  routes: [
    { route: 'Out', share: 0.11, routes: 4.25, games: 4, yards_per_route: 6.35, targets_per_route: 0.65, def_yards_per_route_actual: 2.57, def_routes_faced: 42, def_rank: 3, def_of: 32 },
    { route: 'Go', share: 0.24, routes: 9, games: 4, yards_per_route: 3.44, targets_per_route: 0.25, def_yards_per_route_actual: 1.01, def_routes_faced: 80, def_rank: 23, def_of: 32 },
  ],
  route_overall: { yards_per_route: 3.56 },
  role: { target_share: 0.3, routes_per_game: 34 },
  efficiency: { yards_per_route: 3.55, targets_per_route: 0.33, catchable_pct: 0.8 },
  scheme: { player: { Man: { yards_per_route: 4.1, routes: 12, games: 4 } } },
  playsheet: { spots: { wide: { yards_per_route: 3.2, routes: 20, games: 4 } } },
  matchup: { vs_position: { rec_yds_actual: 105.8, rec_yds_rank: 31, rec_yds_of: 32, games: 4, window: 'this season' } },
  run_concept: { by: { Zone: { attempts: 10, yards_per_attempt: 4.2 } } },
} as FpCards;

function page(extra: Partial<NflPropPlayerPage> = {}): NflPropPlayerPage {
  return {
    player_id: 'p1',
    season: 2026,
    week: 5,
    player_name: 'George Pickens',
    position: 'WR',
    team: 'DAL',
    opponent: 'TB',
    is_home: true,
    game_label: 'DAL vs TB',
    kickoff: null,
    headshot_url: null,
    markets: [
      { key: 'player_reception_yds', label: 'Receiving yards', line: 61.5, over_price: -110, under_price: -110, status: 'posted' },
      { key: 'player_receptions', label: 'Receptions', line: 4.5, over_price: -110, under_price: -110, status: 'posted' },
    ],
    baseline: { season: 2026, games: 4, rec_yds: 56 },
    ngs: null,
    scheme: null,
    highlights: [],
    fp_cards: cards,
    projection: { player_reception_yds: { kind: 'point', value: 66.2, n: 4, status: 'model', source: 'test' } },
    ...extra,
  };
}

const pick: NflPropSpotlight = {
  season: 2026,
  week: 5,
  player_id: 'p1',
  player_name: 'George Pickens',
  position: 'WR',
  team: 'DAL',
  opponent: 'TB',
  market: 'player_reception_yds',
  market_label: 'Receiving yards',
  side: 'over',
  line: 61.5,
  net: 3.5,
  n_for: 4,
  n_against: 0,
  board_rank: 4,
  narrative: 'His out route is the one Tampa have allowed.',
  tells: [
    { family: 'F1', dir: 'over', w: 1, src: 'routes', text: 'his top stacked route vs TB is the Out' },
    { family: 'F2', dir: 'context', w: 0, src: 'form', text: 'last 5 games average 46.8 receiving yards, context only' },
  ],
  result: null,
  actual_value: null,
};

function render(node: ReactElement) {
  return renderToStaticMarkup(node);
}

describe('PlayerStatDetail', () => {
  it('leads a spotlight player with the pick and keeps the tell text verbatim', () => {
    withWidth(1440);
    const html = render(
      <PlayerStatDetail page={page()} slate={[page()]} picks={[pick]} picksReady marketKey="player_reception_yds" onMarket={() => {}} onOpenBoard={() => {}} />,
    );
    expect(html).toContain('Spotlight pick');
    expect(html).toContain('Receiving yards 61.5 · Over');
    expect(html).toContain('4 reads agree, none disagree');
    expect(html).toContain('His out route is the one Tampa have allowed.');
    expect(html).toContain('his top stacked route vs TB is the Out');
    expect(html).toContain('last 5 games average 46.8 receiving yards, context only');
    expect(html).toContain('Pending');
    expect(html).toContain('How often he runs each route, and how this defense handles it');
    expect(html).toContain('6.35 vs 2.57 allowed');
    expect(html).toContain('2nd-fewest of 32');
    expect(html).toContain('70.2');
    expect(html).not.toContain('Run concepts');
    expect(html.toLowerCase()).not.toContain('projection');
    expect(html).not.toContain('66.2');
  });

  it('leads a rusher with carries and a receiver with the playsheet', () => {
    withWidth(1440);
    const receiver = render(
      <PlayerStatDetail page={page()} slate={[page()]} picks={[]} picksReady marketKey="player_receptions" onMarket={() => {}} onOpenBoard={() => {}} />,
    );
    expect(receiver).toContain('How often he runs each route');
    expect(receiver).not.toContain('Run concepts');

    const back = page({
      player_name: 'Aaron Jones',
      position: 'RB',
      markets: [{ key: 'player_rush_yds', label: 'Rushing yards', line: 72, over_price: -110, under_price: -110, status: 'posted' }],
      fp_cards: {
        baseline: { rush_yds: { blended: 63.3, season_to_date: 74.3, prior_season: 45.7, games: 4, weight_this_season: 0.62, rookie: false } },
        run_concept: { by: { Zone: { yards_per_attempt: 4.2, def_yards_per_attempt: 5.1, def_rank: 1, def_of: 32, attempts: 10 } } },
        run_consistency: { runs_1plus: 0.85, runs_5plus: 0.31 },
        routes: [{ route: 'Backfield', share: 0.7, routes: 13, games: 4, yards_per_route: 1.1, def_yards_per_route_actual: 1.1, def_routes_faced: 90, def_rank: 17, def_of: 32 }],
      } as FpCards,
    });
    const rusher = render(
      <PlayerStatDetail page={back} slate={[back]} picks={[]} picksReady marketKey="player_rush_yds" onMarket={() => {}} onOpenBoard={() => {}} />,
    );
    expect(rusher).toContain('63.3');
    expect(rusher).toContain('74.3 this season · 4 games · 62%');
    expect(rusher).toContain('45.7 last season');
    expect(rusher).toContain('Run concepts');
    expect(rusher).toContain('1st-most of 32');
    expect(rusher).toContain('How far a carry goes');
    expect(rusher).not.toContain('How often he runs each route');
  });

  it('draws the season, matchup, and game charts from the columns that are actually filled', () => {
    withWidth(390);
    const lamb = page({
      fp_cards: null,
      player_name: 'CeeDee Lamb',
      player_id: 'p2',
      opponent: 'NYG',
      baseline: { season: 2025, games: 13, rec_yds: 82.8 },
      ngs: { kind: 'receiving', adot: { v: 12.05, pctile: 67 }, separation: { v: 2.8, pctile: 42 } },
      scheme: {
        opponent: 'NYG',
        defense: {
          identity: 'BLITZ-HAPPY',
          man: { rate: 0.28, pctile: 41 },
          pressure: { rate: 0.38, pctile: 97 },
          blitz: { rate: 0.49, pctile: 88 },
        },
        player_splits: {
          man: { ypt: 9.2, pctile: 94, targets: 369, sample: 'ok' },
          zone: { ypt: 8.5, pctile: 70, targets: 510, sample: 'ok' },
        },
      },
      scheme_game_splits: {
        window: '2024-2025 games',
        applicable: ['blitz_heavy'],
        overall: { n: 32, rec_yds: 86.53 },
        splits: { blitz_heavy: { n: 7, rec_yds: 94.43 } },
      },
    });
    const log: TrendGameLogEntry[] = [
      { opp: 'HOU', week: 4, season: 2026, actuals: { player_reception_yds: 100 } },
      { opp: 'BAL', week: 3, season: 2026, actuals: { player_reception_yds: 80 } },
    ];
    const html = render(
      <PlayerStatDetail
        page={lamb}
        slate={[page(), lamb]}
        picks={[pick]}
        picksReady
        marketKey="player_reception_yds"
        onMarket={() => {}}
        onOpenBoard={() => {}}
        log={log}
      />,
    );
    expect(html).toContain('82.8');
    expect(html).toContain('Last 10');
    expect(html).toContain('HOU');
    expect(html).toContain('Where he sits');
    expect(html).toContain('aDOT');
    expect(html).toContain('CeeDee is not on the board');
    expect(html).toContain('1 of 2 players are');
    expect(html).not.toContain('How often he runs each route');
    expect(html).not.toContain('Spotlight pick');
  });

  it('does not print a null line for an anytime touchdown', () => {
    withWidth(1440);
    const atd: NflPropSpotlight = {
      ...pick,
      market: 'player_anytime_td',
      market_label: 'Anytime TD',
      side: 'over',
      line: null,
      narrative: null,
    };
    const html = render(
      <PlayerStatDetail
        page={page({
          markets: [{ key: 'player_anytime_td', label: 'Anytime TD', line: null, over_price: -110, under_price: null, status: 'posted' }],
          fp_cards: { redzone: { him: { rz5_snap_share: 0.62 } }, situational: { Inside10: { pass_rate: 0.46, snaps: 6.5, pass_rate_rank: 19, pass_rate_of: 32 } } } as FpCards,
        })}
        slate={[page()]}
        picks={[atd]}
        picksReady
        marketKey="player_anytime_td"
        onMarket={() => {}}
        onOpenBoard={() => {}}
      />,
    );
    expect(html).toContain('Anytime TD · Over');
    expect(html.toLowerCase()).not.toContain('null');
    expect(html).toContain('Red zone');
    expect(html).toContain('Inside the 10');
    expect(html).not.toContain('Route tree');
  });
});
