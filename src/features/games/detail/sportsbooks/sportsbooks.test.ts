import { describe, expect, it } from 'vitest';
import {
  cfbAliasMatches,
  cfbCanonicalName,
  cfbSupportedAliasCount,
  decodePreferredBooks,
  encodePreferredBooks,
  isQuoteFromSelection,
  nflCityName,
  preferredBooksSummary,
  preferredQuote,
  quotesForMarket,
  type SportsbookGameOdds,
  type SportsbookMarketQuotes,
} from './quotes';

const board: SportsbookMarketQuotes = {
  capturedAt: '2026-08-15T12:00:00Z',
  quotes: [
    { bookKey: 'draftkings', bookName: 'DraftKings', line: -3.5, price: -110 },
    { bookKey: 'fanduel', bookName: 'FanDuel', line: -3, price: -108 },
    { bookKey: 'betmgm', bookName: 'BetMGM', line: -3.5, price: -115 },
  ],
};

describe('preferredQuote', () => {
  it('leads with the overall best when the user has not narrowed books', () => {
    expect(preferredQuote(board, new Set())?.bookKey).toBe('draftkings');
  });

  it('picks the first matching book in the already-sorted board', () => {
    expect(preferredQuote(board, new Set(['fanduel', 'betmgm']))?.bookKey).toBe('fanduel');
  });

  it('falls back to the overall best when none of the user books price the market', () => {
    expect(preferredQuote(board, new Set(['bovada']))?.bookKey).toBe('draftkings');
    expect(isQuoteFromSelection(board, new Set(['bovada']))).toBe(false);
    expect(isQuoteFromSelection(board, new Set(['fanduel']))).toBe(true);
  });
});

describe('preference encode/decode', () => {
  it('drops unknown keys and sorts on write', () => {
    expect(encodePreferredBooks(new Set(['fanduel', 'draftkings']))).toBe('draftkings,fanduel');
    expect([...decodePreferredBooks('fanduel,nope,draftkings')].sort()).toEqual(['draftkings', 'fanduel']);
    expect(decodePreferredBooks('').size).toBe(0);
    expect(preferredBooksSummary(new Set())).toMatch(/any book/);
  });
});

describe('quotesForMarket', () => {
  const odds: SportsbookGameOdds = {
    capturedAt: '2026-08-15T12:00:00Z',
    rows: [
      { bookKey: 'draftkings', totalPoint: 47.5, totalOverPrice: -110, totalUnderPrice: -110 },
      { bookKey: 'fanduel', totalPoint: 47, totalOverPrice: -105, totalUnderPrice: -115 },
    ],
  };

  it('sorts OVER by the lowest total', () => {
    expect(quotesForMarket(odds, { kind: 'total', isOver: true }).quotes[0].bookKey).toBe('fanduel');
  });

  it('sorts UNDER by the highest total', () => {
    expect(quotesForMarket(odds, { kind: 'total', isOver: false }).quotes[0].bookKey).toBe('draftkings');
  });
});

describe('nflCityName', () => {
  it('keeps the four ambiguous-city clubs intact', () => {
    expect(nflCityName('Los Angeles Chargers')).toBe('LA Chargers');
    expect(nflCityName('New York Giants')).toBe('NY Giants');
    expect(nflCityName('Kansas City Chiefs')).toBe('Kansas City');
  });
});

describe('CFBSportsbookTeamAliases', () => {
  it('covers the full reference catalog', () => {
    expect(cfbSupportedAliasCount).toBeGreaterThanOrEqual(139);
  });

  it('resolves ordinary programs by exact alias', () => {
    const examples: Array<[string, string]> = [
      ['TCU Horned Frogs', 'TCU'],
      ['North Carolina Tar Heels', 'North Carolina'],
      ['NC State Wolfpack', 'NC State'],
      ['Mississippi State Bulldogs', 'Mississippi State'],
      ['Maryland Terrapins', 'Maryland'],
      ['North Dakota State Bison', 'North Dakota State'],
    ];
    for (const [odds, canonical] of examples) {
      expect(cfbAliasMatches(odds, canonical)).toBe(true);
    }
  });

  it('resolves non-prefix aliases explicitly', () => {
    const examples: Array<[string, string]> = [
      ['Southern California Trojans', 'USC'],
      ['Mississippi Rebels', 'Ole Miss'],
      ['UMass Minutemen', 'Massachusetts'],
      ['Hawaii Rainbow Warriors', "Hawai'i"],
      ['San Jose State Spartans', 'San José State'],
      ['Sam Houston State Bearkats', 'Sam Houston'],
      ['Southern Mississippi Golden Eagles', 'Southern Miss'],
      ['Appalachian State Mountaineers', 'App State'],
    ];
    for (const [odds, canonical] of examples) {
      expect(cfbCanonicalName(odds, [canonical])).toBe(canonical);
    }
  });

  it('does not let Miami programs cross-match', () => {
    const candidates = ['Miami', 'Miami (OH)'];
    expect(cfbCanonicalName('Miami Hurricanes', candidates)).toBe('Miami');
    expect(cfbCanonicalName('Miami (OH) RedHawks', candidates)).toBe('Miami (OH)');
    expect(cfbCanonicalName('Miami RedHawks', candidates)).toBe('Miami (OH)');
  });

  it('never falls back fuzzily for an unknown school', () => {
    expect(
      cfbCanonicalName('Another State Wildcats', ['Arizona State', 'Kansas State', 'Ohio State']),
    ).toBeNull();
    expect(cfbCanonicalName('North Carolina A&T Aggies', ['North Carolina'])).toBeNull();
    expect(cfbCanonicalName('Tennessee State Tigers', ['Tennessee'])).toBeNull();
  });
});
