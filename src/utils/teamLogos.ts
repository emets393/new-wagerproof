import {
  getCfbTeamColorsFromAssets,
  getCfbTeamLogo,
  lookupCfbTeam,
  searchCfbTeam,
  searchCfbTeamColors,
  searchCfbTeamLogo,
} from '@/utils/cfbTeamAssets';
import { getNflTeamLogo } from '@/utils/nflTeamAssets';
import { getCFBTeamColors, getNFLTeamColors } from '@/utils/teamColors';
import type { CompSport } from './types';

/** Odds-API full names → ESPN NFL slugs (works before nfl_teams cache loads). */
const NFL_ODDS_NAME_TO_SLUG: Record<string, string> = {
  'arizona cardinals': 'ari',
  'atlanta falcons': 'atl',
  'baltimore ravens': 'bal',
  'buffalo bills': 'buf',
  'carolina panthers': 'car',
  'chicago bears': 'chi',
  'cincinnati bengals': 'cin',
  'cleveland browns': 'cle',
  'dallas cowboys': 'dal',
  'denver broncos': 'den',
  'detroit lions': 'det',
  'green bay packers': 'gb',
  'houston texans': 'hou',
  'indianapolis colts': 'ind',
  'jacksonville jaguars': 'jax',
  'kansas city chiefs': 'kc',
  'las vegas raiders': 'lv',
  'los angeles chargers': 'lac',
  'los angeles rams': 'lar',
  'miami dolphins': 'mia',
  'minnesota vikings': 'min',
  'new england patriots': 'ne',
  'new orleans saints': 'no',
  'new york giants': 'nyg',
  'new york jets': 'nyj',
  'philadelphia eagles': 'phi',
  'pittsburgh steelers': 'pit',
  'san francisco 49ers': 'sf',
  'seattle seahawks': 'sea',
  'tampa bay buccaneers': 'tb',
  'tennessee titans': 'ten',
  'washington commanders': 'wsh',
  'la chargers': 'lac',
  'la rams': 'lar',
  'ny giants': 'nyg',
  'ny jets': 'nyj',
};

/** Odds-API full name → short city/brand used by getNFLTeamColors. */
const NFL_ODDS_NAME_TO_COLOR_KEY: Record<string, string> = {
  'arizona cardinals': 'Arizona',
  'atlanta falcons': 'Atlanta',
  'baltimore ravens': 'Baltimore',
  'buffalo bills': 'Buffalo',
  'carolina panthers': 'Carolina',
  'chicago bears': 'Chicago',
  'cincinnati bengals': 'Cincinnati',
  'cleveland browns': 'Cleveland',
  'dallas cowboys': 'Dallas',
  'denver broncos': 'Denver',
  'detroit lions': 'Detroit',
  'green bay packers': 'Green Bay',
  'houston texans': 'Houston',
  'indianapolis colts': 'Indianapolis',
  'jacksonville jaguars': 'Jacksonville',
  'kansas city chiefs': 'Kansas City',
  'las vegas raiders': 'Las Vegas',
  'los angeles chargers': 'Los Angeles Chargers',
  'los angeles rams': 'Los Angeles Rams',
  'miami dolphins': 'Miami',
  'minnesota vikings': 'Minnesota',
  'new england patriots': 'New England',
  'new orleans saints': 'New Orleans',
  'new york giants': 'NY Giants',
  'new york jets': 'NY Jets',
  'philadelphia eagles': 'Philadelphia',
  'pittsburgh steelers': 'Pittsburgh',
  'san francisco 49ers': 'San Francisco',
  'seattle seahawks': 'Seattle',
  'tampa bay buccaneers': 'Tampa Bay',
  'tennessee titans': 'Tennessee',
  'washington commanders': 'Washington',
};

function nflEspnUrl(slug: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`;
}

/** Resolve ESPN logo for Odds-API style full team names. */
export function compTeamLogo(sport: CompSport, teamName: string): string | null {
  const raw = teamName?.trim();
  if (!raw) return null;

  if (sport === 'nfl') {
    const fromAssets = getNflTeamLogo(raw);
    if (fromAssets) return fromAssets;

    const lower = raw.toLowerCase();
    const slug = NFL_ODDS_NAME_TO_SLUG[lower];
    if (slug) return nflEspnUrl(slug);

    for (const [name, s] of Object.entries(NFL_ODDS_NAME_TO_SLUG)) {
      if (lower.includes(name) || name.includes(lower)) return nflEspnUrl(s);
    }
    return null;
  }

  const direct = getCfbTeamLogo(raw);
  if (direct) return direct;
  // ONLY the guarded matcher — the old word-stripping loop turned "Indiana
  // State Sycamores" into Indiana's logo (2026-09-01 Competition incident).
  return searchCfbTeamLogo(raw);
}

/** Short display name — school / brand, not full Odds-API mascot string. */
export function compTeamShortName(sport: CompSport, teamName: string): string {
  const raw = teamName?.trim();
  if (!raw) return '';

  if (sport === 'cfb') {
    const direct = lookupCfbTeam(raw);
    if (direct?.teamName) return direct.teamName;
    // Guarded matcher only — no word-stripping ("Indiana State" must never
    // shorten to "Indiana").
    const searched = searchCfbTeam(raw);
    if (searched?.teamName) return searched.teamName;
  }

  if (sport === 'nfl') {
    const lower = raw.toLowerCase();
    const key = NFL_ODDS_NAME_TO_COLOR_KEY[lower];
    if (key) return key;
  }

  const parts = raw.split(/\s+/);
  if (parts.length <= 1) return raw;
  const first = parts[0]!;
  if (first.length <= 4 && first === first.toUpperCase()) return first;
  if (parts.length >= 3) return parts.slice(0, -1).join(' ');
  return first;
}

export function compTeamColors(
  sport: CompSport,
  teamName: string
): { primary: string; secondary: string } {
  const raw = teamName?.trim();
  const fallback = { primary: '#6B7280', secondary: '#9CA3AF' };
  if (!raw) return fallback;

  if (sport === 'cfb') {
    const direct = getCfbTeamColorsFromAssets(raw);
    if (direct) return direct;
    const parts = raw.split(/\s+/);
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts.slice(0, i).join(' ');
      const hit = getCfbTeamColorsFromAssets(candidate);
      if (hit) return hit;
    }
    const searched = searchCfbTeamColors(raw);
    if (searched) return { primary: searched.primary, secondary: searched.secondary };
    return getCFBTeamColors(compTeamShortName(sport, raw));
  }

  const lower = raw.toLowerCase();
  const colorKey = NFL_ODDS_NAME_TO_COLOR_KEY[lower];
  if (colorKey) return getNFLTeamColors(colorKey);
  for (const [name, key] of Object.entries(NFL_ODDS_NAME_TO_COLOR_KEY)) {
    if (lower.includes(name) || name.includes(lower)) return getNFLTeamColors(key);
  }
  return getNFLTeamColors(compTeamShortName(sport, raw));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  if (h.length !== 3 && h.length !== 6) return null;
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorDistance(a: string, b: string): number {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return 999;
  return Math.sqrt((pa.r - pb.r) ** 2 + (pa.g - pb.g) ** 2 + (pa.b - pb.b) ** 2);
}

function isVeryDark(hex: string): boolean {
  const p = parseHex(hex);
  if (!p) return false;
  return (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255 < 0.18;
}

function colorsClash(a: string, b: string): boolean {
  if (colorDistance(a, b) < 70) return true;
  if (isVeryDark(a) && isVeryDark(b)) return true;
  return false;
}

/**
 * Away/left + home/right bar colors from team primaries.
 * If primaries clash, swap in a secondary that still contrasts.
 */
export function resolveMatchupBarColors(
  sport: CompSport,
  awayName: string,
  homeName: string
): { left: string; right: string } {
  const away = compTeamColors(sport, awayName);
  const home = compTeamColors(sport, homeName);
  let left = away.primary;
  let right = home.primary;

  if (colorsClash(left, right)) {
    if (!colorsClash(left, home.secondary) && home.secondary.toLowerCase() !== right.toLowerCase()) {
      right = home.secondary;
    } else if (
      !colorsClash(away.secondary, right) &&
      away.secondary.toLowerCase() !== left.toLowerCase()
    ) {
      left = away.secondary;
    } else if (!colorsClash(away.secondary, home.secondary)) {
      left = away.secondary;
      right = home.secondary;
    }
  }

  const ensureVisible = (c: string, fallback: string) => {
    const p = parseHex(c);
    if (!p) return fallback;
    const lum = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255;
    return lum > 0.88 ? fallback : c;
  };

  return {
    left: ensureVisible(left, '#7BAFD4'),
    right: ensureVisible(right, '#4D1979'),
  };
}

export function teamInitials(teamName: string): string {
  const parts = teamName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}
