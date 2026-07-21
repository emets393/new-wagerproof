import { describe, it, expect } from 'vitest';
import type {
  MLBTeamTrendRecord,
  MLBTrendsSlateBundle,
  OutliersTrendsGame,
  OutliersTrendsMLBContext,
  TrendSplitCell,
} from '@/features/outliers/types';
import type { MlbPlayerPropRow } from '@/types/mlb-player-props';
import type { ParlayGodCategory, ParlayGodPropMatchup, ParlayLeg, ParlayLegKind } from './types';
import {
  MARKET_CAP,
  ODDS_FLOOR,
  ALT_LINE_MIN_STREAK,
  MIN_SAMPLE,
  assemble,
  americanText,
  combinedOddsText,
  decimalOdds,
  propLegs,
  slateTickets,
  teamLegs,
} from './engine';

// MARK: - Fixture builders

function ctx(over: Partial<OutliersTrendsMLBContext> = {}): OutliersTrendsMLBContext {
  return {
    homeMl: -150,
    awayMl: 130,
    homeSpread: -1.5,
    awaySpread: 1.5,
    totalLine: 8.5,
    f5HomeMl: -120,
    f5AwayMl: 100,
    f5HomeSpread: -0.5,
    f5AwaySpread: 0.5,
    f5TotalLine: 4.5,
    homeSpreadOdds: 120,
    awaySpreadOdds: -140,
    totalOverOdds: -110,
    totalUnderOdds: -110,
    f5HomeSpreadOdds: -115,
    f5AwaySpreadOdds: -105,
    f5TotalOverOdds: -110,
    f5TotalUnderOdds: -110,
    isDivisional: false,
    isDayGame: false,
    seriesGameNumber: null,
    ...over,
  };
}

function game(mlbContext: OutliersTrendsMLBContext): OutliersTrendsGame {
  return {
    id: '777',
    season: 2026,
    week: 0,
    awayAb: 'BOS',
    homeAb: 'NYY',
    awayTeam: 'Boston Red Sox',
    homeTeam: 'New York Yankees',
    fgSpreadClose: null,
    fgTotalClose: null,
    kickoff: '2026-07-20T19:05',
    slot: null,
    assignedReferee: null,
    mlbContext,
  };
}

/** Perfect-win cell (h of h) or arbitrary split when h < n. */
function cell(h: number, n: number, p = 0): TrendSplitCell {
  return { h, l: n - h, p, n, pct: n > 0 ? h / n : 0 };
}

function bundle(homeSplits: MLBTeamTrendRecord['splits'], mlbCtx = ctx()): MLBTrendsSlateBundle {
  const record: MLBTeamTrendRecord = {
    teamAbbr: 'NYY',
    teamName: 'New York Yankees',
    season: 2026,
    throughDate: null,
    splits: homeSplits,
    matchups: {},
  };
  return { games: [game(mlbCtx)], season: 2026, throughDate: null, teams: [record] };
}

function propMatchup(row: MlbPlayerPropRow): ParlayGodPropMatchup {
  return {
    gamePk: 777,
    awayAbbr: 'BOS',
    homeAbbr: 'NYY',
    gameTimeEt: '2026-07-20T19:05',
    teamByPlayerId: new Map([[1, 'NYY']]),
    props: [row],
  };
}

function propRow(values: number[], lines: MlbPlayerPropRow['lines']): MlbPlayerPropRow {
  return {
    player_id: 1,
    player_name: 'Aaron Judge',
    is_pitcher: false,
    market: 'batter_hits',
    game_is_day: false,
    opp_archetype_today: null,
    lines,
    games: values.map((v) => ({ v, d: 0 as const, a: null })),
  };
}

function mkLeg(p: {
  id: string;
  gameKey: string;
  subject: string;
  betText: string;
  odds: number;
  streakN: number;
  marketKey: string;
  category?: ParlayGodCategory;
  kind?: ParlayLegKind;
  backedTeamAbbr?: string | null;
  totalsFamily?: string | null;
  totalsSide?: string | null;
}): ParlayLeg {
  return {
    id: p.id,
    kind: p.kind ?? 'team',
    category: p.category ?? 'teamForm',
    gameKey: p.gameKey,
    matchupLabel: 'BOS @ NYY',
    gameTimeEt: null,
    subject: p.subject,
    teamAbbr: null,
    playerId: null,
    headshotUrl: null,
    betText: p.betText,
    odds: p.odds,
    evidence: '',
    streakN: p.streakN,
    marketKey: p.marketKey,
    backedTeamAbbr: p.backedTeamAbbr ?? null,
    totalsFamily: p.totalsFamily ?? null,
    totalsSide: p.totalsSide ?? null,
  };
}

// MARK: - Odds math

describe('odds math', () => {
  it('converts american to decimal', () => {
    expect(decimalOdds(-110)).toBeCloseTo(1.909090909, 6);
    expect(decimalOdds(150)).toBeCloseTo(2.5, 6);
  });

  it('converts decimal back to american text with sign', () => {
    expect(americanText(2.5)).toBe('+150');
    expect(americanText(1.5)).toBe('-200');
    expect(americanText(1.0)).toBe('-'); // degenerate — no positive payout
  });

  it('multiplies decimal odds for a combined price', () => {
    // two -110 legs → 1.90909^2 ≈ 3.6446 → +264
    const legs = [
      mkLeg({ id: 'a', gameKey: '1', subject: 'A', betText: 'A', odds: -110, streakN: 5, marketKey: 'ml' }),
      mkLeg({ id: 'b', gameKey: '2', subject: 'B', betText: 'B', odds: -110, streakN: 5, marketKey: 'ml' }),
    ];
    expect(combinedOddsText(legs)).toBe('+264');
  });
});

// MARK: - Streak qualification (team legs)

describe('teamLegs — streak qualification', () => {
  it('emits a leg only for a perfect N-of-N window and prefers the largest N', () => {
    const legs = teamLegs(bundle({ ml: { overall: { '3': cell(3, 3), '8': cell(8, 8) } } }));
    expect(legs).toHaveLength(1);
    expect(legs[0].category).toBe('teamForm');
    expect(legs[0].betText).toBe('NYY ML');
    expect(legs[0].streakN).toBe(8); // largest perfect window wins
    expect(legs[0].odds).toBe(-150);
  });

  it(`rejects sub-100% cells and samples under ${MIN_SAMPLE}`, () => {
    const legs = teamLegs(
      // n=2 perfect (too small) + n=4 at 75% (not perfect) → nothing qualifies
      bundle({ ml: { overall: { '2': cell(2, 2), '4': cell(3, 4) } } }),
    );
    expect(legs).toHaveLength(0);
  });

  it('turns a perfect losing streak into a fade on the opponent', () => {
    const legs = teamLegs(bundle({ ml: { overall: { '5': cell(0, 5) } } }));
    expect(legs).toHaveLength(1);
    expect(legs[0].betText).toBe('BOS ML'); // back the opponent
    expect(legs[0].backedTeamAbbr).toBe('BOS');
    expect(legs[0].odds).toBe(130); // opponent (away) ML
    expect(legs[0].streakN).toBe(5);
  });
});

// MARK: - Odds floor

describe(`teamLegs — odds floor (${ODDS_FLOOR})`, () => {
  it('drops a qualifying streak whose price is steeper than the floor', () => {
    const steep = bundle({ ml: { overall: { '6': cell(6, 6) } } }, ctx({ homeMl: -400 }));
    expect(teamLegs(steep)).toHaveLength(0);
  });

  it('keeps a qualifying streak exactly at the floor', () => {
    const atFloor = bundle({ ml: { overall: { '6': cell(6, 6) } } }, ctx({ homeMl: ODDS_FLOOR }));
    const legs = teamLegs(atFloor);
    expect(legs).toHaveLength(1);
    expect(legs[0].odds).toBe(ODDS_FLOOR);
  });
});

// MARK: - Alternate-line gate (prop legs)

describe(`propLegs — alternate line needs a ${ALT_LINE_MIN_STREAK}+ streak`, () => {
  const lines = [
    { line: 1.5, over: -150, under: 120 }, // default (over ≥ -180)
    { line: 2.5, over: 200, under: -260 }, // alternate ladder line
  ];

  it('emits an alternate-lines leg at exactly the streak threshold', () => {
    // 7 straight games clear 2.5, then it breaks
    const values = [3, 3, 3, 3, 3, 3, 3, 2, 3, 3];
    const legs = propLegs([propMatchup(propRow(values, lines))]);
    const alt = legs.filter((l) => l.category === 'alternateLines');
    expect(alt).toHaveLength(1);
    expect(alt[0].streakN).toBe(ALT_LINE_MIN_STREAK);
    expect(alt[0].odds).toBe(200);
    expect(alt[0].betText).toBe('3+ Hits'); // .5 alt line reads as a threshold
  });

  it('drops an alternate-lines leg one short of the threshold', () => {
    const values = [3, 3, 3, 3, 3, 3, 2, 3, 3, 3]; // streak of 6
    const legs = propLegs([propMatchup(propRow(values, lines))]);
    expect(legs.filter((l) => l.category === 'alternateLines')).toHaveLength(0);
  });
});

// MARK: - Conflict rules

describe('assemble — conflict rules', () => {
  it('rejects opposite totals sides of the same family in one game', () => {
    const pool = [
      mkLeg({ id: 'o', gameKey: '1', subject: 'Yankees', betText: 'Over 8.5', odds: -110, streakN: 6, marketKey: 'ou', totalsFamily: 'ou', totalsSide: 'over' }),
      mkLeg({ id: 'u', gameKey: '1', subject: 'RedSox', betText: 'Under 8.5', odds: -110, streakN: 5, marketKey: 'ou_u', totalsFamily: 'ou', totalsSide: 'under' }),
    ];
    const chosen = assemble(pool, { onePerGame: false });
    expect(chosen).toHaveLength(1);
    expect(chosen[0].totalsSide).toBe('over'); // higher streak wins the slot
  });

  it('rejects same-game legs backing different teams', () => {
    const pool = [
      mkLeg({ id: 'a', gameKey: '1', subject: 'A', betText: 'NYY ML', odds: -120, streakN: 6, marketKey: 'ml', backedTeamAbbr: 'NYY' }),
      mkLeg({ id: 'b', gameKey: '1', subject: 'B', betText: 'BOS -1.5', odds: 130, streakN: 5, marketKey: 'rl', backedTeamAbbr: 'BOS' }),
    ];
    expect(assemble(pool, { onePerGame: false })).toHaveLength(1);
  });

  it('allows same-game legs backing the same team', () => {
    const pool = [
      mkLeg({ id: 'a', gameKey: '1', subject: 'A', betText: 'NYY ML', odds: -120, streakN: 6, marketKey: 'ml', backedTeamAbbr: 'NYY' }),
      mkLeg({ id: 'b', gameKey: '1', subject: 'B', betText: 'NYY -1.5', odds: 130, streakN: 5, marketKey: 'rl', backedTeamAbbr: 'NYY' }),
    ];
    expect(assemble(pool, { onePerGame: false })).toHaveLength(2);
  });
});

// MARK: - Market diversity cap

describe(`assemble — market cap (${MARKET_CAP} per market)`, () => {
  it('caps how many legs of one market land on a card', () => {
    const pool = [1, 2, 3].map((i) =>
      mkLeg({
        id: `h${i}`,
        gameKey: String(i), // distinct games so onePerGame isn't the limiter
        subject: `Player ${i}`,
        betText: `${i}+ Hits`,
        odds: -110,
        streakN: 10 - i,
        marketKey: 'batter_hits',
        kind: 'prop',
      }),
    );
    expect(assemble(pool, { onePerGame: false })).toHaveLength(MARKET_CAP);
  });
});

// MARK: - Deterministic assembly

describe('assemble — deterministic ordering', () => {
  const pool = [
    mkLeg({ id: 'z', gameKey: '1', subject: 'S1', betText: 'b', odds: 100, streakN: 5, marketKey: 'ml' }),
    mkLeg({ id: 'a', gameKey: '2', subject: 'S2', betText: 'b', odds: 100, streakN: 5, marketKey: 'rl' }),
    mkLeg({ id: 'm', gameKey: '3', subject: 'S3', betText: 'b', odds: 150, streakN: 5, marketKey: 'ou' }),
    mkLeg({ id: 'q', gameKey: '4', subject: 'S4', betText: 'b', odds: -110, streakN: 9, marketKey: 'f5_ml' }),
  ];

  it('orders by streakN desc → odds desc → id asc', () => {
    const chosen = assemble(pool, { onePerGame: true });
    // streak 9 first; then streak-5s by odds desc (150), then odds tie broken by id asc (a < z)
    expect(chosen.map((l) => l.id)).toEqual(['q', 'm', 'a', 'z']);
  });

  it('produces identical output on repeated runs', () => {
    const first = assemble(pool, { onePerGame: true }).map((l) => l.id);
    const second = assemble([...pool].reverse(), { onePerGame: true }).map((l) => l.id);
    expect(first).toEqual(second); // input order must not matter
  });
});

// MARK: - Ticket minimum-legs gate

describe('slateTickets — MIN_LEGS gate', () => {
  const markets = ['ml', 'rl', 'ou']; // distinct so the market cap isn't the limiter
  function teamPool(count: number): ParlayLeg[] {
    return Array.from({ length: count }, (_, i) =>
      mkLeg({
        id: `t${i}`,
        gameKey: String(i), // distinct games (slate rail is one-per-game)
        subject: `Team ${i}`,
        betText: `T${i} ${markets[i % markets.length].toUpperCase()}`,
        odds: -120,
        streakN: 5,
        marketKey: markets[i % markets.length],
        category: 'teamForm',
        kind: 'team',
        backedTeamAbbr: `T${i}`,
      }),
    );
  }

  it('builds a category ticket once it can field the minimum legs', () => {
    const tickets = slateTickets(teamPool(3));
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe('slate-teamForm');
    expect(tickets[0].legs).toHaveLength(3);
    expect(tickets[0].combinedOddsText.length).toBeGreaterThan(0);
  });

  it('drops a category that is one leg short', () => {
    expect(slateTickets(teamPool(2))).toHaveLength(0);
  });
});
