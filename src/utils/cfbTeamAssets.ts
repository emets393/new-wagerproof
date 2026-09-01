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
export function searchCfbTeamLogo(nameOrAbbr: string, dark = false): string | null {
  const key = normalizeCfbTeamKey(nameOrAbbr);
  if (!key || byName.size === 0) return null;

  let best: CfbTeamReference | null = null;
  let bestLen = 0;
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
  const key = normalizeCfbTeamKey(nameOrAbbr);
  if (!key || byName.size === 0) return null;

  let best: CfbTeamReference | null = null;
  let bestLen = 0;
  for (const [teamKey, ref] of byName) {
    if (!teamKey) continue;
    if (key === teamKey || key.includes(teamKey) || teamKey.includes(key)) {
      if (teamKey.length > bestLen) {
        best = ref;
        bestLen = teamKey.length;
      }
    }
  }
  if (!best?.color) return null;
  return {
    primary: best.color,
    secondary: best.altColor ?? best.color,
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
