/**
 * Process-wide cache of the `nfl_teams` reference table — web port of iOS/Android
 * NFLTeamAssets. Cards and detail resolve logos/abbrs from `home_ab`/`away_ab` (or
 * full display names) instead of the old city-only LOGO_MAP, which breaks on
 * slate rows like "Seattle Seahawks".
 */

export interface NflTeamReference {
  abbr: string;
  name: string;
  nick: string | null;
  logoEspn: string | null;
  /** City / short label used by legacy `nfl_betting_lines.training_key`. */
  linesCity: string;
}

/** Loose row shape from Supabase `nfl_teams`. */
export interface NflTeamRow {
  team_abbr?: string | null;
  team_name?: string | null;
  team_nick?: string | null;
  logo_espn?: string | null;
}

/**
 * Betting-lines city labels (legacy VSiN / nfl_betting_lines keys). Must stay
 * aligned with how `training_key` is built: `{homeCity}{awayCity}{season}{week}`.
 */
const LINES_CITY_BY_ABBR: Record<string, string> = {
  ARI: 'Arizona',
  ATL: 'Atlanta',
  BAL: 'Baltimore',
  BUF: 'Buffalo',
  CAR: 'Carolina',
  CHI: 'Chicago',
  CIN: 'Cincinnati',
  CLE: 'Cleveland',
  DAL: 'Dallas',
  DEN: 'Denver',
  DET: 'Detroit',
  GB: 'Green Bay',
  HOU: 'Houston',
  IND: 'Indianapolis',
  JAX: 'Jacksonville',
  JAC: 'Jacksonville',
  KC: 'Kansas City',
  LV: 'Las Vegas',
  LAC: 'LA Chargers',
  LA: 'LA Rams',
  LAR: 'LA Rams',
  MIA: 'Miami',
  MIN: 'Minnesota',
  NE: 'New England',
  NO: 'New Orleans',
  NYG: 'NY Giants',
  NYJ: 'NY Jets',
  PHI: 'Philadelphia',
  PIT: 'Pittsburgh',
  SF: 'San Francisco',
  SEA: 'Seattle',
  TB: 'Tampa Bay',
  TEN: 'Tennessee',
  WAS: 'Washington',
  WSH: 'Washington',
};

const ESPN_SLUG_BY_ABBR: Record<string, string> = {
  ARI: 'ari',
  ATL: 'atl',
  BAL: 'bal',
  BUF: 'buf',
  CAR: 'car',
  CHI: 'chi',
  CIN: 'cin',
  CLE: 'cle',
  DAL: 'dal',
  DEN: 'den',
  DET: 'det',
  GB: 'gb',
  HOU: 'hou',
  IND: 'ind',
  JAX: 'jax',
  JAC: 'jax',
  KC: 'kc',
  LV: 'lv',
  LAC: 'lac',
  LA: 'lar',
  LAR: 'lar',
  MIA: 'mia',
  MIN: 'min',
  NE: 'ne',
  NO: 'no',
  NYG: 'nyg',
  NYJ: 'nyj',
  PHI: 'phi',
  PIT: 'pit',
  SF: 'sf',
  SEA: 'sea',
  TB: 'tb',
  TEN: 'ten',
  WAS: 'wsh',
  WSH: 'wsh',
};

let byAbbr = new Map<string, NflTeamReference>();
let abbrByAlias = new Map<string, string>();

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function espnFallbackLogo(abbr: string): string | null {
  const slug = ESPN_SLUG_BY_ABBR[abbr.toUpperCase()];
  return slug ? `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png` : null;
}

export function isNflTeamAssetsLoaded(): boolean {
  return byAbbr.size > 0;
}

/** Replace the process cache with a fresh `nfl_teams` snapshot. */
export function installNflTeamAssets(rows: readonly NflTeamRow[]): void {
  const nextByAbbr = new Map<string, NflTeamReference>();
  const nextAliases = new Map<string, string>();

  for (const row of rows) {
    const abbr = String(row.team_abbr ?? '')
      .trim()
      .toUpperCase();
    const name = String(row.team_name ?? '').trim();
    if (!abbr || !name) continue;

    const nick = typeof row.team_nick === 'string' && row.team_nick.trim() ? row.team_nick.trim() : null;
    const logoEspn =
      (typeof row.logo_espn === 'string' && row.logo_espn.trim()) || espnFallbackLogo(abbr);
    const linesCity = LINES_CITY_BY_ABBR[abbr] || (nick ? name.replace(new RegExp(`\\s+${nick}$`, 'i'), '') : name);

    const ref: NflTeamReference = {
      abbr,
      name,
      nick,
      logoEspn,
      linesCity: linesCity.trim() || name,
    };
    nextByAbbr.set(abbr, ref);

    nextAliases.set(normalizeAlias(abbr), abbr);
    nextAliases.set(normalizeAlias(name), abbr);
    if (nick) nextAliases.set(normalizeAlias(nick), abbr);
    if (linesCity) nextAliases.set(normalizeAlias(linesCity), abbr);
  }

  // Common aliases that don't appear as table fields.
  for (const [alias, abbr] of Object.entries({
    jac: 'JAX',
    wsh: 'WAS',
    was: 'WAS',
    lar: 'LA',
    'la rams': 'LA',
    'los angeles rams': 'LA',
    'la chargers': 'LAC',
    'los angeles chargers': 'LAC',
  })) {
    if (nextByAbbr.has(abbr) && !nextAliases.has(alias)) {
      nextAliases.set(alias, abbr);
    }
  }

  byAbbr = nextByAbbr;
  abbrByAlias = nextAliases;
}

export function resolveNflAbbr(nameOrAbbr: string): string | null {
  const key = normalizeAlias(nameOrAbbr);
  if (!key) return null;
  const upper = key.toUpperCase();
  if (byAbbr.has(upper)) return upper;
  const fromAlias = abbrByAlias.get(key);
  if (fromAlias) return fromAlias;
  if (LINES_CITY_BY_ABBR[upper]) return upper;
  return null;
}

export function lookupNflTeam(nameOrAbbr: string): NflTeamReference | null {
  const abbr = resolveNflAbbr(nameOrAbbr);
  if (!abbr) return null;
  return byAbbr.get(abbr) ?? null;
}

export function getNflTeamLogo(nameOrAbbr: string): string | null {
  const team = lookupNflTeam(nameOrAbbr);
  if (team?.logoEspn) return team.logoEspn;
  const abbr = resolveNflAbbr(nameOrAbbr);
  return abbr ? espnFallbackLogo(abbr) : null;
}

export function getNflTeamAbbr(nameOrAbbr: string): string | null {
  return lookupNflTeam(nameOrAbbr)?.abbr ?? resolveNflAbbr(nameOrAbbr);
}

/** Legacy `nfl_betting_lines` city label for an abbr / team string. */
export function getNflLinesCity(nameOrAbbr: string): string | null {
  const team = lookupNflTeam(nameOrAbbr);
  if (team) return team.linesCity;
  const abbr = String(nameOrAbbr || '')
    .trim()
    .toUpperCase();
  return LINES_CITY_BY_ABBR[abbr] ?? null;
}

/**
 * Build the legacy betting-lines training_key for a slate game.
 * Format: `{homeCity}{awayCity}{season}{week}` (no separators).
 */
export function buildNflBettingLinesKey(
  homeAbOrName: string,
  awayAbOrName: string,
  season: number,
  week: number,
): string | null {
  const homeCity = getNflLinesCity(homeAbOrName);
  const awayCity = getNflLinesCity(awayAbOrName);
  if (!homeCity || !awayCity || !season || !week) return null;
  return `${homeCity}${awayCity}${season}${week}`;
}

/** Test helper — clears the cache between cases. */
export function resetNflTeamAssetsForTests(): void {
  byAbbr = new Map();
  abbrByAlias = new Map();
}
