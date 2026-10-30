import { describe, expect, it } from 'vitest';
import { compareReads, formatLine, impliedProbability, lineDirection, quoteLine, readMarket, type MarketInput } from './signals';
import { THRESHOLDS } from './types';

function input(overrides: Partial<MarketInput> = {}): MarketInput {
  return {
    market: 'total',
    betsAway: 80,
    betsHome: 20,
    moneyAway: 60,
    moneyHome: 40,
    awayOpen: 223.5,
    homeOpen: 223.5,
    awayCons: 220.5,
    homeCons: 220.5,
    awayClose: null,
    homeClose: null,
    tickets: 4200,
    hasSplit: true,
    awayName: 'Away',
    homeName: 'Home',
    ...overrides,
  };
}

describe('THRESHOLDS', () => {
  it('keeps the category cuts in one place', () => {
    expect(THRESHOLDS).toEqual({
      DIVERGE_TILT: 10,
      STRONG_TILT: 20,
      HEAVY_TICKETS: 60,
      CONFIRM_MOVE: { spread: 0.5, total: 0.5, ml: 0.02 },
      STRONG_MOVE: { spread: 1.5, total: 1.5, ml: 0.05 },
      MIN_TICKETS: 200,
      LEAN_TICKETS: 55,
      ML_MIN_MINORITY: 15,
    });
  });
});

describe('lineDirection', () => {
  it('reads a falling total from the consensus line, not one side’s best number', () => {
    expect(
      lineDirection({ market: 'total', awayOpen: 40.5, homeOpen: 40.5, awayCons: 38.5, homeCons: 38.5 }),
    ).toMatchObject({ movedToward: 'home', moveSize: 2, current: 38.5 });
  });

  it('reads a rising total as toward the over', () => {
    expect(
      lineDirection({ market: 'total', awayOpen: 220.5, homeOpen: 220.5, awayCons: 223.5, homeCons: 223.5 }),
    ).toMatchObject({ movedToward: 'away', moveSize: 3, current: 223.5 });
  });

  it('reads Celtics/Pistons +1.5 → −1.5 as toward the away side', () => {
    expect(
      lineDirection({ market: 'spread', awayOpen: 1.5, homeOpen: -1.5, awayCons: -1.5, homeCons: 1.5 }).movedToward,
    ).toBe('away');
  });

  it('keeps SMU on the minus side of California @ SMU', () => {
    const quote = lineDirection({
      market: 'spread',
      awayOpen: 16.5,
      homeOpen: -16.5,
      awayCons: 19.5,
      homeCons: -19.5,
    });
    expect(quote).toMatchObject({
      open: 16.5,
      current: 19.5,
      homeOpen: -16.5,
      homeCurrent: -19.5,
      movedToward: 'home',
      moveSize: 3,
    });
    const label = quoteLine('spread', 'California', 'SMU', quote);
    expect(label).toContain('SMU -16.5 → -19.5');
    expect(label).toContain('California +16.5 → +19.5');
    expect(label).not.toContain('+20');
  });

  it('devigs a moneyline instead of subtracting the prices', () => {
    expect(impliedProbability(-113)).toBeGreaterThan(impliedProbability(105));
    expect(
      lineDirection({ market: 'ml', awayOpen: 105, homeOpen: -125, awayCons: -113, homeCons: 102 }).movedToward,
    ).toBe('away');
  });

  it('treats a missing opener as unknown, not a flat line', () => {
    expect(
      lineDirection({ market: 'total', awayOpen: null, homeOpen: null, awayCons: 220.5, homeCons: 220.5 }),
    ).toMatchObject({ movedToward: null, moveSize: null });
    expect(
      lineDirection({ market: 'spread', awayOpen: 1.5, homeOpen: -1.5, awayCons: 1.5, homeCons: -1.5 }),
    ).toMatchObject({ movedToward: null, moveSize: 0, current: 1.5 });
  });
});

describe('readMarket', () => {
  it('scores the worked example as sharp money on the under', () => {
    const read = readMarket(input());
    expect(read.category).toBe('sharp_money');
    expect(read.chip).toBe('Sharp Money on the Under');
    expect(read.tiltPp).toBe(20);
    expect(read.moveSize).toBe(3);
    expect(read.strong).toBe(true);
    expect(read.excluded).toBe(false);
    expect(read.sentence).toContain('80% of bets are on the Over');
    expect(read.sentence).toContain('40% of the money on 20% of the tickets');
    expect(read.sentence).toContain('223.5 → 220.5');
    expect(read.sentence).toContain('following the money, not the tickets');
  });

  it('does not call a same-side majority sharp when the line moves with it', () => {
    const read = readMarket(
      input({
        betsAway: 70,
        betsHome: 30,
        moneyAway: 80,
        moneyHome: 20,
        awayOpen: 210,
        homeOpen: 210,
        awayCons: 214,
        homeCons: 214,
      }),
    );
    expect(read.category).toBe('hammered');
    expect(read.category).not.toBe('sharp_money');
    expect(read.chip).toBe('Hammered on the Over');
    expect(read.sentence).toContain('public with real volume');
    expect(read.sentence).toContain('not sharp action');
  });

  it('labels money-with-tickets and a line moving away as the line pushing back', () => {
    const read = readMarket(
      input({
        betsAway: 70,
        betsHome: 30,
        moneyAway: 80,
        moneyHome: 20,
        awayOpen: 214,
        homeOpen: 214,
        awayCons: 210,
        homeCons: 210,
      }),
    );
    expect(read.category).toBe('line_pushes_back');
    expect(read.emphasis).toBe('quiet');
    expect(read.chip).toBe('Line pushing back');
    expect(read.sentence).toContain('moved toward the Under');
  });

  it('keeps a 20-point tilt with a flat line at tier 2', () => {
    const read = readMarket(input({ awayOpen: 223.5, homeOpen: 223.5, awayCons: 223.5, homeCons: 223.5 }));
    expect(read.movedToward).toBeNull();
    expect(read.tiltPp).toBe(20);
    expect(read.category).toBe('money_no_move');
    expect(read.chip).toBe('Money on the Under');
    expect(read.sentence).toContain("hasn't moved for it yet");
  });

  it('says the line moved the other way when it confirms the tickets instead', () => {
    const read = readMarket(input({ awayOpen: 220.5, homeOpen: 220.5, awayCons: 223.5, homeCons: 223.5 }));
    expect(read.category).toBe('line_fights_money');
    expect(read.chip).toBe('Line fighting the money');
    expect(read.sentence).toContain('moved toward the Over');
    expect(read.sentence).toContain('220.5 → 223.5');
  });

  it('does not match tier 1, 3, or 4 when the opener is missing', () => {
    const read = readMarket(input({ awayOpen: null }));
    expect(read.movedToward).toBeNull();
    expect(read.moveSize).toBeNull();
    expect(read.category).not.toBe('sharp_money');
    expect(read.category).not.toBe('consensus');
    expect(read.category).not.toBe('line_pushes_back');
    expect(read.category).toBe('money_no_move');
  });

  it('excludes a 0/0 split instead of calling it unanimous', () => {
    const read = readMarket(input({ betsAway: 0, betsHome: 0, moneyAway: 0, moneyHome: 0 }));
    expect(read.excluded).toBe(true);
    expect(read.category).toBeNull();
  });

  it('excludes 0/100, a false has_split flag, and thin ticket counts', () => {
    expect(readMarket(input({ betsAway: 0, betsHome: 100 })).excluded).toBe(true);
    expect(readMarket(input({ hasSplit: false })).excluded).toBe(true);
    expect(readMarket(input({ tickets: 199 })).excluded).toBe(true);
    expect(readMarket(input({ tickets: 200 })).excluded).toBe(false);
    expect(readMarket(input({ tickets: null })).excluded).toBe(false);
  });

  it('uses team names on a spread and keeps a mild lean out of the even bucket', () => {
    const lean = readMarket(
      input({
        market: 'spread',
        betsAway: 56,
        betsHome: 44,
        moneyAway: 56,
        moneyHome: 44,
        awayOpen: 3,
        homeOpen: -3,
        awayCons: 3,
        homeCons: -3,
        awayName: 'Celtics',
        homeName: 'Pistons',
      }),
    );
    expect(lean.category).toBe('split');
    expect(lean.emphasis).toBe('none');
    expect(lean.chip).toBe('Leaning Celtics');
    expect(lean.sentence).toContain('Bets lean Celtics (56%)');

    const even = readMarket(
      input({
        betsAway: 50,
        betsHome: 50,
        moneyAway: 50,
        moneyHome: 50,
        awayOpen: 223.5,
        homeOpen: 223.5,
        awayCons: 223.5,
        homeCons: 223.5,
      }),
    );
    expect(even.category).toBe('split');
    expect(even.chip).toBe('Split');
    expect(even.sentence).toBe('The money and the tickets are split.');
  });
});

describe('compareReads', () => {
  it('sorts a strong sharp read ahead of a plain one, then by tilt and move', () => {
    const strong = readMarket(input());
    const plain = readMarket(
      input({
        betsAway: 70,
        betsHome: 30,
        moneyAway: 55,
        moneyHome: 45,
        awayOpen: 223.5,
        homeOpen: 223.5,
        awayCons: 222.5,
        homeCons: 222.5,
      }),
    );
    expect(plain.category).toBe('sharp_money');
    expect(plain.strong).toBe(false);
    expect(compareReads(strong, plain)).toBeLessThan(0);
  });
});

describe('live board fixtures', () => {
  it('labels California @ SMU with SMU on the minus side', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: 'California',
        homeName: 'SMU',
        betsAway: 71,
        betsHome: 29,
        moneyAway: 56,
        moneyHome: 44,
        awayOpen: 16.5,
        homeOpen: -16.5,
        awayCons: 19.5,
        homeCons: -19.5,
        awayClose: 20.5,
        homeClose: -19.5,
      }),
    );
    expect(read.homeCurrent).toBe(-19.5);
    expect(read.current).toBe(19.5);
    const quote = quoteLine('spread', 'California', 'SMU', read);
    expect(quote).toBe('California +16.5 → +19.5 · SMU -16.5 → -19.5');
    expect(quote).not.toMatch(/\.25|\.75/);
    expect(read.movedToward).toBe('home');
  });

  it('moves the 49ers spread a full point, −4.5 to the −3.5 consensus', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: '49ers',
        homeName: 'Atlanta',
        betsAway: 70,
        betsHome: 30,
        moneyAway: 41,
        moneyHome: 59,
        awayOpen: -4.5,
        homeOpen: 4.5,
        awayCons: -3.5,
        homeCons: 3.5,
      }),
    );
    expect(read.category).toBe('sharp_money');
    expect(read.chip).toBe('Sharp Money on Atlanta');
    expect(read.tiltPp).toBe(29);
    expect(read.current).toBe(-3.5);
    expect(read.moveSize).toBe(1);
    expect(read.sentence).toContain('49ers -4.5 → -3.5');
  });

  it('moves the Browns total 2 points, 40.5 to the 38.5 consensus', () => {
    const read = readMarket(
      input({
        betsAway: 77,
        betsHome: 23,
        moneyAway: 62,
        moneyHome: 38,
        awayOpen: 40.5,
        homeOpen: 40.5,
        awayCons: 38.5,
        homeCons: 38.5,
      }),
    );
    expect(read.moveSize).toBe(2);
    expect(read.current).toBe(38.5);
    expect(read.movedToward).toBe('home');
    expect(read.category).toBe('sharp_money');
  });

  it('keeps a moneyline out of the money categories and still reads the price move', () => {
    const read = readMarket(
      input({
        market: 'ml',
        betsAway: 40,
        betsHome: 60,
        moneyAway: 20,
        moneyHome: 80,
        awayOpen: 105,
        homeOpen: -125,
        awayCons: -113,
        homeCons: 102,
      }),
    );
    expect(read.excluded).toBe(false);
    expect(read.category).not.toBe('sharp_money');
    expect(read.category).not.toBe('hammered');
    expect(read.category).toBe('line_pushes_back');
    expect(read.movedToward).toBe('away');
  });

  it('keeps a spread whose quiet side is under 15 percent', () => {
    const read = readMarket(
      input({
        market: 'spread',
        betsAway: 12,
        betsHome: 88,
        moneyAway: 40,
        moneyHome: 60,
        awayOpen: 3.5,
        homeOpen: -3.5,
        awayCons: 3.5,
        homeCons: -3.5,
      }),
    );
    expect(read.excluded).toBe(false);
    expect(read.category).not.toBeNull();
  });

  it('calls Indiana @ Michigan sharp money on the under', () => {
    const read = readMarket(
      input({
        awayName: 'Indiana',
        homeName: 'Michigan',
        betsAway: 83,
        betsHome: 17,
        moneyAway: 64,
        moneyHome: 36,
        awayOpen: 52.5,
        homeOpen: 52.5,
        awayCons: 41.5,
        homeCons: 41.5,
      }),
    );
    expect(read.category).toBe('sharp_money');
    expect(read.emphasis).toBe('loud');
    expect(read.chip).toBe('Sharp Money on the Under');
    expect(read.tiltPp).toBe(19);
    expect(read.moveSize).toBe(11);
    expect(read.strong).toBe(false);
    expect(read.sentence).toContain('52.5 → 41.5');
    expect(read.sentence).not.toMatch(/\.25|\.75/);
  });

  it('calls Boise State @ Washington St sharp money, not an even split', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: 'Boise State',
        homeName: 'Washington St',
        betsAway: 52,
        betsHome: 48,
        moneyAway: 15,
        moneyHome: 85,
        awayOpen: -16.5,
        homeOpen: 16.5,
        awayCons: -13,
        homeCons: 13,
      }),
    );
    expect(read.category).toBe('sharp_money');
    expect(read.chip).toBe('Sharp Money on Washington St');
    expect(read.chip).not.toMatch(/Split|Lean/i);
    expect(read.tiltPp).toBe(37);
    expect(read.current).toBe(-13);
    expect(String(read.current)).not.toMatch(/\.25|\.75/);
  });

  it('calls Duke @ Virginia sharp money on a 56 percent crowd', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: 'Duke',
        homeName: 'Virginia',
        betsAway: 44,
        betsHome: 56,
        moneyAway: 59,
        moneyHome: 41,
        awayOpen: 6.5,
        homeOpen: -6.5,
        awayCons: 1.5,
        homeCons: -1.5,
      }),
    );
    expect(read.category).toBe('sharp_money');
    expect(read.chip).toBe('Sharp Money on Duke');
  });

  it('calls Houston @ Utah money with no move', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: 'Houston',
        homeName: 'Utah',
        betsAway: 69,
        betsHome: 31,
        moneyAway: 47,
        moneyHome: 53,
        awayOpen: 6.5,
        homeOpen: -6.5,
        awayCons: 6.5,
        homeCons: -6.5,
      }),
    );
    expect(read.category).toBe('money_no_move');
    expect(read.chip).toBe('Money on Utah');
    expect(read.movedToward).toBeNull();
    expect(read.sentence).toContain("hasn't moved");
  });

  it('calls Oklahoma @ Mississippi St a line fighting the money', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: 'Oklahoma',
        homeName: 'Miss St',
        betsAway: 59,
        betsHome: 41,
        moneyAway: 42,
        moneyHome: 58,
        awayOpen: -1.5,
        homeOpen: 1.5,
        awayCons: -4.5,
        homeCons: 4.5,
      }),
    );
    expect(read.category).toBe('line_fights_money');
    expect(read.chip).toBe('Line fighting the money');
    expect(read.sentence).toContain('Miss St');
    expect(read.sentence).toContain('Oklahoma');
  });

  it('calls Bengals @ Ravens hammered, not sharp money', () => {
    const read = readMarket(
      input({
        market: 'spread',
        awayName: 'Cincinnati',
        homeName: 'Ravens',
        betsAway: 73,
        betsHome: 27,
        moneyAway: 87,
        moneyHome: 13,
        awayOpen: 3.5,
        homeOpen: -3.5,
        awayCons: 3,
        homeCons: -3,
      }),
    );
    expect(read.category).toBe('hammered');
    expect(read.category).not.toBe('sharp_money');
    expect(read.chip).toBe('Hammered on Cincinnati');
    expect(read.sentence).toContain('not sharp action');
  });

  it('calls Army @ Tulsa the line pushing back', () => {
    const read = readMarket(
      input({
        awayName: 'Army',
        homeName: 'Tulsa',
        betsAway: 9,
        betsHome: 91,
        moneyAway: 10,
        moneyHome: 90,
        awayOpen: 50.5,
        homeOpen: 50.5,
        awayCons: 54.5,
        homeCons: 54.5,
      }),
    );
    expect(read.category).toBe('line_pushes_back');
    expect(read.emphasis).toBe('quiet');
    expect(read.chip).toBe('Line pushing back');
    expect(read.moveSize).toBe(4);
  });

  it('collapses a quarter-point drift so it is not sharp money', () => {
    const read = readMarket(
      input({
        awayOpen: 223.5,
        homeOpen: 223.5,
        awayCons: 223.25,
        homeCons: 223.25,
      }),
    );
    expect(read.moveSize).toBe(0.25);
    expect(read.category).toBe('money_no_move');
    expect(read.category).not.toBe('sharp_money');
  });

  it('excludes Old Dominion @ LA Tech on the moneyline minority floor', () => {
    const read = readMarket(
      input({
        market: 'ml',
        awayName: 'Old Dominion',
        homeName: 'LA Tech',
        betsAway: 4,
        betsHome: 96,
        moneyAway: 79,
        moneyHome: 21,
        awayOpen: 450,
        homeOpen: -650,
        awayCons: 400,
        homeCons: -550,
      }),
    );
    expect(read.excluded).toBe(true);
    expect(read.category).toBeNull();
  });

  it('prints consensus lines as whole or half points', () => {
    for (const value of [52.5, 41.5, -16.5, -13, 6.5, 1.5, -1.5, -4.5, 3.5, 3, 40.5, 38.5, 19.5, -19.5, -3.5]) {
      expect(formatLine('spread', value)).not.toMatch(/\.25|\.75/);
      expect(formatLine('total', Math.abs(value))).not.toMatch(/\.25|\.75/);
    }
  });
});
