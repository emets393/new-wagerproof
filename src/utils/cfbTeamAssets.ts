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
  'connecticut': 'uconn',
  'uli monroe': 'ul monroe',
  'louisiana monroe': 'ul monroe',
  'southern mississippi': 'southern miss',
  'miami oh': 'miami (oh)',
  'miami ohio': 'miami (oh)',
  'san jose state': 'san jose state',
  hawaii: 'hawaii',
};

let byName = new Map<string, CfbTeamReference>();
let nameByAlias = new Map<string, string>();

export function isCfbTeamAssetsLoaded(): boolean {
  return byName.size > 0;
}

/** Strip accents / punctuation so "San José State" ≡ "San Jose State", "Hawai'i" ≡ "Hawaii". */
export function normalizeCfbTeamKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ');
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

  for (const row of rows) {
    const ref = toRef(row);
    if (!ref) continue;
    const key = normalizeCfbTeamKey(ref.teamName);
    nextByName.set(key, ref);
    nextAliases.set(key, key);
    if (ref.abbr) {
      nextAliases.set(normalizeCfbTeamKey(ref.abbr), key);
    }
  }

  for (const [alias, canonical] of Object.entries(EXTRA_ALIASES)) {
    if (nextByName.has(canonical) && !nextAliases.has(alias)) {
      nextAliases.set(alias, canonical);
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

export function getCfbTeamAbbrFromAssets(nameOrAbbr: string): string | null {
  const team = lookupCfbTeam(nameOrAbbr);
  return team?.abbr ?? null;
}

/** Test helper — clears the cache between cases. */
export function resetCfbTeamAssetsForTests(): void {
  byName = new Map();
  nameByAlias = new Map();
}
