/**
 * ESPN MLB logo URL keyed by team abbreviation (mlb_game_log convention:
 * AZ for Arizona, ATH for Athletics). Used by the regression report's
 * "By Team" breakdown table to put a logo next to each abbr.
 */

const ESPN_SLUG_BY_ABBR: Record<string, string> = {
  az: 'ari',     // mlb_game_log uses AZ; ESPN expects ari
  ari: 'ari',
  ath: 'ath',    // Athletics
  oak: 'ath',
  lva: 'ath',
  kan: 'kc',
  kc: 'kc',
  tam: 'tb',
  tb: 'tb',
  'st.': 'stl',
  st: 'stl',
  stl: 'stl',
  sd: 'sd',
};

export function mlbLogoUrlFromAbbr(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  const raw = abbr.trim().toLowerCase();
  if (!raw) return null;
  const slug = ESPN_SLUG_BY_ABBR[raw] ?? raw;
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`;
}
