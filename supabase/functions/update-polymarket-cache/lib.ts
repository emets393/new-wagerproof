// Pure helpers for update-polymarket-cache. No Deno/Supabase I/O in here so
// `deno test` can exercise the matching, market-picking and key logic offline.
// See README.md in this directory for the end-to-end flow.

export type League = 'nfl' | 'cfb' | 'ncaab' | 'nba' | 'mlb';
export type MarketType = 'moneyline' | 'spread' | 'total';

export interface Game {
  league: League;
  away_team: string;
  home_team: string;
  /** Slate abbreviations (NFL only today). Polymarket slugs embed the same codes. */
  away_ab?: string | null;
  home_ab?: string | null;
}

export interface SlimMarket {
  id: string;
  slug: string;
  question: string;
  active: boolean;
  closed: boolean;
  /** gamma-api serialises this as a JSON string ('["123","456"]'), sometimes an array. */
  clobTokenIds: string | string[] | null;
  /** gamma-api's own label: 'moneyline' | 'spreads' | 'totals' | many period/prop types. */
  sportsMarketType: string | null;
  line: number | null;
}

export interface SlimEvent {
  id: string;
  slug: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  markets: SlimMarket[];
}

// ---------------------------------------------------------------------------
// Team-name tables (unchanged from the original function)
// ---------------------------------------------------------------------------

export const NFL_TEAM_MASCOTS: Record<string, string> = {
  'Arizona': 'Cardinals',
  'Atlanta': 'Falcons',
  'Baltimore': 'Ravens',
  'Buffalo': 'Bills',
  'Carolina': 'Panthers',
  'Chicago': 'Bears',
  'Cincinnati': 'Bengals',
  'Cleveland': 'Browns',
  'Dallas': 'Cowboys',
  'Denver': 'Broncos',
  'Detroit': 'Lions',
  'Green Bay': 'Packers',
  'Houston': 'Texans',
  'Indianapolis': 'Colts',
  'Jacksonville': 'Jaguars',
  'Kansas City': 'Chiefs',
  'Las Vegas': 'Raiders',
  'Los Angeles Chargers': 'Chargers',
  'Los Angeles Rams': 'Rams',
  'LA Chargers': 'Chargers',
  'LA Rams': 'Rams',
  'Miami': 'Dolphins',
  'Minnesota': 'Vikings',
  'New England': 'Patriots',
  'New Orleans': 'Saints',
  'NY Giants': 'Giants',
  'NY Jets': 'Jets',
  'Philadelphia': 'Eagles',
  'Pittsburgh': 'Steelers',
  'San Francisco': '49ers',
  'Seattle': 'Seahawks',
  'Tampa Bay': 'Buccaneers',
  'Tennessee': 'Titans',
  'Washington': 'Commanders',
};

// NBA teams - extract mascot from full name for Polymarket matching
// Database has "Charlotte Hornets", Polymarket uses "Hornets"
const NBA_TEAM_TO_MASCOT: Record<string, string> = {
  'Atlanta Hawks': 'Hawks',
  'Boston Celtics': 'Celtics',
  'Brooklyn Nets': 'Nets',
  'Charlotte Hornets': 'Hornets',
  'Chicago Bulls': 'Bulls',
  'Cleveland Cavaliers': 'Cavaliers',
  'Dallas Mavericks': 'Mavericks',
  'Denver Nuggets': 'Nuggets',
  'Detroit Pistons': 'Pistons',
  'Golden State Warriors': 'Warriors',
  'Houston Rockets': 'Rockets',
  'Indiana Pacers': 'Pacers',
  'LA Clippers': 'Clippers',
  'Los Angeles Clippers': 'Clippers',
  'Los Angeles Lakers': 'Lakers',
  'Memphis Grizzlies': 'Grizzlies',
  'Miami Heat': 'Heat',
  'Milwaukee Bucks': 'Bucks',
  'Minnesota Timberwolves': 'Timberwolves',
  'New Orleans Pelicans': 'Pelicans',
  'New York Knicks': 'Knicks',
  'Oklahoma City Thunder': 'Thunder',
  'Orlando Magic': 'Magic',
  'Philadelphia 76ers': '76ers',
  'Phoenix Suns': 'Suns',
  'Portland Trail Blazers': 'Trail Blazers',
  'Sacramento Kings': 'Kings',
  'San Antonio Spurs': 'Spurs',
  'Toronto Raptors': 'Raptors',
  'Utah Jazz': 'Jazz',
  'Washington Wizards': 'Wizards',
};

// CFB teams - map common variations to Polymarket names
const CFB_TEAM_MAPPINGS: Record<string, string> = {
  // cfb_slate_feed spellings that differ from Polymarket's (found unmatched 2026-09-09)
  'App State': 'Appalachian State',
  'UL Monroe': 'Louisiana-Monroe',
  'Ohio State': 'Ohio State',
  'Michigan': 'Michigan',
  'Alabama': 'Alabama',
  'Georgia': 'Georgia',
  'Texas': 'Texas',
  'Oregon': 'Oregon',
  'Penn State': 'Penn State',
  'Notre Dame': 'Notre Dame',
  'USC': 'USC',
  'LSU': 'LSU',
  'Clemson': 'Clemson',
  'Florida State': 'Florida State',
  'Florida': 'Florida',
  'Tennessee': 'Tennessee',
  'Oklahoma': 'Oklahoma',
  'Texas A&M': 'Texas A&M',
  'Auburn': 'Auburn',
  'Ole Miss': 'Ole Miss',
  'Miami': 'Miami',
  'Washington': 'Washington',
  'Wisconsin': 'Wisconsin',
  'Iowa': 'Iowa',
  'Utah': 'Utah',
  'Oklahoma State': 'Oklahoma State',
  'Kentucky': 'Kentucky',
  'South Carolina': 'South Carolina',
  'Mississippi State': 'Mississippi State',
  'Arkansas': 'Arkansas',
  'Missouri': 'Missouri',
  'Kansas State': 'Kansas State',
  'TCU': 'TCU',
  'Baylor': 'Baylor',
  'North Carolina': 'North Carolina',
  'NC State': 'NC State',
  'Virginia Tech': 'Virginia Tech',
  'Pittsburgh': 'Pittsburgh',
  'Louisville': 'Louisville',
  'Jacksonville State': 'Jacksonville State',
  'Middle Tennessee': 'Middle Tennessee',
};

// NCAAB-specific team name mappings: DB name -> Polymarket name
// Handles cases where database abbreviations differ from Polymarket's full names
const NCAAB_TEAM_MAPPINGS: Record<string, string> = {
  // "U" prefix abbreviations
  'UAlbany': 'Albany',
  'UMass Lowell': 'Massachusetts Lowell',
  'UMass': 'Massachusetts',
  'UConn': 'Connecticut',
  'UNC': 'North Carolina',
  'UNC Wilmington': 'UNCW',
  'UNC Greensboro': 'UNCG',
  'UNC Asheville': 'UNC Asheville',
  'UNLV': 'UNLV',
  'UTEP': 'UTEP',
  'UTSA': 'UTSA',
  'UT Martin': 'UT Martin',
  'UT Arlington': 'UT Arlington',
  'UCF': 'UCF',
  'UCLA': 'UCLA',
  'UCSB': 'UC Santa Barbara',
  'UCI': 'UC Irvine',
  'UCD': 'UC Davis',
  'UCR': 'UC Riverside',
  // Directional/regional abbreviations
  'ETSU': 'East Tennessee State',
  'MTSU': 'Middle Tennessee',
  'FGCU': 'Florida Gulf Coast',
  'SFA': 'Stephen F Austin',
  'SMU': 'SMU',
  'VCU': 'VCU',
  'BYU': 'BYU',
  'TCU': 'TCU',
  'LSU': 'LSU',
  'USC': 'USC',
  // Saint/St variations
  "St. John's": "St Johns",
  "Saint Mary's": "Saint Marys",
  "St. Bonaventure": "St Bonaventure",
  "St. Thomas": "St Thomas",
  "Saint Peter's": "Saint Peters",
  "St. Francis (PA)": "St Francis",
  // Cal State / UC system
  'Cal State Northridge': 'CSUN',
  'Cal State Bakersfield': 'Bakersfield',
  'Cal State Fullerton': 'Cal State Fullerton',
  'Cal Poly': 'Cal Poly',
  'UC Irvine': 'UC Irvine',
  'UC San Diego': 'California San Diego',
  'UC Davis': 'UC Davis',
  'UC Riverside': 'UC Riverside',
  'UC Santa Barbara': 'UC Santa Barbara',
  'Long Beach State': 'Long Beach State',
  // Other common variations
  'Queens University': 'Queens',
  'Long Island University': 'LIU',
  'Ole Miss': 'Ole Miss',
  'Loyola Chicago': 'Loyola Chicago',
  'Loyola Marymount': 'Loyola Marymount',
  'Miami (OH)': 'Miami OH',
  'Miami (FL)': 'Miami',
  'LIU': 'LIU',
  'NJIT': 'NJIT',
  'SIU Edwardsville': 'SIU Edwardsville',
  'Southern Indiana': 'Southern Indiana',
  'Southeast Missouri State': 'Southeast Missouri State',
  'Purdue Fort Wayne': 'Purdue Fort Wayne',
  'Little Rock': 'Little Rock',
  'Central Arkansas': 'Central Arkansas',
};

const MLB_TEAM_MAPPINGS: Record<string, string> = {
  'Arizona Diamondbacks': 'Arizona Diamondbacks',
  'Atlanta Braves': 'Atlanta Braves',
  'Baltimore Orioles': 'Baltimore Orioles',
  'Boston Red Sox': 'Boston Red Sox',
  'Chicago Cubs': 'Chicago Cubs',
  'Chicago White Sox': 'Chicago White Sox',
  'Cincinnati Reds': 'Cincinnati Reds',
  'Cleveland Guardians': 'Cleveland Guardians',
  'Colorado Rockies': 'Colorado Rockies',
  'Detroit Tigers': 'Detroit Tigers',
  'Houston Astros': 'Houston Astros',
  'Kansas City Royals': 'Kansas City Royals',
  'Los Angeles Angels': 'Los Angeles Angels',
  'Los Angeles Dodgers': 'Los Angeles Dodgers',
  'Miami Marlins': 'Miami Marlins',
  'Milwaukee Brewers': 'Milwaukee Brewers',
  'Minnesota Twins': 'Minnesota Twins',
  'New York Mets': 'New York Mets',
  'New York Yankees': 'New York Yankees',
  'Oakland Athletics': 'Oakland Athletics',
  'Philadelphia Phillies': 'Philadelphia Phillies',
  'Pittsburgh Pirates': 'Pittsburgh Pirates',
  'San Diego Padres': 'San Diego Padres',
  'San Francisco Giants': 'San Francisco Giants',
  'Seattle Mariners': 'Seattle Mariners',
  'St. Louis Cardinals': 'St. Louis Cardinals',
  'St Louis Cardinals': 'St. Louis Cardinals',
  'Tampa Bay Rays': 'Tampa Bay Rays',
  'Texas Rangers': 'Texas Rangers',
  'Toronto Blue Jays': 'Toronto Blue Jays',
  'Washington Nationals': 'Washington Nationals',
};

// ---------------------------------------------------------------------------
// NFL name forms. The slate feeds (nfl_slate_feed) carry full names, the old
// nfl_betting_lines path carried short city names, and Polymarket titles use
// mascots. The cache key must use the FULL name because that is the string
// every shipping client builds its lookup from (web, iOS, Android all read the
// slate). The short-name key is still written so pre-2026-09-01 app builds keep
// finding rows.
// ---------------------------------------------------------------------------

const NFL_SHORT_TO_CITY: Record<string, string> = {
  'LA Rams': 'Los Angeles',
  'LA Chargers': 'Los Angeles',
  'NY Giants': 'New York',
  'NY Jets': 'New York',
};

/** "New England Patriots" -> "New England" (legacy nfl_betting_lines form). */
export const NFL_FULL_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(NFL_TEAM_MASCOTS)
    // The table also carries a couple of full-name keys ("Los Angeles Rams");
    // those are not short forms, but "LA Rams" / "NY Jets" are.
    .filter(([short, mascot]) => !short.endsWith(mascot) || short in NFL_SHORT_TO_CITY)
    .map(([short, mascot]) => [
    `${NFL_SHORT_TO_CITY[short] ?? short} ${mascot}`,
    short,
  ]),
);

/** Any NFL name form -> mascot ("Patriots"), which is what Polymarket titles use. */
export function nflMascot(teamName: string): string {
  if (NFL_FULL_TO_SHORT[teamName]) return teamName.split(' ').pop() as string;
  if (Object.values(NFL_TEAM_MASCOTS).includes(teamName)) return teamName;
  return NFL_TEAM_MASCOTS[teamName] || teamName;
}

/** Legacy short-name pair for an NFL slate game, or null if a name is unknown. */
export function legacyNflNames(game: Game): { away_team: string; home_team: string } | null {
  const away = NFL_FULL_TO_SHORT[game.away_team];
  const home = NFL_FULL_TO_SHORT[game.home_team];
  return away && home ? { away_team: away, home_team: home } : null;
}

// Get team name for matching with Polymarket format
// NFL: mascots (Ravens, Dolphins)
// NBA: mascots (Hornets, Bucks) - extract from full name
// CFB: school names (Ohio State, Michigan)
// NCAAB: Polymarket uses "Duke Blue Devils", database has "Duke" - fuzzy matcher handles it
// MLB: full team names (New York Yankees)
export function getTeamName(teamName: string, league: League): string {
  if (league === 'nba') {
    const mascot = NBA_TEAM_TO_MASCOT[teamName];
    if (mascot) return mascot;
    const parts = teamName.split(' ');
    return parts[parts.length - 1];
  }
  if (league === 'ncaab') {
    return NCAAB_TEAM_MAPPINGS[teamName] || CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  if (league === 'cfb') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  if (league === 'mlb') {
    return MLB_TEAM_MAPPINGS[teamName] || teamName;
  }
  return nflMascot(teamName);
}

// ---------------------------------------------------------------------------
// Keys and time window
// ---------------------------------------------------------------------------

export function buildGameKey(league: League, awayTeam: string, homeTeam: string): string {
  return `${league}_${awayTeam}_${homeTeam}`;
}

export interface RefreshWindow {
  /** Games we refresh: kicking off within the next 8 days, or started in the last 8h. */
  gameStartMin: Date;
  gameStartMax: Date;
  /** gamma-api `end_date_*` filter. Wider than the game window because market end
   *  dates lag kickoff (MLB moneylines close ~7 days after first pitch); events
   *  are trimmed to the game window client-side afterwards. */
  marketEndMin: Date;
  marketEndMax: Date;
}

export function computeWindow(now: Date): RefreshWindow {
  const hour = 3_600_000;
  const day = 24 * hour;
  return {
    gameStartMin: new Date(now.getTime() - 8 * hour),
    gameStartMax: new Date(now.getTime() + 8 * day),
    marketEndMin: new Date(now.getTime() - 1 * day),
    marketEndMax: new Date(now.getTime() + 16 * day),
  };
}

/** Events with an unparseable start date are kept — dropping them would hide games. */
export function eventInWindow(event: SlimEvent, w: RefreshWindow): boolean {
  if (!event.startDate) return true;
  const t = new Date(event.startDate).getTime();
  if (Number.isNaN(t)) return true;
  return t >= w.gameStartMin.getTime() && t <= w.gameStartMax.getTime();
}

// ---------------------------------------------------------------------------
// Slimming gamma-api /markets rows into per-event buckets
// ---------------------------------------------------------------------------

export function slimMarket(raw: Record<string, unknown>): SlimMarket {
  const line = raw.line;
  return {
    id: String(raw.id ?? ''),
    slug: String(raw.slug ?? raw.marketSlug ?? ''),
    question: String(raw.question ?? ''),
    active: raw.active !== false,
    closed: raw.closed === true,
    clobTokenIds: (raw.clobTokenIds as string | string[] | null | undefined) ?? null,
    sportsMarketType: (raw.sportsMarketType as string | null | undefined) ?? null,
    line: typeof line === 'number' ? line : null,
  };
}

/**
 * Fold a page of /markets rows into `into`, keyed by parent event. Each row
 * carries its parent under `events[0]`; rows without one are dropped. Only the
 * fields the matcher and the web fallback (polymarketService.ts) read survive.
 */
export function mergeMarketsIntoEvents(
  rows: Array<Record<string, unknown>>,
  into: Map<string, SlimEvent> = new Map(),
): Map<string, SlimEvent> {
  for (const raw of rows) {
    const parents = raw.events;
    const parent = Array.isArray(parents) ? (parents[0] as Record<string, unknown> | undefined) : undefined;
    if (!parent) continue;
    const id = String(parent.id ?? parent.slug ?? '');
    if (!id) continue;
    let event = into.get(id);
    if (!event) {
      event = {
        id,
        slug: String(parent.slug ?? ''),
        title: String(parent.title ?? ''),
        startDate: (parent.startTime as string | undefined) ?? (parent.startDate as string | undefined) ?? null,
        endDate: (parent.endDate as string | undefined) ?? null,
        markets: [],
      };
      into.set(id, event);
    }
    event.markets.push(slimMarket(raw));
  }
  return into;
}

// ---------------------------------------------------------------------------
// Matching a slate game to a Polymarket event
// ---------------------------------------------------------------------------

/** "Team A vs. Team B" / "Team A @ Team B" -> sides. */
export function parseTeamsFromTitle(title: string): { team1: string; team2: string } | null {
  let parts = title.split(' vs. ');
  if (parts.length !== 2) parts = title.split(' @ ');
  if (parts.length !== 2) return null;
  return { team1: parts[0].trim(), team2: parts[1].trim() };
}

/**
 * True for the plain game event ("Patriots vs. Seahawks"). Sub-events use a
 * " - " suffix ("… - Player Props", "… - 1st Inning Winner") and series
 * markets a "Sport: " prefix; both parse as a game and used to win the match
 * when they sorted first.
 */
export function isMainGameTitle(title: string): boolean {
  if (!title) return false;
  if (!(title.includes(' vs. ') || title.includes(' @ '))) return false;
  return !title.includes(' - ') && !title.includes(': ');
}

const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Does a DB team name appear on one side of a Polymarket title? */
function teamMatchesSide(dbTeamName: string, polymarketSide: string): boolean {
  const dbClean = cleanName(dbTeamName);
  const sideClean = cleanName(polymarketSide);
  if (!dbClean) return false;
  // Full name as substring (handles "Penn State" in "Penn State Nittany Lions")
  if (sideClean.includes(dbClean)) return true;
  // Single-word names: word-level match ("Duke" in "Duke Blue Devils")
  const dbWords = dbClean.split(/\s+/);
  if (dbWords.length === 1 && dbWords[0].length > 2) {
    return sideClean.split(/\s+/).some((w) => w === dbWords[0] || w.startsWith(dbWords[0]));
  }
  return false;
}

/** Fuzzy title match — the original algorithm, each DB team tested against each side. */
export function findMatchingEvent(
  events: SlimEvent[],
  awayTeam: string,
  homeTeam: string,
  league: League,
): SlimEvent | null {
  const awayName = getTeamName(awayTeam, league);
  const homeName = getTeamName(homeTeam, league);
  for (const event of events) {
    const parsed = parseTeamsFromTitle(event.title || '');
    if (!parsed) continue;
    const awaySide1 = teamMatchesSide(awayName, parsed.team1) || teamMatchesSide(awayTeam, parsed.team1);
    const homeSide2 = teamMatchesSide(homeName, parsed.team2) || teamMatchesSide(homeTeam, parsed.team2);
    const awaySide2 = teamMatchesSide(awayName, parsed.team2) || teamMatchesSide(awayTeam, parsed.team2);
    const homeSide1 = teamMatchesSide(homeName, parsed.team1) || teamMatchesSide(homeTeam, parsed.team1);
    if ((awaySide1 && homeSide2) || (awaySide2 && homeSide1)) return event;
  }
  return null;
}

/**
 * Exact strategies first, fuzzy last:
 *   1. NFL slug prefix — Polymarket slugs are "nfl-ne-sea-2026-09-10" and the
 *      slate's away_ab/home_ab are the same codes, so this is unambiguous.
 *   2. Exact "Away vs. Home" title (MLB uses full names on both sides).
 *   3. The original substring matcher (CFB/NCAAB/NBA naming drift).
 */
export function matchGameToEvent(events: SlimEvent[], game: Game): SlimEvent | null {
  if (game.league === 'nfl' && game.away_ab && game.home_ab) {
    const code = (ab: string) => ab.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Anchored on the date so "…-2026-09-10-player-props" can never win.
    const slugPattern = new RegExp(`^nfl-${code(game.away_ab)}-${code(game.home_ab)}-\\d{4}-\\d{2}-\\d{2}$`);
    const bySlug = events.find((e) => slugPattern.test(e.slug.toLowerCase()));
    if (bySlug) return bySlug;
  }
  const exact = `${game.away_team} vs. ${game.home_team}`.toLowerCase();
  const byTitle = events.find((e) => e.title.toLowerCase() === exact);
  if (byTitle) return byTitle;
  return findMatchingEvent(events, game.away_team, game.home_team, game.league);
}

// ---------------------------------------------------------------------------
// Picking one moneyline / spread / total per event
// ---------------------------------------------------------------------------

const SPORTS_MARKET_TYPE_MAP: Record<string, MarketType> = {
  moneyline: 'moneyline',
  spreads: 'spread',
  totals: 'total',
};

/** Question/slug heuristics, used only when gamma-api omits sportsMarketType. */
export function classifyMarket(question: string, slug: string): MarketType | null {
  const q = question.toLowerCase();
  const s = slug.toLowerCase();
  if (q.includes('1h') || s.includes('-1h-')) return null;
  if (q.includes('spread') || s.includes('-spread-')) return 'spread';
  if (q.includes('o/u') || q.includes('total') || s.includes('-total-')) return 'total';
  if (s.includes('-moneyline') || (!s.includes('-total-') && !s.includes('-spread-'))) return 'moneyline';
  return null;
}

export function marketTypeOf(market: SlimMarket): MarketType | null {
  if (market.sportsMarketType) return SPORTS_MARKET_TYPE_MAP[market.sportsMarketType] ?? null;
  return classifyMarket(market.question, market.slug);
}

/** YES-side token id. gamma-api ships clobTokenIds as a JSON string more often than an array. */
export function extractTokenId(clobTokenIds: SlimMarket['clobTokenIds']): string | null {
  if (!clobTokenIds) return null;
  if (Array.isArray(clobTokenIds)) return clobTokenIds[0] || null;
  try {
    const arr = JSON.parse(clobTokenIds);
    return Array.isArray(arr) && arr[0] ? String(arr[0]) : null;
  } catch {
    return null;
  }
}

function compareIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

export type PickedMarkets = Record<MarketType, { tokenId: string; question: string } | null>;

/**
 * First active market of each type in id order — Polymarket creates the
 * opening line first, so this is the same line the old event-array walk chose.
 */
export function pickMarkets(event: SlimEvent): PickedMarkets {
  const result: PickedMarkets = { moneyline: null, spread: null, total: null };
  const ordered = [...event.markets].sort((a, b) => compareIds(a.id, b.id));
  for (const market of ordered) {
    if (market.closed || !market.active) continue;
    const type = marketTypeOf(market);
    if (!type || result[type]) continue;
    const tokenId = extractTokenId(market.clobTokenIds);
    if (!tokenId) continue;
    result[type] = { tokenId, question: market.question };
  }
  return result;
}
