// Shared team-visual resolution for the Outliers surfaces (trend cards +
// Today's Matchups tiles). Extracted from OutliersTrendCard so the tile grid
// and the card resolve logos/colors/initials identically per sport.
import {
  getCFBTeamColors,
  getCFBTeamInitials,
  getMLBTeamColors,
  getNBATeamColors,
  getNBATeamInitials,
  getNCAABTeamColors,
  getNCAABTeamInitials,
  getNFLTeamColors,
} from '@/utils/teamColors';
import {
  getCfbTeamAbbrFromAssets,
  getCfbTeamColorsFromAssets,
  getCfbTeamLogo,
} from '@/utils/cfbTeamAssets';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import type { OutliersTrendsSport } from './types';

export const NFL_SHIELD_URL = 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png';

// Trend-card team keys are NFL abbreviations, but teamColors.ts keys off city
// names — bridge here (ESPN slug rides along for the logo URL).
export const NFL_ABBR_META: Record<string, { name: string; slug: string }> = {
  ARI: { name: 'Arizona', slug: 'ari' },
  ATL: { name: 'Atlanta', slug: 'atl' },
  BAL: { name: 'Baltimore', slug: 'bal' },
  BUF: { name: 'Buffalo', slug: 'buf' },
  CAR: { name: 'Carolina', slug: 'car' },
  CHI: { name: 'Chicago', slug: 'chi' },
  CIN: { name: 'Cincinnati', slug: 'cin' },
  CLE: { name: 'Cleveland', slug: 'cle' },
  DAL: { name: 'Dallas', slug: 'dal' },
  DEN: { name: 'Denver', slug: 'den' },
  DET: { name: 'Detroit', slug: 'det' },
  GB: { name: 'Green Bay', slug: 'gb' },
  HOU: { name: 'Houston', slug: 'hou' },
  IND: { name: 'Indianapolis', slug: 'ind' },
  JAX: { name: 'Jacksonville', slug: 'jax' },
  JAC: { name: 'Jacksonville', slug: 'jax' },
  KC: { name: 'Kansas City', slug: 'kc' },
  LV: { name: 'Las Vegas', slug: 'lv' },
  LAC: { name: 'LA Chargers', slug: 'lac' },
  LA: { name: 'LA Rams', slug: 'lar' },
  LAR: { name: 'LA Rams', slug: 'lar' },
  MIA: { name: 'Miami', slug: 'mia' },
  MIN: { name: 'Minnesota', slug: 'min' },
  NE: { name: 'New England', slug: 'ne' },
  NO: { name: 'New Orleans', slug: 'no' },
  NYG: { name: 'NY Giants', slug: 'nyg' },
  NYJ: { name: 'NY Jets', slug: 'nyj' },
  PHI: { name: 'Philadelphia', slug: 'phi' },
  PIT: { name: 'Pittsburgh', slug: 'pit' },
  SF: { name: 'San Francisco', slug: 'sf' },
  SEA: { name: 'Seattle', slug: 'sea' },
  TB: { name: 'Tampa Bay', slug: 'tb' },
  TEN: { name: 'Tennessee', slug: 'ten' },
  WAS: { name: 'Washington', slug: 'wsh' },
  WSH: { name: 'Washington', slug: 'wsh' },
};

/** Display code → franchise + ESPN slug. The slug is not the code (NYK → ny, GSW → gs). */
const NBA_ABBR_META: Record<string, { name: string; slug: string }> = {
  ATL: { name: 'Atlanta Hawks', slug: 'atl' },
  BOS: { name: 'Boston Celtics', slug: 'bos' },
  BKN: { name: 'Brooklyn Nets', slug: 'bkn' },
  CHA: { name: 'Charlotte Hornets', slug: 'cha' },
  CHI: { name: 'Chicago Bulls', slug: 'chi' },
  CLE: { name: 'Cleveland Cavaliers', slug: 'cle' },
  DAL: { name: 'Dallas Mavericks', slug: 'dal' },
  DEN: { name: 'Denver Nuggets', slug: 'den' },
  DET: { name: 'Detroit Pistons', slug: 'det' },
  GSW: { name: 'Golden State Warriors', slug: 'gs' },
  HOU: { name: 'Houston Rockets', slug: 'hou' },
  IND: { name: 'Indiana Pacers', slug: 'ind' },
  LAC: { name: 'LA Clippers', slug: 'lac' },
  LAL: { name: 'LA Lakers', slug: 'lal' },
  MEM: { name: 'Memphis Grizzlies', slug: 'mem' },
  MIA: { name: 'Miami Heat', slug: 'mia' },
  MIL: { name: 'Milwaukee Bucks', slug: 'mil' },
  MIN: { name: 'Minnesota Timberwolves', slug: 'min' },
  NOP: { name: 'New Orleans Pelicans', slug: 'no' },
  NYK: { name: 'New York Knicks', slug: 'ny' },
  OKC: { name: 'Oklahoma City Thunder', slug: 'okc' },
  ORL: { name: 'Orlando Magic', slug: 'orl' },
  PHI: { name: 'Philadelphia 76ers', slug: 'phi' },
  PHX: { name: 'Phoenix Suns', slug: 'phx' },
  POR: { name: 'Portland Trail Blazers', slug: 'por' },
  SAC: { name: 'Sacramento Kings', slug: 'sac' },
  SAS: { name: 'San Antonio Spurs', slug: 'sa' },
  TOR: { name: 'Toronto Raptors', slug: 'tor' },
  UTA: { name: 'Utah Jazz', slug: 'utah' },
  WAS: { name: 'Washington Wizards', slug: 'wsh' },
};

function nbaLogoUrl(slug: string): string {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

export interface TeamVisual {
  colors: { primary: string; secondary: string };
  initials: string;
  logoUrl: string | null;
}

export function teamVisuals(sport: OutliersTrendsSport, teamKey: string): TeamVisual {
  if (sport === 'ncaaf') {
    // CFB keys are full school names (teams + coaches via current_team). Logos /
    // brand colors come from the cfb_teams cache (installCfbTeamAssets) — same
    // source as native CFBTeamAssets. Initials prefer the table abbr.
    const assetColors = getCfbTeamColorsFromAssets(teamKey);
    const abbr = getCfbTeamAbbrFromAssets(teamKey);
    return {
      colors: assetColors ?? getCFBTeamColors(teamKey),
      initials: abbr?.toUpperCase() ?? getCFBTeamInitials(teamKey),
      logoUrl: getCfbTeamLogo(teamKey),
    };
  }
  if (sport === 'ncaab') {
    // School names and abbreviations resolve through the same cfb_teams cache
    // the slate fetch installs. Colors fall back to the static school map.
    const assetColors = getCfbTeamColorsFromAssets(teamKey);
    const abbr = getCfbTeamAbbrFromAssets(teamKey);
    return {
      colors: assetColors ?? getNCAABTeamColors(teamKey),
      initials: abbr?.toUpperCase() ?? getNCAABTeamInitials(teamKey),
      logoUrl: getCfbTeamLogo(teamKey),
    };
  }
  if (sport === 'nba') {
    const byAbbr = NBA_ABBR_META[teamKey.trim().toUpperCase()];
    if (byAbbr) {
      return {
        colors: getNBATeamColors(byAbbr.name),
        initials: teamKey.trim().toUpperCase(),
        logoUrl: nbaLogoUrl(byAbbr.slug),
      };
    }
    const byName = Object.entries(NBA_ABBR_META).find(
      ([, meta]) => meta.name.toLowerCase() === teamKey.trim().toLowerCase(),
    );
    if (byName) {
      return {
        colors: getNBATeamColors(byName[1].name),
        initials: byName[0],
        logoUrl: nbaLogoUrl(byName[1].slug),
      };
    }
    return {
      colors: getNBATeamColors(teamKey),
      initials: getNBATeamInitials(teamKey),
      logoUrl: null,
    };
  }
  if (sport === 'mlb') {
    return {
      colors: getMLBTeamColors(teamKey),
      initials: teamKey.toUpperCase().slice(0, 3),
      logoUrl: espnMlb500LogoUrlFromAbbrev(teamKey),
    };
  }
  const meta = NFL_ABBR_META[teamKey.toUpperCase()];
  return {
    colors: meta ? getNFLTeamColors(meta.name) : { primary: '#6B7280', secondary: '#9CA3AF' },
    initials: teamKey.toUpperCase().slice(0, 3),
    logoUrl: meta ? `https://a.espncdn.com/i/teamlogos/nfl/500/${meta.slug}.png` : null,
  };
}
