/**
 * Utility for matching team names across different data sources
 * Handles variations in team names, abbreviations, and formats
 */

import debug from '@/utils/debug';

// Common team name variations and their normalizations
const teamNameMappings: Record<string, string[]> = {
  // CFB Teams - Common variations between ESPN and predictions database
  'Alabama': ['Alabama Crimson Tide', 'Crimson Tide', 'BAMA', 'ALA'],
  'Ohio State': ['Ohio State Buckeyes', 'Buckeyes', 'OSU', 'Ohio St'],
  'Michigan': ['Michigan Wolverines', 'Wolverines', 'MICH'],
  'Georgia': ['Georgia Bulldogs', 'UGA', 'GA'],
  'Texas': ['Texas Longhorns', 'Longhorns', 'TEX'],
  'USC': ['Southern California', 'Southern Cal', 'Trojans', 'USC Trojans'],
  'Notre Dame': ['Notre Dame Fighting Irish', 'Fighting Irish', 'ND'],
  'Penn State': ['Penn State Nittany Lions', 'Nittany Lions', 'PSU', 'Penn St'],
  'Clemson': ['Clemson Tigers', 'CLEM'],
  'Florida': ['Florida Gators', 'Gators', 'FLA', 'UF'],
  'Florida State': ['Florida State Seminoles', 'Seminoles', 'FSU', 'Florida St'],
  'LSU': ['Louisiana State', 'LSU Tigers', 'Tigers'],
  'Oregon': ['Oregon Ducks', 'Ducks', 'ORE'],
  'Oklahoma': ['Oklahoma Sooners', 'Sooners', 'OU', 'OKLA'],
  'Texas A&M': ['Texas A&M Aggies', 'Aggies', 'TAMU', 'Texas AM', 'Texas A and M'],
  'Tennessee': ['Tennessee Volunteers', 'Volunteers', 'Vols', 'TENN'],
  'Miami': ['Miami Hurricanes', 'Hurricanes', 'Miami FL', 'Miami (FL)', 'The U'],
  'Auburn': ['Auburn Tigers', 'AUB'],
  'Wisconsin': ['Wisconsin Badgers', 'Badgers', 'WIS', 'WISC'],
  'Iowa': ['Iowa Hawkeyes', 'Hawkeyes'],
  'Michigan State': ['Michigan State Spartans', 'Spartans', 'MSU', 'Mich St', 'Michigan St'],
  'UCLA': ['UCLA Bruins', 'Bruins'],
  'Washington': ['Washington Huskies', 'Huskies', 'UW', 'WASH'],
  'Colorado': ['Colorado Buffaloes', 'Buffs', 'Buffaloes', 'COLO', 'CU'],
  'Arizona State': ['Arizona State Sun Devils', 'Sun Devils', 'ASU', 'Arizona St'],
  'Arizona': ['Arizona Wildcats', 'ARIZ'],
  'Utah': ['Utah Utes', 'Utes'],
  'Oklahoma State': ['Oklahoma State Cowboys', 'Cowboys', 'OSU Cowboys', 'Okla St', 'Oklahoma St'],
  'Baylor': ['Baylor Bears', 'BU'],
  'TCU': ['Texas Christian', 'TCU Horned Frogs', 'Horned Frogs'],
  'Kansas State': ['Kansas State Wildcats', 'K-State', 'KSU', 'Kansas St'],
  'Kansas': ['Kansas Jayhawks', 'Jayhawks', 'KU'],
  'West Virginia': ['West Virginia Mountaineers', 'Mountaineers', 'WVU', 'West Va'],
  'Kentucky': ['Kentucky Wildcats', 'UK', 'KY'],
  'South Carolina': ['South Carolina Gamecocks', 'Gamecocks', 'SC', 'SCAR'],
  'Missouri': ['Missouri Tigers', 'Mizzou', 'MIZ', 'MIZZ'],
  'Arkansas': ['Arkansas Razorbacks', 'Razorbacks', 'ARK', 'Hogs'],
  'Mississippi State': ['Mississippi State Bulldogs', 'Miss State', 'MSST', 'MSU Bulldogs', 'Miss St'],
  'Ole Miss': ['Mississippi', 'Mississippi Rebels', 'Rebels', 'UM'],
  'Vanderbilt': ['Vanderbilt Commodores', 'Commodores', 'VANDY', 'VAN'],
  'NC State': ['North Carolina State', 'NC State Wolfpack', 'Wolfpack', 'NCST', 'N.C. State'],
  'North Carolina': ['North Carolina Tar Heels', 'Tar Heels', 'UNC'],
  'Duke': ['Duke Blue Devils', 'Blue Devils'],
  'Wake Forest': ['Wake Forest Demon Deacons', 'Demon Deacons', 'WAKE'],
  'Virginia': ['Virginia Cavaliers', 'Cavaliers', 'Cavs', 'UVA', 'VA'],
  'Virginia Tech': ['Virginia Tech Hokies', 'Hokies', 'VT', 'Va Tech'],
  'Pittsburgh': ['Pittsburgh Panthers', 'Pitt Panthers', 'Pitt', 'PITT'],
  'Syracuse': ['Syracuse Orange', 'Orange', 'SYR', 'CUSE'],
  'Boston College': ['Boston College Eagles', 'BC', 'Eagles'],
  'Louisville': ['Louisville Cardinals', 'Cardinals', 'UL', 'LOU'],
  'Georgia Tech': ['Georgia Tech Yellow Jackets', 'Yellow Jackets', 'GT', 'Ga Tech'],
  'Stanford': ['Stanford Cardinal', 'Cardinal', 'STAN'],
  'California': ['California Golden Bears', 'Cal', 'Golden Bears', 'CAL'],
  'Oregon State': ['Oregon State Beavers', 'Beavers', 'OSU Beavers', 'Oregon St'],
  'Washington State': ['Washington State Cougars', 'Cougars', 'WSU', 'Wazzu', 'Wash St', 'Washington St'],
  'Indiana': ['Indiana Hoosiers', 'Hoosiers', 'IU', 'IND'],
  'Purdue': ['Purdue Boilermakers', 'Boilermakers', 'PUR'],
  'Illinois': ['Illinois Fighting Illini', 'Fighting Illini', 'Illini', 'ILL'],
  'Northwestern': ['Northwestern Wildcats', 'NW', 'NU'],
  'Minnesota': ['Minnesota Golden Gophers', 'Golden Gophers', 'Gophers', 'MINN'],
  'Nebraska': ['Nebraska Cornhuskers', 'Cornhuskers', 'Huskers', 'NEB'],
  'Iowa State': ['Iowa State Cyclones', 'Cyclones', 'ISU', 'Iowa St'],
  'Cincinnati': ['Cincinnati Bearcats', 'Bearcats', 'UC', 'CIN'],
  'UCF': ['Central Florida', 'UCF Knights', 'Knights'],
  'Houston': ['Houston Cougars', 'Coogs', 'UH', 'HOU'],
  'BYU': ['Brigham Young', 'BYU Cougars'],
  'SMU': ['Southern Methodist', 'SMU Mustangs', 'Mustangs'],
  'Memphis': ['Memphis Tigers', 'MEM'],
  'Tulane': ['Tulane Green Wave', 'Green Wave', 'TUL'],
  'Army': ['Army Black Knights', 'Army West Point', 'Black Knights'],
  'Navy': ['Navy Midshipmen', 'Midshipmen'],
  'Air Force': ['Air Force Falcons', 'Falcons', 'AFA'],
  'Boise State': ['Boise State Broncos', 'Broncos', 'BSU', 'Boise St'],
  'San Diego State': ['San Diego State Aztecs', 'Aztecs', 'SDSU', 'San Diego St'],
  'Fresno State': ['Fresno State Bulldogs', 'Fresno St'],
  'UNLV': ['UNLV Rebels', 'Nevada Las Vegas'],
  'Nevada': ['Nevada Wolf Pack', 'Wolf Pack', 'UNR'],
  'Hawaii': ["Hawai'i", 'Hawaii Rainbow Warriors', 'Rainbow Warriors', 'HAW'],
  'San Jose State': ['San José State', 'San Jose State Spartans', 'SJSU', 'San Jose St'],
  'Appalachian State': ['Appalachian State Mountaineers', 'App State', 'APP'],
  'Coastal Carolina': ['Coastal Carolina Chanticleers', 'Chanticleers', 'CCU'],
  'James Madison': ['James Madison Dukes', 'Dukes', 'JMU'],
  'Liberty': ['Liberty Flames', 'Flames', 'LIB'],
  'Marshall': ['Marshall Thundering Herd', 'Thundering Herd', 'MRSH'],
  'Old Dominion': ['Old Dominion Monarchs', 'Monarchs', 'ODU'],
  'Southern Miss': ['Southern Mississippi', 'Southern Miss Golden Eagles', 'Golden Eagles', 'USM'],
  'South Alabama': ['South Alabama Jaguars', 'USA Jaguars'],
  'Troy': ['Troy Trojans'],
  'Texas State': ['Texas State Bobcats', 'Bobcats', 'TXST', 'Texas St'],
  'UTSA': ['UT San Antonio', 'UTSA Roadrunners', 'Roadrunners'],
  'North Texas': ['North Texas Mean Green', 'Mean Green', 'UNT'],
  'Rice': ['Rice Owls', 'Owls'],
  'Tulsa': ['Tulsa Golden Hurricane', 'Golden Hurricane', 'TUL'],
  'East Carolina': ['East Carolina Pirates', 'ECU', 'Pirates'],
  'Charlotte': ['Charlotte 49ers', 'CLT'],
  'FAU': ['Florida Atlantic', 'Florida Atlantic Owls', 'FAU Owls'],
  'FIU': ['Florida International', 'FIU Panthers'],
  'Temple': ['Temple Owls', 'TEM'],
  'USF': ['South Florida', 'USF Bulls', 'Bulls'],
  'UAB': ['Alabama-Birmingham', 'UAB Blazers', 'Blazers'],
  'Louisiana': ['Louisiana Ragin Cajuns', "Ragin' Cajuns", 'UL Lafayette', 'ULL'],
  'Louisiana Tech': ['Louisiana Tech Bulldogs', 'La Tech', 'LAT'],
  'Arkansas State': ['Arkansas State Red Wolves', 'Red Wolves', 'ARST', 'Arkansas St'],
  'Georgia State': ['Georgia State Panthers', 'GSU', 'Georgia St'],
  'Georgia Southern': ['Georgia Southern Eagles', 'GASO'],
  'Texas Tech': ['Texas Tech Red Raiders', 'Red Raiders', 'TTU', 'Texas Tech'],
  'Miami (OH)': ['Miami Ohio', 'Miami RedHawks', 'RedHawks', 'Miami of Ohio'],
  'Western Kentucky': ['Western Kentucky Hilltoppers', 'Hilltoppers', 'WKU', 'Western Ky'],
  'Middle Tennessee': ['Middle Tennessee Blue Raiders', 'Blue Raiders', 'MTSU', 'Middle Tenn'],

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
    debug.log(`   🎯 City match: "${team1}" (${city1}) ↔ "${team2}" (${city2})`);
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

