/**
 * Utility for matching team names across different data sources
 * Handles variations in team names, abbreviations, and formats
 */

// Common team name variations and their normalizations
const teamNameMappings: Record<string, string[]> = {
  // NFL Teams
  'Arizona Cardinals': ['Arizona', 'ARI', 'Cardinals'],
  'Atlanta Falcons': ['Atlanta', 'ATL', 'Falcons'],
  'Baltimore Ravens': ['Baltimore', 'BAL', 'Ravens'],
  'Buffalo Bills': ['Buffalo', 'BUF', 'Bills'],
  'Carolina Panthers': ['Carolina', 'CAR', 'Panthers'],
  'Chicago Bears': ['Chicago', 'CHI', 'Bears'],
  'Cincinnati Bengals': ['Cincinnati', 'CIN', 'Bengals'],
  'Cleveland Browns': ['Cleveland', 'CLE', 'Browns'],
  'Dallas Cowboys': ['Dallas', 'DAL', 'Cowboys'],
  'Denver Broncos': ['Denver', 'DEN', 'Broncos'],
  'Detroit Lions': ['Detroit', 'DET', 'Lions'],
  'Green Bay Packers': ['Green Bay', 'GB', 'GNB', 'Packers'],
  'Houston Texans': ['Houston', 'HOU', 'Texans'],
  'Indianapolis Colts': ['Indianapolis', 'IND', 'Colts'],
  'Jacksonville Jaguars': ['Jacksonville', 'JAX', 'JAC', 'Jaguars'],
  'Kansas City Chiefs': ['Kansas City', 'KC', 'KAN', 'Chiefs'],
  'Las Vegas Raiders': ['Las Vegas', 'LV', 'LVR', 'Raiders', 'Oakland Raiders', 'Oakland'],
  'Los Angeles Chargers': ['Los Angeles Chargers', 'LA Chargers', 'LAC', 'Chargers', 'San Diego Chargers'],
  'Los Angeles Rams': ['Los Angeles Rams', 'LA Rams', 'LAR', 'Rams', 'St. Louis Rams'],
  'Miami Dolphins': ['Miami', 'MIA', 'Dolphins'],
  'Minnesota Vikings': ['Minnesota', 'MIN', 'Vikings'],
  'New England Patriots': ['New England', 'NE', 'NEP', 'Patriots'],
  'New Orleans Saints': ['New Orleans', 'NO', 'NOR', 'Saints'],
  'New York Giants': ['New York Giants', 'NY Giants', 'NYG', 'Giants'],
  'New York Jets': ['New York Jets', 'NY Jets', 'NYJ', 'Jets'],
  'Philadelphia Eagles': ['Philadelphia', 'PHI', 'Eagles'],
  'Pittsburgh Steelers': ['Pittsburgh', 'PIT', 'Steelers'],
  'San Francisco 49ers': ['San Francisco', 'SF', 'SFO', '49ers'],
  'Seattle Seahawks': ['Seattle', 'SEA', 'Seahawks'],
  'Tampa Bay Buccaneers': ['Tampa Bay', 'TB', 'TAM', 'Buccaneers'],
  'Tennessee Titans': ['Tennessee', 'TEN', 'Titans'],
  'Washington Commanders': ['Washington', 'WAS', 'WSH', 'Commanders', 'Washington Football Team', 'Redskins'],
};

/**
 * Normalize a team name for matching
 */
export function normalizeTeamName(teamName: string): string {
  if (!teamName) return '';
  
  // Remove extra whitespace and convert to lowercase for comparison
  const cleaned = teamName.trim().toLowerCase();
  
  // Remove common suffixes/prefixes
  return cleaned
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '')
    .trim();
}

/**
 * Extract city name from full team name
 * "Kansas City Chiefs" -> "kansas city"
 * "New England Patriots" -> "new england"
 */
function extractCityName(teamName: string): string {
  if (!teamName) return '';
  
  const normalized = normalizeTeamName(teamName);
  
  // Common NFL/CFB mascots to remove
  const mascots = [
    // NFL
    'cardinals', '49ers', 'seahawks', 'rams', 'chargers',
    'raiders', 'chiefs', 'broncos', 'cowboys', 'giants', 'eagles',
    'commanders', 'bears', 'lions', 'packers', 'vikings',
    'saints', 'falcons', 'panthers', 'buccaneers', 'steelers',
    'ravens', 'browns', 'bengals', 'titans', 'colts', 'texans',
    'jaguars', 'dolphins', 'bills', 'jets', 'patriots',
    // CFB
    'tigers', 'bulldogs', 'wildcats', 'trojans', 'bruins', 'huskies',
    'crimson', 'tide', 'longhorns', 'sooners', 'buckeyes', 'wolverines',
    'fighting', 'irish', 'hurricanes', 'seminoles', 'gators', 'aggies',
    'rebels', 'commodores', 'volunteers', 'razorbacks', 'gamecocks',
    'knights', 'cougars', 'horned', 'frogs', 'red', 'wave', 'green',
    'yellow', 'jackets', 'hokies', 'demon', 'deacons', 'tar', 'heels',
    'blue', 'devils', 'orange', 'badgers', 'hawkeyes', 'nittany',
    'spartans', 'cornhuskers', 'golden', 'ducks', 'beavers', 'sun',
    'scarlet', 'hoosiers', 'terrapins', 'boilermakers', 'panthers'
  ];
  
  // Split into words and remove mascot words
  const words = normalized.split(' ');
  const cityWords = words.filter(word => !mascots.includes(word));
  
  return cityWords.join(' ').trim();
}

/**
 * Check if two team names match
 */
export function teamsMatch(team1: string, team2: string): boolean {
  if (!team1 || !team2) return false;
  
  const normalized1 = normalizeTeamName(team1);
  const normalized2 = normalizeTeamName(team2);
  
  // Direct match
  if (normalized1 === normalized2) return true;
  
  // Check if one contains the other (for partial matches)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Extract city names and compare (handles "Kansas City Chiefs" vs "Kansas City")
  const city1 = extractCityName(team1);
  const city2 = extractCityName(team2);
  
  if (city1 && city2 && city1 === city2) {
    console.log(`   🎯 City match: "${team1}" (${city1}) ↔ "${team2}" (${city2})`);
    return true;
  }
  
  // Check against known mappings
  for (const [canonical, variations] of Object.entries(teamNameMappings)) {
    const normalizedCanonical = normalizeTeamName(canonical);
    const normalizedVariations = variations.map(v => normalizeTeamName(v));
    
    const team1Matches = normalized1 === normalizedCanonical || normalizedVariations.includes(normalized1);
    const team2Matches = normalized2 === normalizedCanonical || normalizedVariations.includes(normalized2);
    
    if (team1Matches && team2Matches) return true;
  }
  
  return false;
}

/**
 * Find a matching team from a list
 */
export function findMatchingTeam<T extends { home_team?: string; away_team?: string }>(
  targetTeam: string,
  teamList: T[],
  matchField: 'home_team' | 'away_team'
): T | undefined {
  return teamList.find(item => {
    const teamName = item[matchField];
    return teamName && teamsMatch(targetTeam, teamName);
  });
}

/**
 * Match two games based on team names
 */
export function gamesMatch(
  game1: { home_team: string; away_team: string },
  game2: { home_team: string; away_team: string }
): boolean {
  return (
    teamsMatch(game1.home_team, game2.home_team) &&
    teamsMatch(game1.away_team, game2.away_team)
  );
}

