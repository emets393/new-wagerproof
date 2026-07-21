import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import { getMLBTeamColors } from '@/utils/teamColors';
import { toF5SplitTeamAbbr } from '@/utils/mlbF5Splits';
import type { MlbToolTeam } from './types';

/**
 * `getMLBTeamColors` is keyed on the classic display abbreviations, but both
 * tool feeds canonicalize to game-log abbrs (AZ, ATH). Translate before the
 * lookup or relocated/renamed clubs silently fall back to the grey default.
 */
const COLOR_ABBR_ALIASES: Record<string, string> = {
  AZ: 'ARI',
  LVA: 'ATH',
  SAC: 'ATH',
  OAK: 'ATH',
  CHW: 'CWS',
  WAS: 'WSH',
  SDP: 'SD',
  SFG: 'SF',
  TBR: 'TB',
  KCR: 'KC',
};

export function mlbToolTeamColors(abbrev: string): { primary: string; secondary: string } {
  const key = abbrev.trim().toUpperCase();
  return getMLBTeamColors(COLOR_ABBR_ALIASES[key] ?? key);
}

/** Build the branded team object both tool feeds and detail panes render from. */
export function mlbToolTeam(abbrev: string, name: string): MlbToolTeam {
  const canonical = toF5SplitTeamAbbr(abbrev);
  return {
    name,
    abbrev: canonical,
    logoUrl: espnMlb500LogoUrlFromAbbrev(canonical),
    colors: mlbToolTeamColors(canonical),
  };
}
