/**
 * Process-wide cache of the `cfb_teams` reference table — web port of iOS/Android
 * CFBTeamAssets. CFB has ~137 FBS teams; Outliers cards and matchup tiles resolve
 * logos/colors/abbr from this cache instead of hardcoding ESPN ids.
 *
 * Install once after fetching `cfb_teams` (Outliers slate + /games feed). Lookups
 * are sync thereafter, matching NFL/MLB teamVisuals behavior.
 */

export interface CfbTeamReference {
  teamName: string;
  abbr: string | null;
  logo: string | null;
  logoDark: string | null;
  color: string | null;
  altColor: string | null;
}

/** Loose row shape from Supabase `cfb_teams` / `cfb_team_mapping`. */
export interface CfbTeamRow {
  team_name?: string | null;
  api?: string | null;
  abbr?: string | null;
  logo?: string | null;
  logo_dark?: string | null;
  logo_light?: string | null;
  color?: string | null;
  alt_color?: string | null;
}

/**
 * Alternate spellings that don't show up as `abbr` in cfb_teams but appear in
 * model output, coach cards, or older static color maps.
 * Values are the canonical `team_name` keys after {@link normalizeCfbTeamKey}.
 */
const EXTRA_ALIASES: Record<string, string> = {
  pitt: 'pittsburgh',
  'appalachian state': 'app state',
  'florida atlantic': 'florida atlantic',
  fau: 'florida atlantic',
  'florida international': 'florida international',
  fiu: 'florida international',
  'james madison': 'james madison',
  jmu: 'james madison',
  connecticut: 'uconn',
  'uli monroe': 'ul monroe',
  'louisiana monroe': 'ul monroe',
  'southern mississippi': 'southern miss',
  'miami oh': 'miami (oh)',
  'miami ohio': 'miami (oh)',
  'san jose state': 'san jose state',
  hawaii: 'hawaii',
  // FCS opponents on the FBS slate — not in the 137-team cfb_teams table.
  ndsu: 'north dakota state',
  'n dakota state': 'north dakota state',
  'n dakota st': 'north dakota state',
  sac: 'sacramento state',
  sacst: 'sacramento state',
  'sac state': 'sacramento state',
  citadel: 'the citadel',
};

/**
 * FCS / non-FBS schools that appear on the slate as opponents but are
 * absent from `cfb_teams` (FBS-only). Seeded from `cfb_team_mapping` ESPN ids
 * so logos resolve everywhere the assets cache is installed.
 */
const SUPPLEMENTAL_TEAMS: readonly CfbTeamRow[] = [
  {
    team_name: 'North Dakota State',
    abbr: 'NDSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2449.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2449.png',
    color: '#01402A',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Sacramento State',
    abbr: 'SAC',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/16.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/16.png',
    color: '#00573C',
    alt_color: '#CDB97D',
  },
  // Every FCS/non-FBS school on the 2026 Competition slate, resolved to real
  // ESPN identities (owner 2026-09-01: wrong/missing FCS logos). Extend as new
  // opponents appear — never let the fuzzy matcher guess.
  {
    team_name: 'Abilene Christian',
    abbr: 'ACU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2000.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2000.png',
    color: '#592d82',
    alt_color: '#b1b3b3',
  },
  {
    team_name: 'Alcorn State',
    abbr: 'ALCN',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2016.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2016.png',
    color: '#4b0058',
    alt_color: '#46166a',
  },
  {
    team_name: 'Austin Peay',
    abbr: 'APSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2046.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2046.png',
    color: '#8e0b0b',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Bryant',
    abbr: 'BRY',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2803.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2803.png',
    color: '#000000',
    alt_color: '#9f8343',
  },
  {
    team_name: 'Charleston Southern',
    abbr: 'CHSO',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2127.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2127.png',
    color: '#2e3192',
    alt_color: '#ded090',
  },
  {
    // Slate feeds say both "The Citadel" and bare "Citadel" — register both
    // names so the prefix matcher hits either form.
    team_name: 'Citadel',
    abbr: 'CIT',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2643.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2643.png',
    color: '#3975B7',
    alt_color: '#FFC72C',
  },
  {
    team_name: 'The Citadel',
    abbr: 'CIT',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2643.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2643.png',
    color: '#3975B7',
    alt_color: '#FFC72C',
  },
  {
    team_name: 'Duquesne',
    abbr: 'DUQ',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2184.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2184.png',
    color: '#002D62',
    alt_color: '#b90b2e',
  },
  {
    team_name: 'Eastern Kentucky',
    abbr: 'EKU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2198.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2198.png',
    color: '#660819',
    alt_color: '#f0f0f0',
  },
  {
    team_name: 'Fordham',
    abbr: 'FOR',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2230.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2230.png',
    color: '#830032',
    alt_color: '#909090',
  },
  {
    team_name: 'Furman',
    abbr: 'FUR',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/231.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/231.png',
    color: '#582c83',
    alt_color: '#ffffff',
  },
  {
    team_name: 'Hampton',
    abbr: 'HAMP',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2261.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2261.png',
    color: '#0067AC',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Idaho State',
    abbr: 'IDST',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/304.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/304.png',
    color: '#ef8c00',
    alt_color: '#e9a126',
  },
  {
    team_name: 'Indiana State',
    abbr: 'INST',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/282.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/282.png',
    color: '#00669a',
    alt_color: '#f0f0f0',
  },
  {
    team_name: 'Lafayette',
    abbr: 'LAF',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/322.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/322.png',
    color: '#790000',
    alt_color: '#a59474',
  },
  {
    team_name: 'Lamar',
    abbr: 'LAM',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2320.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2320.png',
    color: '#000000',
    alt_color: '#ebebeb',
  },
  {
    team_name: 'LIU',
    abbr: 'LIU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/112358.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/112358.png',
    color: '#041c2c',
    alt_color: '#85b8d4',
  },
  {
    team_name: 'Maine',
    abbr: 'ME',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/311.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/311.png',
    color: '#127dbe',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Mercyhurst',
    abbr: 'MERC',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2385.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2385.png',
    color: '#000000',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Mississippi Valley State',
    abbr: 'MVSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2400.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2400.png',
    color: '#005328',
    alt_color: '#cf2d34',
  },
  {
    team_name: 'Morgan State',
    abbr: 'MORG',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2415.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2415.png',
    color: '#014786',
    alt_color: '#f47937',
  },
  {
    team_name: 'Murray State',
    abbr: 'MUR',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/93.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/93.png',
    color: '#002148',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'New Hampshire',
    abbr: 'UNH',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/160.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/160.png',
    color: '#004990',
    alt_color: '#c3c4c6',
  },
  {
    team_name: 'Nicholls',
    abbr: 'NICH',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2447.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2447.png',
    color: '#C41230',
    alt_color: '#f0f0f0',
  },
  {
    team_name: 'Norfolk State',
    abbr: 'NORF',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2450.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2450.png',
    color: '#0c8968',
    alt_color: '#fdb813',
  },
  {
    team_name: 'North Alabama',
    abbr: 'UNA',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2453.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2453.png',
    color: '#000000',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Northern Arizona',
    abbr: 'NAU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2464.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2464.png',
    color: '#003976',
    alt_color: '#1b3069',
  },
  {
    team_name: 'Northwestern State',
    abbr: 'NWST',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2466.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2466.png',
    color: '#492F91',
    alt_color: '#ed6118',
  },
  {
    team_name: 'Portland State',
    abbr: 'PRST',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2502.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2502.png',
    color: '#00311e',
    alt_color: '#ebebeb',
  },
  {
    team_name: 'Rhode Island',
    abbr: 'URI',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/227.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/227.png',
    color: '#091f3f',
    alt_color: '#5ab3e8',
  },
  {
    team_name: 'Sam Houston',
    abbr: 'SHSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2534.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2534.png',
    color: '#f56423',
    alt_color: '#ffffff',
  },
  {
    team_name: 'South Dakota State',
    abbr: 'SDST',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2571.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2571.png',
    color: '#0033a0',
    alt_color: '#ffd100',
  },
  {
    team_name: 'Southeast Missouri State',
    abbr: 'SEMO',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2546.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2546.png',
    color: '#c8102e',
    alt_color: '#000000',
  },
  {
    team_name: 'Southeastern Louisiana',
    abbr: 'SELA',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2545.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2545.png',
    color: '#006341',
    alt_color: '#FFC423',
  },
  {
    team_name: 'Tarleton State',
    abbr: 'TAR',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2627.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2627.png',
    color: '#000000',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Tennessee State',
    abbr: 'TNST',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2634.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2634.png',
    color: '#171796',
    alt_color: '#f0f0f0',
  },
  {
    team_name: 'Towson',
    abbr: 'TOW',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/119.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/119.png',
    color: '#FFC229',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'Utah Tech',
    abbr: 'UTU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/3101.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/3101.png',
    color: '#000000',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'UT Rio Grande Valley',
    abbr: 'RGV',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/292.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/292.png',
    color: '#444444',
    alt_color: '#FFFFFF',
  },
  {
    team_name: 'VMI',
    abbr: 'VMI',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2678.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2678.png',
    color: '#ae122a',
    alt_color: '#000000',
  },
  {
    team_name: 'Youngstown State',
    abbr: 'YSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2754.png',
    logo_dark: 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2754.png',
    color: '#c8102e',
    alt_color: '#000000',
  },
];

let byName = new Map<string, CfbTeamReference>();
let nameByAlias = new Map<string, string>();

export function isCfbTeamAssetsLoaded(): boolean {
  return byName.size > 0;
}

/**
 * Strip accents / punctuation so "San José State" ≡ "San Jose State",
 * "Hawai'i" ≡ "Hawaii". Also expands a trailing "St" → "State" so lines feeds
 * ("North Dakota St", "Sacramento St") match canonical school names.
 */
export function normalizeCfbTeamKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\bst$/g, 'state');
}

function toRef(row: CfbTeamRow): CfbTeamReference | null {
  const teamName = String(row.team_name ?? row.api ?? '').trim();
  if (!teamName) return null;
  const logo =
    (typeof row.logo === 'string' && row.logo.trim()) ||
    (typeof row.logo_light === 'string' && row.logo_light.trim()) ||
    null;
  const logoDark =
    (typeof row.logo_dark === 'string' && row.logo_dark.trim()) || null;
  return {
    teamName,
    abbr: typeof row.abbr === 'string' && row.abbr.trim() ? row.abbr.trim() : null,
    logo: logo || logoDark,
    logoDark: logoDark || logo,
    color: typeof row.color === 'string' && row.color.trim() ? row.color.trim() : null,
    altColor:
      typeof row.alt_color === 'string' && row.alt_color.trim()
        ? row.alt_color.trim()
        : null,
  };
}

/** Replace the process cache with a fresh `cfb_teams` snapshot. */
export function installCfbTeamAssets(rows: readonly CfbTeamRow[]): void {
  const nextByName = new Map<string, CfbTeamReference>();
  const nextAliases = new Map<string, string>();

  const ingest = (row: CfbTeamRow, overwrite = true) => {
    const ref = toRef(row);
    if (!ref) return;
    const key = normalizeCfbTeamKey(ref.teamName);
    if (!overwrite && nextByName.has(key)) return;
    nextByName.set(key, ref);
    nextAliases.set(key, key);
    if (ref.abbr) {
      // Abbrs are left as-is by St→State expand (no "st" token); register raw + normalized.
      nextAliases.set(normalizeCfbTeamKey(ref.abbr), key);
      nextAliases.set(ref.abbr.trim().toLowerCase(), key);
    }
  };

  for (const row of rows) ingest(row, true);
  // Fill FCS opponents missing from the FBS-only cfb_teams table.
  for (const row of SUPPLEMENTAL_TEAMS) ingest(row, false);

  for (const [alias, canonical] of Object.entries(EXTRA_ALIASES)) {
    const aliasKey = normalizeCfbTeamKey(alias);
    if (nextByName.has(canonical) && !nextAliases.has(aliasKey)) {
      nextAliases.set(aliasKey, canonical);
    }
  }

  byName = nextByName;
  nameByAlias = nextAliases;
}

export function lookupCfbTeam(nameOrAbbr: string): CfbTeamReference | null {
  const key = normalizeCfbTeamKey(nameOrAbbr);
  if (!key) return null;
  const canonical = nameByAlias.get(key) ?? key;
  return byName.get(canonical) ?? null;
}

export function getCfbTeamLogo(nameOrAbbr: string, dark = false): string | null {
  const team = lookupCfbTeam(nameOrAbbr);
  if (!team) return null;
  return dark ? team.logoDark ?? team.logo : team.logo ?? team.logoDark;
}

// Words that turn "<school> X" into a DIFFERENT school: "Indiana State" must
// never fall back to Indiana's logo (FCS opponents poisoned Competition cards
// with FBS logos, 2026-09-01). A wrong logo is worse than no logo.
const SCHOOL_SUFFIXES = new Set([
  'state', 'st', 'tech', 'a&m', 'am', 'southern', 'central',
  'international', 'wesleyan', 'christian',
]);

/**
 * Loose match for Odds-API style names ("North Carolina Tar Heels" → North
 * Carolina). A team matches only on exact key or word-boundary PREFIX whose
 * next word doesn't form a different school — never bare substring.
 */
/** Guarded fuzzy team match: exact key or word-boundary prefix whose next word
 * doesn't form a different school. THE ONLY sanctioned fuzzy matcher — every
 * loose lookup (logo, colors, short name) must route through this. */
export function searchCfbTeam(nameOrAbbr: string): CfbTeamReference | null {
  const base = normalizeCfbTeamKey(nameOrAbbr);
  if (!base || byName.size === 0) return null;
  // "Youngstown St Penguins": mid-string "St" is a State abbreviation in team
  // names — try the expanded variant alongside the raw key.
  const keys = new Set([base, base.replace(/\bst\b/g, 'state')]);

  let best: CfbTeamReference | null = null;
  let bestLen = 0;
  for (const key of keys) {
    for (const [teamKey, ref] of byName) {
      if (!teamKey) continue;
      let ok = key === teamKey;
      if (!ok && key.startsWith(teamKey + ' ')) {
        const nextWord = key.slice(teamKey.length + 1).split(' ')[0];
        ok = !SCHOOL_SUFFIXES.has(nextWord);
      }
      if (ok && teamKey.length > bestLen) {
        best = ref;
        bestLen = teamKey.length;
      }
    }
  }
  return best;
}

export function searchCfbTeamLogo(nameOrAbbr: string, dark = false): string | null {
  const best = searchCfbTeam(nameOrAbbr);
  if (!best) return null;
  return dark ? best.logoDark ?? best.logo : best.logo ?? best.logoDark;
}

export function getCfbTeamColorsFromAssets(
  nameOrAbbr: string,
): { primary: string; secondary: string } | null {
  const team = lookupCfbTeam(nameOrAbbr);
  if (!team?.color) return null;
  return {
    primary: team.color,
    secondary: team.altColor ?? team.color,
  };
}

/** Loose color lookup for Odds-API full names ("North Carolina Tar Heels"). */
export function searchCfbTeamColors(
  nameOrAbbr: string,
): { primary: string; secondary: string; teamName: string } | null {
  const best = searchCfbTeam(nameOrAbbr);
  if (!best?.color) return null;
  return {
    primary: best.color,
    secondary: best.altColor ?? '#FFFFFF',
    teamName: best.teamName,
  };
}

export function getCfbTeamAbbrFromAssets(nameOrAbbr: string): string | null {
  const team = lookupCfbTeam(nameOrAbbr);
  return team?.abbr ?? null;
}

/** Test helper — clears the cache between cases. */
export function resetCfbTeamAssetsForTests(): void {
  byName = new Map();
  nameByAlias = new Map();
}
