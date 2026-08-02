import { describe, expect, it } from 'vitest';
import {
  SLATE_CLOSE_LABEL,
  buildLineMarkets,
  isSlateCloseFallback,
  slateScalars,
  type LineConsensusSnap,
  type LineMarket,
  type LineMarketId,
} from './lineMovement';
import type { TeamRef } from '../../../types';

const team = (abbrev: string, name: string): TeamRef => ({
  abbrev,
  name,
  colors: { primary: '#123456', secondary: '#654321' },
} as TeamRef);

const UAB = team('UAB', 'UAB');
const ILL = team('ILL', 'Illinois');

/** UAB @ Illinois, 2026 week 1 — the live spot-check game. */
const SLATE_ROW = {
  fg_spread_open: -27.5,
  fg_total_open: 56.5,
  fg_spread_close: -27.5,
  fg_total_close: 56.5,
  fg_ml_home_close: -7000,
  fg_ml_away_close: 2000,
  // Early-season CFB: no team-total or 1H markets posted.
  tt_home_close: null,
  tt_away_close: null,
  h1_spread_close: null,
  h1_total_close: null,
  h1_ml_home_close: null,
  h1_ml_away_close: null,
};

const snap = (over: Partial<LineConsensusSnap> = {}): LineConsensusSnap => ({
  snap_ts: '2026-07-26T02:33:33.651981+00:00',
  n_books: 9,
  fg_spread_home: -27.5,
  fg_total: 56.5,
  tt_home: null,
  tt_away: null,
  h1_spread_home: null,
  h1_total: null,
  ...over,
});

const build = (history: LineConsensusSnap[]): LineMarket[] =>
  buildLineMarkets({
    away: UAB,
    home: ILL,
    history,
    scalars: slateScalars(SLATE_ROW),
    includeEmpty: true,
  });

const byId = (markets: LineMarket[], id: LineMarketId): LineMarket => {
  const found = markets.find((m) => m.id === id);
  if (!found) throw new Error(`no market ${id}`);
  return found;
};

describe('buildLineMarkets', () => {
  it('labels a market backed by the movement view as live', () => {
    const markets = build([snap(), snap({ snap_ts: '2026-07-29T13:47:27Z', n_books: 10 })]);

    const spread = byId(markets, 'spread_home');
    expect(spread.current).toBe(-27.5);
    expect(spread.currentLabel).toBe('Now');
    expect(isSlateCloseFallback(spread)).toBe(false);
    expect(spread.latestBookCount).toBe(10);

    const total = byId(markets, 'total');
    expect(total.current).toBe(56.5);
    expect(total.currentLabel).toBe('Now');
  });

  it('orients the away spread against the home line', () => {
    const markets = build([snap()]);
    expect(byId(markets, 'spread_away').current).toBe(27.5);
    expect(byId(markets, 'spread_home').current).toBe(-27.5);
  });

  it('never presents the slate close as the current line', () => {
    // Moneyline has no column in either movement view.
    const markets = build([snap()]);

    const mlHome = byId(markets, 'ml_home');
    expect(mlHome.current).toBe(-7000);
    expect(mlHome.currentLabel).toBe(SLATE_CLOSE_LABEL);
    expect(isSlateCloseFallback(mlHome)).toBe(true);
    expect(mlHome.seriesNote).toMatch(/not archived/i);
    // A book count would imply a live consensus read.
    expect(mlHome.latestBookCount).toBeNull();
  });

  it('falls back to the slate close when the view returns nothing', () => {
    const markets = build([]);

    const spread = byId(markets, 'spread_home');
    expect(spread.open).toBe(-27.5);
    expect(spread.current).toBe(-27.5);
    expect(spread.currentLabel).toBe(SLATE_CLOSE_LABEL);
    expect(spread.history).toEqual([]);
    expect(spread.notPosted).toBe(false);
  });

  it('marks unposted early-season markets rather than inventing a number', () => {
    const markets = build([snap()]);

    for (const id of ['h1_spread_home', 'h1_total', 'h1_ml_home', 'tt_home'] as LineMarketId[]) {
      const market = byId(markets, id);
      expect(market.notPosted, `${id} should be unposted`).toBe(true);
      expect(market.open).toBeNull();
      expect(market.current).toBeNull();
      expect(market.history).toEqual([]);
    }
  });

  it('keeps every toggle group present so the market list is stable', () => {
    const groups = new Set(build([snap()]).map((m) => m.group));
    expect([...groups].sort()).toEqual(
      ['h1_ml', 'h1_spread', 'h1_total', 'ml', 'spread', 'total', 'tt'].sort(),
    );
  });

  it('surfaces NFL markets that the view does carry', () => {
    const markets = buildLineMarkets({
      away: UAB,
      home: ILL,
      history: [snap({ tt_home: 24.5, tt_away: 20.5, h1_spread_home: -1.5, h1_total: 21.5 })],
      scalars: slateScalars(SLATE_ROW),
      includeEmpty: true,
    });

    expect(byId(markets, 'tt_home').currentLabel).toBe('Now');
    expect(byId(markets, 'h1_spread_away').current).toBe(1.5);
    expect(byId(markets, 'h1_total').current).toBe(21.5);
    expect(byId(markets, 'h1_total').notPosted).toBe(false);
  });
});
