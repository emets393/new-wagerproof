/**
 * Shared MLB team logo resolution: mapping table, name fallbacks, ESPN CDN slugs.
 * Used by MLB predictions and MLB situational trends (and any other MLB surfaces).
 */

export interface MlbTeamMappingRow {
  mlb_api_id: number;
  team: string;
  team_name: string;
  logo_url: string | null;
}

/** ESPN slug for Athletics (Las Vegas); `lva` / `lv` are not valid under /mlb/500/. */
export const MLB_ATHLETICS_ESPN_LOGO = 'https://a.espncdn.com/i/teamlogos/mlb/500/ath.png';

/**
 * MLB Stats API `team.id` (matches `mlb_api_id` / situational `team_id`).
 * Canonical abbrev + ESPN `/mlb/500/{slug}.png` filename — fixes bad DB abbrevs (e.g. KAN, SAN, TAM, ST., LA/NY ambiguity).
 */
export const MLB_STATS_API_TEAM_BRAND: Record<number, { abbrev: string; espnSlug: string }> = {
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
  118: { abbrev: 'KC', espnSlug: 'kc' },
  119: { abbrev: 'LAD', espnSlug: 'lad' },
  120: { abbrev: 'WSH', espnSlug: 'wsh' },
  121: { abbrev: 'NYM', espnSlug: 'nym' },
  133: { abbrev: 'ATH', espnSlug: 'ath' },
  134: { abbrev: 'PIT', espnSlug: 'pit' },
  135: { abbrev: 'SD', espnSlug: 'sd' },
  136: { abbrev: 'SEA', espnSlug: 'sea' },
  137: { abbrev: 'SF', espnSlug: 'sf' },
  138: { abbrev: 'STL', espnSlug: 'stl' },
  139: { abbrev: 'TB', espnSlug: 'tb' },
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

export function mlbStatsApiTeamBrand(mlbApiId: number): { abbrev: string; espnSlug: string } | undefined {
  return MLB_STATS_API_TEAM_BRAND[mlbApiId];
}

/** ESPN 500px logo URL from slug (`ath` → Athletics asset). */
export function mlbEspn500UrlFromSlug(espnSlug: string): string {
  const s = espnSlug.trim().toLowerCase();
  if (s === 'lva' || s === 'oak' || s === 'ath') return MLB_ATHLETICS_ESPN_LOGO;
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${s}.png`;
}

export const MLB_FALLBACK_BY_NAME: Record<string, { team: string; logo_url: string }> = {
  'arizona diamondbacks': { team: 'ARI', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png' },
  'atlanta braves': { team: 'ATL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png' },
  'baltimore orioles': { team: 'BAL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png' },
  'boston red sox': { team: 'BOS', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png' },
  'chicago cubs': { team: 'CHC', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png' },
  'chicago white sox': { team: 'CWS', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png' },
  'cincinnati reds': { team: 'CIN', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png' },
  'cleveland guardians': { team: 'CLE', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png' },
  'colorado rockies': { team: 'COL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png' },
  /** Short `team_name` values from situational tables (no mapping row). */
  colorado: { team: 'COL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png' },
  'detroit tigers': { team: 'DET', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png' },
  'houston astros': { team: 'HOU', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png' },
  'kansas city royals': { team: 'KC', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png' },
  'los angeles angels': { team: 'LAA', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png' },
  'los angeles dodgers': { team: 'LAD', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png' },
  'miami marlins': { team: 'MIA', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png' },
  'milwaukee brewers': { team: 'MIL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png' },
  'minnesota twins': { team: 'MIN', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png' },
  'new york mets': { team: 'NYM', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png' },
  'new york yankees': { team: 'NYY', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png' },
  'oakland athletics': { team: 'OAK', logo_url: MLB_ATHLETICS_ESPN_LOGO },
  'las vegas athletics': { team: 'ATH', logo_url: MLB_ATHLETICS_ESPN_LOGO },
  athletics: { team: 'ATH', logo_url: MLB_ATHLETICS_ESPN_LOGO },
  'philadelphia phillies': { team: 'PHI', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png' },
  'pittsburgh pirates': { team: 'PIT', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png' },
  'san diego padres': { team: 'SD', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png' },
  'san francisco giants': { team: 'SF', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png' },
  'seattle mariners': { team: 'SEA', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png' },
  'st louis cardinals': { team: 'STL', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png' },
  'tampa bay rays': { team: 'TB', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png' },
  'texas rangers': { team: 'TEX', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png' },
  'toronto blue jays': { team: 'TOR', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png' },
  'washington nationals': { team: 'WSH', logo_url: 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png' },
};

/** Mapping / shorthand → ESPN filename when it isn’t `abbrev.toLowerCase()`. */
const ESPN_SLUG_BY_ABBREV: Record<string, string> = {
  az: 'ari',
  kan: 'kc',
  kc: 'kc',
  tam: 'tb',
  tb: 'tb',
  'st.': 'stl',
  stl: 'stl',
  st: 'stl',
  sd: 'sd',
};

/** Display abbrev for ESPN / cards when `team` column is blank in `mlb_team_mapping`. */
export function abbrevFromTeamNameOnly(teamName: string): string {
  const name = teamName.trim();
  if (!name) return '';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

export function abbrevFromMappingRow(m: MlbTeamMappingRow): string {
  const t = m.team?.trim();
  if (t) return t;
  return abbrevFromTeamNameOnly(m.team_name) || 'MLB';
}

/** Match `mlb_games_today` `*_team_name` to mapping `team_name`. */
export function normalizeTeamNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\s+/g, ' ');
}

/** Map display abbreviations that ESPN does not host as /500/{abbrev}.png. */
export function espnMlb500LogoUrlFromAbbrev(abbrev: string): string {
  const raw = abbrev.trim().toLowerCase();
  if (raw === 'lva' || raw === 'oak' || raw === 'ath') {
    return MLB_ATHLETICS_ESPN_LOGO;
  }
  const slug = ESPN_SLUG_BY_ABBREV[raw] ?? raw;
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`;
}

/** When `mlb_team_mapping` matches but `logo_url` is empty, or abbrev is a known Athletics code. */
export function supplementalMlbLogoUrl(nameKey: string, abbrev: string): string | null {
  const fb = nameKey ? MLB_FALLBACK_BY_NAME[nameKey] : undefined;
  if (fb?.logo_url) return fb.logo_url;
  if (nameKey && (nameKey === 'athletics' || nameKey.endsWith(' athletics'))) {
    return MLB_ATHLETICS_ESPN_LOGO;
  }
  const a = abbrev.trim().toUpperCase();
  if (a === 'LVA' || a === 'OAK' || a === 'ATH') return MLB_ATHLETICS_ESPN_LOGO;
  return null;
}

/**
 * Same resolution as the MLB predictions page: name → id → fuzzy name → hardcoded fallbacks.
 */
export function resolveMlbTeamDisplay(
  teamId: number | null | undefined,
  teamNameFromGame: string | null | undefined,
  teamMapByMlbApiId: Map<number, MlbTeamMappingRow>,
  teamMapByTeamName: Map<string, MlbTeamMappingRow>,
  teamMappingsList: MlbTeamMappingRow[],
): { abbrev: string; logoUrl: string | null } | null {
  const name = teamNameFromGame?.trim();
  const nameKey = name ? normalizeTeamNameKey(name) : '';

  if (nameKey) {
    const byName = teamMapByTeamName.get(nameKey);
    if (byName) {
      const abbrev = abbrevFromMappingRow(byName);
      let url = byName.logo_url?.trim() ?? '';
      if (!url) {
        url = supplementalMlbLogoUrl(nameKey, abbrev) ?? '';
      }
      return { abbrev, logoUrl: url.length > 0 ? url : null };
    }
  }

  if (teamId !== null && teamId !== undefined) {
    const id = Number(teamId);
    if (!Number.isNaN(id) && Number.isFinite(id)) {
      const byId = teamMapByMlbApiId.get(Math.trunc(id));
      if (byId) {
        const abbrev = abbrevFromMappingRow(byId);
        const tnKey = byId.team_name ? normalizeTeamNameKey(byId.team_name) : '';
        let url = byId.logo_url?.trim() ?? '';
        if (!url) {
          url = supplementalMlbLogoUrl(tnKey, abbrev) ?? '';
        }
        return { abbrev, logoUrl: url.length > 0 ? url : null };
      }
    }
  }

  if (nameKey && teamMappingsList.length > 0) {
    let best: MlbTeamMappingRow | null = null;
    let bestScore = 0;
    for (const row of teamMappingsList) {
      if (!row.team_name) continue;
      const tn = normalizeTeamNameKey(row.team_name);
      if (nameKey === tn || nameKey.includes(tn) || tn.includes(nameKey)) {
        const score = Math.min(nameKey.length, tn.length);
        if (score > bestScore) {
          bestScore = score;
          best = row;
        }
      }
    }
    if (best) {
      const abbrev = abbrevFromMappingRow(best);
      const tnKey = best.team_name ? normalizeTeamNameKey(best.team_name) : '';
      let url = best.logo_url?.trim() ?? '';
      if (!url) {
        url = supplementalMlbLogoUrl(tnKey || nameKey, abbrev) ?? '';
      }
      return { abbrev, logoUrl: url.length > 0 ? url : null };
    }
  }

  if (nameKey && MLB_FALLBACK_BY_NAME[nameKey]) {
    const hit = MLB_FALLBACK_BY_NAME[nameKey];
    return { abbrev: hit.team, logoUrl: hit.logo_url };
  }

  return null;
}

/** Build maps from raw `mlb_team_mapping` Supabase rows (same as MLB.tsx fetch). */
export function buildMlbTeamMappingMaps(rawRows: Record<string, unknown>[]): {
  byMlbApiId: Map<number, MlbTeamMappingRow>;
  byTeamName: Map<string, MlbTeamMappingRow>;
  list: MlbTeamMappingRow[];
} {
  const byMlbApiId = new Map<number, MlbTeamMappingRow>();
  const byTeamName = new Map<string, MlbTeamMappingRow>();
  const list: MlbTeamMappingRow[] = [];

  /** Index id-shaped columns so trends `team_id` matches; `id` last for schemas that use it as the MLB id. */
  const idKeys = [
    'mlb_api_id',
    'mlb_team_id',
    'team_id',
    'mlbApiId',
    'mlbTeamId',
    'teamId',
    'id',
  ] as const;

  (rawRows || []).forEach((raw) => {
    const team_name = String(raw.team_name ?? raw.name ?? raw.full_name ?? '').trim();
    const teamCol = String(
      raw.team ?? raw.abbreviation ?? raw.team_abbrev ?? raw.abbr ?? raw.team_abbr ?? '',
    ).trim();
    const team = teamCol || abbrevFromTeamNameOnly(team_name);

    let primaryId = NaN;
    for (const key of ['mlb_api_id', 'mlb_team_id', 'team_id', 'id', 'mlbApiId', 'mlbTeamId', 'teamId'] as const) {
      const n = Number(raw[key]);
      if (Number.isFinite(n) && !Number.isNaN(n)) {
        primaryId = Math.trunc(n);
        break;
      }
    }

    const row: MlbTeamMappingRow = {
      mlb_api_id: primaryId,
      team,
      team_name,
      logo_url: (raw.logo_url ?? raw.logo ?? null) as string | null,
    };

    const seenIds = new Set<number>();
    for (const key of idKeys) {
      const n = Number(raw[key]);
      if (!Number.isFinite(n) || Number.isNaN(n)) continue;
      const tid = Math.trunc(n);
      if (seenIds.has(tid)) continue;
      seenIds.add(tid);
      byMlbApiId.set(tid, row);
    }

    if (row.team_name) {
      byTeamName.set(normalizeTeamNameKey(row.team_name), row);
    }
    list.push(row);
  });

  return { byMlbApiId, byTeamName, list };
}
