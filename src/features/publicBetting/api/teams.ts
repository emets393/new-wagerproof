import type { TeamRef } from '@/features/games/types';
import { getNBATeamLogo } from '@/features/games/api/nbaGames';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import {
  getCfbTeamLogo,
  installCfbTeamAssets,
  lookupCfbTeam,
  searchCfbTeam,
} from '@/utils/cfbTeamAssets';
import {
  getNflTeamLogo,
  installNflTeamAssets,
  lookupNflTeam,
} from '@/utils/nflTeamAssets';
import {
  getCFBTeamColors,
  getCFBTeamInitials,
  getNBATeamColors,
  getNBATeamInitials,
  getNCAABTeamColors,
  getNCAABTeamInitials,
  getNFLTeamColors,
  getNFLTeamInitials,
} from '@/utils/teamColors';
import type { PublicSport } from '../types';
import { canonicalCfbName } from './actionNames';
import { canonicalNbaName } from './nbaNames';

function withHash(color: string): string {
  return color.startsWith('#') ? color : `#${color}`;
}

/** Logos for the four leagues. A failed reference fetch still leaves names and fallback colors. */
export async function installBoardTeamAssets(): Promise<void> {
  const [nfl, cfb] = await Promise.all([
    collegeFootballSupabase.from('nfl_teams').select('team_abbr, team_name, team_nick, logo_espn'),
    collegeFootballSupabase
      .from('cfb_teams')
      .select('team_name, abbr, logo, logo_dark, color, alt_color, conference'),
  ]);
  if (!nfl.error && nfl.data) installNflTeamAssets(nfl.data);
  if (!cfb.error && cfb.data) installCfbTeamAssets(cfb.data);
}

export function teamRef(sport: PublicSport, name: string): TeamRef {
  if (sport === 'nfl') {
    const known = lookupNflTeam(name);
    const fromCity = getNFLTeamColors(known?.linesCity || name);
    const fromName = getNFLTeamColors(name);
    const colors = fromCity.primary === '#6B7280' ? fromName : fromCity;
    return {
      name,
      abbrev: known?.abbr || getNFLTeamInitials(known?.linesCity || name),
      logoUrl: getNflTeamLogo(name),
      colors,
    };
  }

  if (sport === 'nba') {
    const canonical = canonicalNbaName(name);
    const logo = getNBATeamLogo(canonical, []);
    return {
      name,
      abbrev: getNBATeamInitials(canonical),
      logoUrl: logo && logo !== '/placeholder.svg' ? logo : null,
      colors: getNBATeamColors(canonical),
    };
  }

  const known = resolveCfb(name);
  const fallback = sport === 'ncaab' ? getNCAABTeamColors(name) : getCFBTeamColors(name);
  const colors = known?.color
    ? {
        primary: withHash(known.color),
        secondary: known.altColor ? withHash(known.altColor) : fallback.secondary,
      }
    : fallback;
  const initials = sport === 'ncaab' ? getNCAABTeamInitials(name) : getCFBTeamInitials(known?.teamName || name);
  return {
    name,
    abbrev: known?.abbr || initials,
    logoUrl: known ? getCfbTeamLogo(known.teamName) : null,
    colors,
  };
}

function resolveCfb(name: string) {
  const canonical = canonicalCfbName(name);
  return (
    lookupCfbTeam(canonical) ??
    searchCfbTeam(canonical) ??
    lookupCfbTeam(name) ??
    searchCfbTeam(name)
  );
}
