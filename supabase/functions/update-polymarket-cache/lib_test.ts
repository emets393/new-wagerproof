import { assert, assertEquals, assertStrictEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  NFL_FULL_TO_SHORT,
  buildGameKey,
  computeWindow,
  eventInWindow,
  extractTokenId,
  isMainGameTitle,
  legacyNflNames,
  matchGameToEvent,
  mergeMarketsIntoEvents,
  nflMascot,
  pickMarkets,
  type SlimEvent,
} from './lib.ts';

// The 32 names exactly as nfl_teams.team_name / nfl_slate_feed.away_team spell them.
const NFL_FULL_NAMES = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 'Carolina Panthers',
  'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos',
  'Detroit Lions', 'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars',
  'Kansas City Chiefs', 'Los Angeles Rams', 'Los Angeles Chargers', 'Las Vegas Raiders', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
  'Philadelphia Eagles', 'Pittsburgh Steelers', 'Seattle Seahawks', 'San Francisco 49ers',
  'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
];

Deno.test('every slate full name maps to a legacy short name', () => {
  for (const name of NFL_FULL_NAMES) {
    assert(NFL_FULL_TO_SHORT[name], `missing legacy mapping for ${name}`);
  }
  assertEquals(NFL_FULL_TO_SHORT['New England Patriots'], 'New England');
  assertEquals(NFL_FULL_TO_SHORT['Los Angeles Rams'], 'LA Rams');
  assertEquals(NFL_FULL_TO_SHORT['New York Giants'], 'NY Giants');
});

Deno.test('nflMascot handles full, short and mascot forms', () => {
  assertEquals(nflMascot('New England Patriots'), 'Patriots');
  assertEquals(nflMascot('San Francisco 49ers'), '49ers');
  assertEquals(nflMascot('New England'), 'Patriots');
  assertEquals(nflMascot('Patriots'), 'Patriots');
});

Deno.test('legacyNflNames yields the old nfl_betting_lines key pair', () => {
  const legacy = legacyNflNames({ league: 'nfl', away_team: 'Dallas Cowboys', home_team: 'New York Giants' });
  assertEquals(legacy, { away_team: 'Dallas', home_team: 'NY Giants' });
  assertEquals(buildGameKey('nfl', legacy!.away_team, legacy!.home_team), 'nfl_Dallas_NY Giants');
  assertStrictEquals(legacyNflNames({ league: 'nfl', away_team: 'Nowhere FC', home_team: 'New York Giants' }), null);
});

Deno.test('isMainGameTitle keeps the game and drops sub-events and series markets', () => {
  assert(isMainGameTitle('Patriots vs. Seahawks'));
  assert(isMainGameTitle('Florida A&M vs. Miami (FL)'));
  assert(isMainGameTitle('Minnesota Twins vs. Detroit Tigers'));
  assert(!isMainGameTitle('Patriots vs. Seahawks - Player Props'));
  assert(!isMainGameTitle('Minnesota Twins vs. Detroit Tigers - 2nd Inning Winner'));
  assert(!isMainGameTitle('Pro Football: Cardinals vs. Rams Season Series Winner'));
  assert(!isMainGameTitle('Tush Push banned for 2026 NFL Season?'));
});

function rawMarket(overrides: Record<string, unknown>) {
  return {
    id: '1',
    slug: 'nfl-ne-sea-2026-09-10',
    question: 'Patriots vs. Seahawks',
    active: true,
    closed: false,
    clobTokenIds: '["111","222"]',
    sportsMarketType: 'moneyline',
    events: [{ id: '9001', slug: 'nfl-ne-sea-2026-09-10', title: 'Patriots vs. Seahawks', startTime: '2026-09-10T00:20:00Z', endDate: '2026-09-10T00:20:00Z' }],
    ...overrides,
  };
}

Deno.test('mergeMarketsIntoEvents groups rows by parent event and slims them', () => {
  const rows = [
    rawMarket({}),
    rawMarket({ id: '3', question: 'Spread: Seahawks (-3.5)', sportsMarketType: 'spreads', line: -3.5, clobTokenIds: '["333","444"]' }),
    rawMarket({ id: '2', question: 'Spread: Seahawks (-1.5)', sportsMarketType: 'spreads', line: -1.5, clobTokenIds: '["555","666"]' }),
    rawMarket({ id: '7', events: [] }), // orphan row: dropped
    rawMarket({ id: '8', question: '49ers vs. Rams', events: [{ id: '9002', slug: 'nfl-sf-la-2026-09-11', title: '49ers vs. Rams', startTime: '2026-09-11T00:35:00Z' }] }),
  ];
  const events = [...mergeMarketsIntoEvents(rows).values()];
  assertEquals(events.map((e) => e.title), ['Patriots vs. Seahawks', '49ers vs. Rams']);
  assertEquals(events[0].markets.length, 3);
  assertEquals(events[0].markets[1].line, -3.5);
  assertEquals(Object.keys(events[0].markets[0]).sort(), ['active', 'clobTokenIds', 'closed', 'id', 'line', 'question', 'slug', 'sportsMarketType']);
});

Deno.test('pickMarkets takes the first active market of each type in id order', () => {
  const rows = [
    rawMarket({ id: '30', question: 'Spread: Seahawks (-3.5)', sportsMarketType: 'spreads', clobTokenIds: '["333","444"]' }),
    rawMarket({ id: '20', question: 'Spread: Seahawks (-1.5)', sportsMarketType: 'spreads', clobTokenIds: '["555","666"]' }),
    rawMarket({ id: '10' }),
    rawMarket({ id: '40', question: 'Patriots vs. Seahawks: O/U 41.5', sportsMarketType: 'totals', clobTokenIds: '["777","888"]', closed: true }),
    rawMarket({ id: '50', question: 'Patriots vs. Seahawks: O/U 43.5', sportsMarketType: 'totals', clobTokenIds: '["999","000"]' }),
    rawMarket({ id: '60', question: '1H Spread: Seahawks (-2.5)', sportsMarketType: 'first_half_spreads', clobTokenIds: '["1","2"]' }),
  ];
  const event = [...mergeMarketsIntoEvents(rows).values()][0];
  const picks = pickMarkets(event);
  assertEquals(picks.moneyline, { tokenId: '111', question: 'Patriots vs. Seahawks' });
  assertEquals(picks.spread, { tokenId: '555', question: 'Spread: Seahawks (-1.5)' });
  assertEquals(picks.total, { tokenId: '999', question: 'Patriots vs. Seahawks: O/U 43.5' });
});

Deno.test('pickMarkets falls back to question heuristics without sportsMarketType', () => {
  const rows = [
    rawMarket({ id: '2', question: 'Duke vs. UNC: O/U 150.5', slug: 'cbb-duke-unc-total-150pt5', sportsMarketType: null, clobTokenIds: '["t1","t2"]' }),
    rawMarket({ id: '1', question: 'Duke vs. UNC', slug: 'cbb-duke-unc', sportsMarketType: null, clobTokenIds: '["m1","m2"]' }),
  ];
  const picks = pickMarkets([...mergeMarketsIntoEvents(rows).values()][0]);
  assertEquals(picks.moneyline?.tokenId, 'm1');
  assertEquals(picks.total?.tokenId, 't1');
  assertStrictEquals(picks.spread, null);
});

Deno.test('extractTokenId reads string and array forms', () => {
  assertEquals(extractTokenId('["abc","def"]'), 'abc');
  assertEquals(extractTokenId(['x', 'y']), 'x');
  assertStrictEquals(extractTokenId('not json'), null);
  assertStrictEquals(extractTokenId(null), null);
});

const EVENTS: SlimEvent[] = [
  { id: '1', slug: 'nfl-ne-sea-2026-09-10-player-props', title: 'Patriots vs. Seahawks - Player Props', startDate: null, endDate: null, markets: [] },
  { id: '2', slug: 'nfl-nyj-ne-2026-09-20', title: 'Jets vs. Patriots', startDate: null, endDate: null, markets: [] },
  { id: '3', slug: 'nfl-ne-sea-2026-09-10', title: 'Patriots vs. Seahawks', startDate: null, endDate: null, markets: [] },
  { id: '4', slug: 'mlb-min-det-2026-09-09', title: 'Minnesota Twins vs. Detroit Tigers', startDate: null, endDate: null, markets: [] },
  { id: '5', slug: 'cfb-rutger-boscol-2026-09-11', title: 'Rutgers vs. Boston College', startDate: null, endDate: null, markets: [] },
  { id: '6', slug: 'cfb-flam-mia-2026-09-10', title: 'Florida A&M vs. Miami (FL)', startDate: null, endDate: null, markets: [] },
];

Deno.test('matchGameToEvent: NFL matches by slate abbreviations in the slug', () => {
  const hit = matchGameToEvent(EVENTS, { league: 'nfl', away_team: 'New England Patriots', home_team: 'Seattle Seahawks', away_ab: 'NE', home_ab: 'SEA' });
  assertEquals(hit?.id, '3');
});

Deno.test('matchGameToEvent: NFL full names still match by mascot without abbreviations', () => {
  const hit = matchGameToEvent(EVENTS.filter((e) => e.id !== '1'), { league: 'nfl', away_team: 'New England Patriots', home_team: 'Seattle Seahawks' });
  assertEquals(hit?.id, '3');
});

Deno.test('matchGameToEvent: MLB exact title, CFB fuzzy title', () => {
  assertEquals(matchGameToEvent(EVENTS, { league: 'mlb', away_team: 'Minnesota Twins', home_team: 'Detroit Tigers' })?.id, '4');
  assertEquals(matchGameToEvent(EVENTS, { league: 'cfb', away_team: 'Rutgers', home_team: 'Boston College' })?.id, '5');
  assertStrictEquals(matchGameToEvent(EVENTS, { league: 'cfb', away_team: 'Ohio State', home_team: 'Michigan' }), null);
});

Deno.test('computeWindow / eventInWindow keep the next 8 days and recent kickoffs', () => {
  const now = new Date('2026-09-09T20:00:00Z');
  const w = computeWindow(now);
  assertEquals(w.gameStartMin.toISOString(), '2026-09-09T12:00:00.000Z');
  assertEquals(w.gameStartMax.toISOString(), '2026-09-17T20:00:00.000Z');
  assert(w.marketEndMax.getTime() > w.gameStartMax.getTime() + 7 * 86_400_000, 'market window must outlast a 7-day settlement lag');
  const ev = (startDate: string | null): SlimEvent => ({ id: 'x', slug: 'x', title: 'A vs. B', startDate, endDate: null, markets: [] });
  assert(eventInWindow(ev('2026-09-10T00:20:00Z'), w));
  assert(eventInWindow(ev('2026-09-09T17:10:00Z'), w), 'in-progress game stays');
  assert(!eventInWindow(ev('2026-09-20T17:00:00Z'), w), 'next-next week is out');
  assert(eventInWindow(ev(null), w), 'unknown start is kept');
});

Deno.test('CFB slate spellings that Polymarket writes differently', () => {
  const events: SlimEvent[] = [
    { id: '1', slug: 'cfb-appst-ecu-2026-09-12', title: 'Appalachian State vs. East Carolina', startDate: null, endDate: null, markets: [] },
    { id: '2', slug: 'cfb-ulm-uab-2026-09-12', title: 'Louisiana-Monroe vs. UAB', startDate: null, endDate: null, markets: [] },
  ];
  assertEquals(matchGameToEvent(events, { league: 'cfb', away_team: 'App State', home_team: 'East Carolina' })?.id, '1');
  assertEquals(matchGameToEvent(events, { league: 'cfb', away_team: 'UL Monroe', home_team: 'UAB' })?.id, '2');
});
