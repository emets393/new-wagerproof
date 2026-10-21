/**
 * The board prints nicknames ("Celtics", "76ers"). The shared color table is
 * keyed by city and full name, so a nickname falls through to gray.
 */
const NBA_NICKNAMES: Record<string, string> = {
  hawks: 'Atlanta Hawks',
  celtics: 'Boston Celtics',
  nets: 'Brooklyn Nets',
  hornets: 'Charlotte Hornets',
  bulls: 'Chicago Bulls',
  cavaliers: 'Cleveland Cavaliers',
  cavs: 'Cleveland Cavaliers',
  mavericks: 'Dallas Mavericks',
  mavs: 'Dallas Mavericks',
  nuggets: 'Denver Nuggets',
  pistons: 'Detroit Pistons',
  warriors: 'Golden State Warriors',
  rockets: 'Houston Rockets',
  pacers: 'Indiana Pacers',
  clippers: 'LA Clippers',
  lakers: 'Los Angeles Lakers',
  grizzlies: 'Memphis Grizzlies',
  heat: 'Miami Heat',
  bucks: 'Milwaukee Bucks',
  timberwolves: 'Minnesota Timberwolves',
  wolves: 'Minnesota Timberwolves',
  pelicans: 'New Orleans Pelicans',
  knicks: 'New York Knicks',
  thunder: 'Oklahoma City Thunder',
  magic: 'Orlando Magic',
  '76ers': 'Philadelphia 76ers',
  sixers: 'Philadelphia 76ers',
  suns: 'Phoenix Suns',
  'trail blazers': 'Portland Trail Blazers',
  blazers: 'Portland Trail Blazers',
  kings: 'Sacramento Kings',
  spurs: 'San Antonio Spurs',
  raptors: 'Toronto Raptors',
  jazz: 'Utah Jazz',
  wizards: 'Washington Wizards',
};

export function canonicalNbaName(name: string): string {
  return NBA_NICKNAMES[name.trim().toLowerCase()] ?? name;
}
