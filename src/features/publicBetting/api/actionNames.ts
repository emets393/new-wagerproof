import { normalizeCfbTeamKey } from '@/utils/cfbTeamAssets';

/**
 * Action Network shortens school names ("S. Alabama", "N. Mexico St").
 * Keys are `normalizeCfbTeamKey` output. Values are `cfb_teams.team_name`.
 */
const ACTION_CFB_NAMES: Record<string, string> = {
  'middle tenn': 'Middle Tennessee',
  's alabama': 'South Alabama',
  'n mexico state': 'New Mexico State',
  'e carolina': 'East Carolina',
  umass: 'Massachusetts',
  'fl atlantic': 'Florida Atlantic',
  'w michigan': 'Western Michigan',
  'miami (fl)': 'Miami',
  'c michigan': 'Central Michigan',
  'boston col': 'Boston College',
  'ga tech': 'Georgia Tech',
  's carolina': 'South Carolina',
  'n illinois': 'Northern Illinois',
  'k state': 'Kansas State',
  'e michigan': 'Eastern Michigan',
  'la-monroe': 'UL Monroe',
  'la tech': 'Louisiana Tech',
  'ok state': 'Oklahoma State',
  'va tech': 'Virginia Tech',
  'nd state': 'North Dakota State',
  'w kentucky': 'Western Kentucky',
  'n texas': 'North Texas',
  's florida': 'South Florida',
  's miss': 'Southern Miss',
  'c carolina': 'Coastal Carolina',
  'n carolina': 'North Carolina',
  'w virginia': 'West Virginia',
};

export function canonicalCfbName(name: string): string {
  return ACTION_CFB_NAMES[normalizeCfbTeamKey(name)] ?? name;
}
