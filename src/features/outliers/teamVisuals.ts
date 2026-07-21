// Shared team-visual resolution for the Outliers surfaces (trend cards +
// Today's Matchups tiles). Extracted from OutliersTrendCard so the tile grid
// and the card resolve logos/colors/initials identically per sport.
import {
  getCFBTeamColors,
  getCFBTeamInitials,
  getMLBTeamColors,
  getNFLTeamColors,
} from '@/utils/teamColors';
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
    // CFB team keys are full team names (no abbreviations in the slate table).
    return {
      colors: getCFBTeamColors(teamKey),
      initials: getCFBTeamInitials(teamKey),
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
