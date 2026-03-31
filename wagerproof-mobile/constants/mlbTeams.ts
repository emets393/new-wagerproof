/**
 * MLB team data: colors, abbreviations, logo URLs for all 30 teams.
 * Used for game cards, bottom sheets, and as fallback when mlb_team_mapping is unavailable.
 */

export interface MLBTeamInfo {
  team: string; // abbreviation
  logo_url: string;
  primary: string;
  secondary: string;
}

/** Full map of normalized team names -> team info. Keys are lowercase, no apostrophes. */
export const MLB_TEAMS: Record<string, MLBTeamInfo> = {
  'arizona diamondbacks': { team: 'ARI', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png', primary: '#A71930', secondary: '#E3D4AD' },
  'atlanta braves': { team: 'ATL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png', primary: '#CE1141', secondary: '#13274F' },
  'baltimore orioles': { team: 'BAL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png', primary: '#DF4601', secondary: '#27251F' },
  'boston red sox': { team: 'BOS', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png', primary: '#BD3039', secondary: '#0C2340' },
  'chicago cubs': { team: 'CHC', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png', primary: '#0E3386', secondary: '#CC3433' },
  'chicago white sox': { team: 'CWS', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png', primary: '#27251F', secondary: '#C4CED4' },
  'cincinnati reds': { team: 'CIN', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png', primary: '#C6011F', secondary: '#27251F' },
  'cleveland guardians': { team: 'CLE', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png', primary: '#00385D', secondary: '#E31937' },
  'colorado rockies': { team: 'COL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png', primary: '#333366', secondary: '#C4CED4' },
  'detroit tigers': { team: 'DET', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png', primary: '#0C2340', secondary: '#FA4616' },
  'houston astros': { team: 'HOU', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png', primary: '#002D62', secondary: '#EB6E1F' },
  'kansas city royals': { team: 'KC', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png', primary: '#004687', secondary: '#BD9B60' },
  'los angeles angels': { team: 'LAA', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png', primary: '#BA0021', secondary: '#003263' },
  'los angeles dodgers': { team: 'LAD', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png', primary: '#005A9C', secondary: '#EF3E42' },
  'miami marlins': { team: 'MIA', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png', primary: '#00A3E0', secondary: '#EF3340' },
  'milwaukee brewers': { team: 'MIL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png', primary: '#FFC52F', secondary: '#12284B' },
  'minnesota twins': { team: 'MIN', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png', primary: '#002B5C', secondary: '#D31145' },
  'new york mets': { team: 'NYM', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png', primary: '#002D72', secondary: '#FF5910' },
  'new york yankees': { team: 'NYY', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png', primary: '#003087', secondary: '#132448' },
  'oakland athletics': { team: 'OAK', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png', primary: '#003831', secondary: '#EFB21E' },
  'philadelphia phillies': { team: 'PHI', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png', primary: '#E81828', secondary: '#002D72' },
  'pittsburgh pirates': { team: 'PIT', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png', primary: '#27251F', secondary: '#FDB827' },
  'san diego padres': { team: 'SD', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png', primary: '#2F241D', secondary: '#FFC425' },
  'san francisco giants': { team: 'SF', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png', primary: '#FD5A1E', secondary: '#27251F' },
  'seattle mariners': { team: 'SEA', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png', primary: '#0C2C56', secondary: '#005C5C' },
  'st louis cardinals': { team: 'STL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png', primary: '#C41E3A', secondary: '#0C2340' },
  'tampa bay rays': { team: 'TB', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png', primary: '#092C5C', secondary: '#8FBCE6' },
  'texas rangers': { team: 'TEX', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png', primary: '#003278', secondary: '#C0111F' },
  'toronto blue jays': { team: 'TOR', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png', primary: '#134A8E', secondary: '#1D2D5C' },
  'washington nationals': { team: 'WSH', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png', primary: '#AB0003', secondary: '#14225A' },
};

/** Abbreviation-keyed lookup (for quick access when you already have the abbrev). */
const _abbrevMap: Record<string, MLBTeamInfo> = {};
for (const info of Object.values(MLB_TEAMS)) {
  _abbrevMap[info.team] = info;
}

/**
 * MLB Stats API team_id → abbreviation + ESPN slug.
 * Matches `team_id` from `mlb_situational_trends_today`.
 * Source: web app's MLB_STATS_API_TEAM_BRAND.
 */
const MLB_TEAM_BY_ID: Record<number, { abbrev: string; espnSlug: string }> = {
  108: { abbrev: 'LAA', espnSlug: 'laa' },
  109: { abbrev: 'ARI', espnSlug: 'ari' },
  110: { abbrev: 'BAL', espnSlug: 'bal' },
  111: { abbrev: 'BOS', espnSlug: 'bos' },
  112: { abbrev: 'CHC', espnSlug: 'chc' },
  113: { abbrev: 'CIN', espnSlug: 'cin' },
  114: { abbrev: 'CLE', espnSlug: 'cle' },
  115: { abbrev: 'COL', espnSlug: 'col' },
  116: { abbrev: 'DET', espnSlug: 'det' },
  117: { abbrev: 'HOU', espnSlug: 'hou' },
  118: { abbrev: 'KC',  espnSlug: 'kc' },
  119: { abbrev: 'LAD', espnSlug: 'lad' },
  120: { abbrev: 'WSH', espnSlug: 'wsh' },
  121: { abbrev: 'NYM', espnSlug: 'nym' },
  133: { abbrev: 'ATH', espnSlug: 'ath' },
  134: { abbrev: 'PIT', espnSlug: 'pit' },
  135: { abbrev: 'SD',  espnSlug: 'sd' },
  136: { abbrev: 'SEA', espnSlug: 'sea' },
  137: { abbrev: 'SF',  espnSlug: 'sf' },
  138: { abbrev: 'STL', espnSlug: 'stl' },
  139: { abbrev: 'TB',  espnSlug: 'tb' },
  140: { abbrev: 'TEX', espnSlug: 'tex' },
  141: { abbrev: 'TOR', espnSlug: 'tor' },
  142: { abbrev: 'MIN', espnSlug: 'min' },
  143: { abbrev: 'PHI', espnSlug: 'phi' },
  144: { abbrev: 'ATL', espnSlug: 'atl' },
  145: { abbrev: 'CWS', espnSlug: 'cws' },
  146: { abbrev: 'MIA', espnSlug: 'mia' },
  147: { abbrev: 'NYY', espnSlug: 'nyy' },
  158: { abbrev: 'MIL', espnSlug: 'mil' },
};

/**
 * Resolve team display info from MLB Stats API team_id.
 * Returns abbreviation and ESPN logo URL.
 */
export function getMLBTeamById(teamId: number | string): { abbrev: string; logoUrl: string } | null {
  const id = Math.trunc(Number(teamId));
  if (!Number.isFinite(id)) return null;
  const brand = MLB_TEAM_BY_ID[id];
  if (!brand) return null;
  const slug = brand.espnSlug === 'ath' ? 'ath' : brand.espnSlug;
  return {
    abbrev: brand.abbrev,
    logoUrl: `https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`,
  };
}

const FALLBACK_COLORS = { primary: '#1f2937', secondary: '#6b7280' };

/**
 * Get MLB team colors by normalized name or abbreviation.
 * Returns { primary, secondary } hex colors.
 */
export function getMLBTeamColors(nameOrAbbrev: string): { primary: string; secondary: string } {
  // Try abbreviation first
  const byAbbrev = _abbrevMap[nameOrAbbrev.toUpperCase()];
  if (byAbbrev) return { primary: byAbbrev.primary, secondary: byAbbrev.secondary };

  // Try normalized full name
  const normalized = nameOrAbbrev.trim().toLowerCase().replace(/[.'']/g, '').replace(/\s+/g, ' ');
  const byName = MLB_TEAMS[normalized];
  if (byName) return { primary: byName.primary, secondary: byName.secondary };

  // Fuzzy: check if any key contains or is contained by the input
  for (const [key, info] of Object.entries(MLB_TEAMS)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return { primary: info.primary, secondary: info.secondary };
    }
  }

  return FALLBACK_COLORS;
}

/**
 * Get MLB team info (abbrev + logo) by normalized name.
 * Used as fallback when mlb_team_mapping table is empty/inaccessible.
 */
export function getMLBFallbackTeamInfo(teamName: string): { team: string; logo_url: string } | null {
  const normalized = teamName.trim().toLowerCase().replace(/[.'']/g, '').replace(/\s+/g, ' ');
  const info = MLB_TEAMS[normalized];
  if (info) return { team: info.team, logo_url: info.logo_url };

  // Fuzzy match
  let bestMatch: MLBTeamInfo | null = null;
  let bestScore = 0;
  for (const [key, val] of Object.entries(MLB_TEAMS)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      const score = Math.min(key.length, normalized.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = val;
      }
    }
  }
  if (bestMatch) return { team: bestMatch.team, logo_url: bestMatch.logo_url };

  return null;
}
