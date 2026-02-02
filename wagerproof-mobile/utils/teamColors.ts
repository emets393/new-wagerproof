// NFL Team Colors - Exact match from web app
// Handles both full team names ("Kansas City Chiefs") and city names ("Kansas City")
export const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } => {
  if (!teamName) return { primary: '#6B7280', secondary: '#9CA3AF' };
  
  // First try direct match (for city names like "Arizona", "Kansas City")
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    'Arizona': { primary: '#97233F', secondary: '#000000' },
    'Atlanta': { primary: '#A71930', secondary: '#000000' },
    'Baltimore': { primary: '#241773', secondary: '#9E7C0C' },
    'Buffalo': { primary: '#00338D', secondary: '#C60C30' },
    'Carolina': { primary: '#0085CA', secondary: '#101820' },
    'Chicago': { primary: '#0B162A', secondary: '#C83803' },
    'Cincinnati': { primary: '#FB4F14', secondary: '#000000' },
    'Cleveland': { primary: '#311D00', secondary: '#FF3C00' },
    'Dallas': { primary: '#003594', secondary: '#869397' },
    'Denver': { primary: '#FB4F14', secondary: '#002244' },
    'Detroit': { primary: '#0076B6', secondary: '#B0B7BC' },
    'Green Bay': { primary: '#203731', secondary: '#FFB612' },
    'Houston': { primary: '#03202F', secondary: '#A71930' },
    'Indianapolis': { primary: '#002C5F', secondary: '#A2AAAD' },
    'Jacksonville': { primary: '#101820', secondary: '#D7A22A' },
    'Kansas City': { primary: '#E31837', secondary: '#FFB81C' },
    'Las Vegas': { primary: '#000000', secondary: '#A5ACAF' },
    'Los Angeles Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
    'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300' },
    'LA Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
    'LA Rams': { primary: '#003594', secondary: '#FFA300' },
    'Miami': { primary: '#008E97', secondary: '#FC4C02' },
    'Minnesota': { primary: '#4F2683', secondary: '#FFC62F' },
    'New England': { primary: '#002244', secondary: '#C60C30' },
    'New Orleans': { primary: '#101820', secondary: '#D3BC8D' },
    'NY Giants': { primary: '#0B2265', secondary: '#A71930' },
    'NY Jets': { primary: '#125740', secondary: '#000000' },
    'Philadelphia': { primary: '#004C54', secondary: '#A5ACAF' },
    'Pittsburgh': { primary: '#FFB612', secondary: '#101820' },
    'San Francisco': { primary: '#AA0000', secondary: '#B3995D' },
    'Seattle': { primary: '#002244', secondary: '#69BE28' },
    'Tampa Bay': { primary: '#D50A0A', secondary: '#FF7900' },
    'Tennessee': { primary: '#0C2340', secondary: '#4B92DB' },
    'Washington': { primary: '#5A1414', secondary: '#FFB612' },
    // Full team name mappings
    'Arizona Cardinals': { primary: '#97233F', secondary: '#000000' },
    'Atlanta Falcons': { primary: '#A71930', secondary: '#000000' },
    'Baltimore Ravens': { primary: '#241773', secondary: '#9E7C0C' },
    'Buffalo Bills': { primary: '#00338D', secondary: '#C60C30' },
    'Carolina Panthers': { primary: '#0085CA', secondary: '#101820' },
    'Chicago Bears': { primary: '#0B162A', secondary: '#C83803' },
    'Cincinnati Bengals': { primary: '#FB4F14', secondary: '#000000' },
    'Cleveland Browns': { primary: '#311D00', secondary: '#FF3C00' },
    'Dallas Cowboys': { primary: '#003594', secondary: '#869397' },
    'Denver Broncos': { primary: '#FB4F14', secondary: '#002244' },
    'Detroit Lions': { primary: '#0076B6', secondary: '#B0B7BC' },
    'Green Bay Packers': { primary: '#203731', secondary: '#FFB612' },
    'Houston Texans': { primary: '#03202F', secondary: '#A71930' },
    'Indianapolis Colts': { primary: '#002C5F', secondary: '#A2AAAD' },
    'Jacksonville Jaguars': { primary: '#101820', secondary: '#D7A22A' },
    'Kansas City Chiefs': { primary: '#E31837', secondary: '#FFB81C' },
    'Las Vegas Raiders': { primary: '#000000', secondary: '#A5ACAF' },
    'Miami Dolphins': { primary: '#008E97', secondary: '#FC4C02' },
    'Minnesota Vikings': { primary: '#4F2683', secondary: '#FFC62F' },
    'New England Patriots': { primary: '#002244', secondary: '#C60C30' },
    'New Orleans Saints': { primary: '#101820', secondary: '#D3BC8D' },
    'New York Giants': { primary: '#0B2265', secondary: '#A71930' },
    'New York Jets': { primary: '#125740', secondary: '#000000' },
    'Philadelphia Eagles': { primary: '#004C54', secondary: '#A5ACAF' },
    'Pittsburgh Steelers': { primary: '#FFB612', secondary: '#101820' },
    'San Francisco 49ers': { primary: '#AA0000', secondary: '#B3995D' },
    'Seattle Seahawks': { primary: '#002244', secondary: '#69BE28' },
    'Tampa Bay Buccaneers': { primary: '#D50A0A', secondary: '#FF7900' },
    'Tennessee Titans': { primary: '#0C2340', secondary: '#4B92DB' },
    'Washington Commanders': { primary: '#5A1414', secondary: '#FFB612' },
    'Washington Football Team': { primary: '#5A1414', secondary: '#FFB612' },
  };
  
  // Try direct match first
  if (colorMap[teamName]) {
    return colorMap[teamName];
  }
  
  // If not found, try to extract city name from full team name
  // Remove common NFL team names/mascots to get city
  const teamMascots = [
    'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Panthers', 'Bears', 'Bengals',
    'Browns', 'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts',
    'Jaguars', 'Chiefs', 'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings',
    'Patriots', 'Saints', 'Giants', 'Jets', 'Eagles', 'Steelers', '49ers',
    'Seahawks', 'Buccaneers', 'Titans', 'Commanders', 'Football Team'
  ];
  
  let cityName = teamName;
  for (const mascot of teamMascots) {
    if (cityName.endsWith(` ${mascot}`)) {
      cityName = cityName.replace(` ${mascot}`, '').trim();
      break;
    }
  }
  
  // Try with extracted city name
  if (colorMap[cityName]) {
    return colorMap[cityName];
  }
  
  // Default gray if no match found
  return { primary: '#6B7280', secondary: '#9CA3AF' };
};

export const getTeamInitials = (teamCity: string): string => {
  if (!teamCity) return 'TBD';
  const initialsMap: { [key: string]: string } = {
    'Arizona': 'ARI',
    'Atlanta': 'ATL',
    'Baltimore': 'BAL',
    'Buffalo': 'BUF',
    'Carolina': 'CAR',
    'Chicago': 'CHI',
    'Cincinnati': 'CIN',
    'Cleveland': 'CLE',
    'Dallas': 'DAL',
    'Denver': 'DEN',
    'Detroit': 'DET',
    'Green Bay': 'GB',
    'Houston': 'HOU',
    'Indianapolis': 'IND',
    'Jacksonville': 'JAX',
    'Kansas City': 'KC',
    'Las Vegas': 'LV',
    'Los Angeles Chargers': 'LAC',
    'Los Angeles Rams': 'LAR',
    'LA Chargers': 'LAC',
    'LA Rams': 'LAR',
    'Miami': 'MIA',
    'Minnesota': 'MIN',
    'New England': 'NE',
    'New Orleans': 'NO',
    'NY Giants': 'NYG',
    'NY Jets': 'NYJ',
    'Philadelphia': 'PHI',
    'Pittsburgh': 'PIT',
    'San Francisco': 'SF',
    'Seattle': 'SEA',
    'Tampa Bay': 'TB',
    'Tennessee': 'TEN',
    'Washington': 'WSH',
  };
  return initialsMap[teamCity] || (teamCity ? teamCity.substring(0, 3).toUpperCase() : 'TBD');
};

export const getFullTeamName = (teamCity: string): string => {
  const teamNameMap: { [key: string]: string } = {
    'Arizona': 'Cardinals',
    'Atlanta': 'Falcons',
    'Baltimore': 'Ravens',
    'Buffalo': 'Bills',
    'Carolina': 'Panthers',
    'Chicago': 'Bears',
    'Cincinnati': 'Bengals',
    'Cleveland': 'Browns',
    'Dallas': 'Cowboys',
    'Denver': 'Broncos',
    'Detroit': 'Lions',
    'Green Bay': 'Packers',
    'Houston': 'Texans',
    'Indianapolis': 'Colts',
    'Jacksonville': 'Jaguars',
    'Kansas City': 'Chiefs',
    'Las Vegas': 'Raiders',
    'Los Angeles Chargers': 'Chargers',
    'Los Angeles Rams': 'Rams',
    'LA Chargers': 'Chargers',
    'LA Rams': 'Rams',
    'Miami': 'Dolphins',
    'Minnesota': 'Vikings',
    'New England': 'Patriots',
    'New Orleans': 'Saints',
    'NY Giants': 'Giants',
    'NY Jets': 'Jets',
    'Philadelphia': 'Eagles',
    'Pittsburgh': 'Steelers',
    'San Francisco': '49ers',
    'Seattle': 'Seahawks',
    'Tampa Bay': 'Buccaneers',
    'Tennessee': 'Titans',
    'Washington': 'Commanders',
  };
  const name = teamNameMap[teamCity];
  // Return full name with city
  return name ? `${teamCity} ${name}` : teamCity;
};

// Helper to get team parts if needed
export const getTeamParts = (teamCity: string): { city: string; name: string } => {
  const teamNameMap: { [key: string]: string } = {
    'Arizona': 'Cardinals',
    'Atlanta': 'Falcons',
    'Baltimore': 'Ravens',
    'Buffalo': 'Bills',
    'Carolina': 'Panthers',
    'Chicago': 'Bears',
    'Cincinnati': 'Bengals',
    'Cleveland': 'Browns',
    'Dallas': 'Cowboys',
    'Denver': 'Broncos',
    'Detroit': 'Lions',
    'Green Bay': 'Packers',
    'Houston': 'Texans',
    'Indianapolis': 'Colts',
    'Jacksonville': 'Jaguars',
    'Kansas City': 'Chiefs',
    'Las Vegas': 'Raiders',
    'Los Angeles Chargers': 'Chargers',
    'Los Angeles Rams': 'Rams',
    'LA Chargers': 'Chargers',
    'LA Rams': 'Rams',
    'Miami': 'Dolphins',
    'Minnesota': 'Vikings',
    'New England': 'Patriots',
    'New Orleans': 'Saints',
    'NY Giants': 'Giants',
    'NY Jets': 'Jets',
    'Philadelphia': 'Eagles',
    'Pittsburgh': 'Steelers',
    'San Francisco': '49ers',
    'Seattle': 'Seahawks',
    'Tampa Bay': 'Buccaneers',
    'Tennessee': 'Titans',
    'Washington': 'Commanders',
  };
  return {
    city: teamCity,
    name: teamNameMap[teamCity] || ''
  };
};

export const getColorLuminance = (hexColor: string): number => {
  if (!hexColor || typeof hexColor !== 'string') return 0.5;
  try {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 0.5;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  } catch {
    return 0.5;
  }
};

export const getContrastingTextColor = (bgColor1: string, bgColor2: string): string => {
  const lum1 = getColorLuminance(bgColor1);
  const lum2 = getColorLuminance(bgColor2);
  const avgLuminance = (lum1 + lum2) / 2;
  return avgLuminance < 0.5 ? '#ffffff' : '#000000';
};

// CFB Team Colors
export const getCFBTeamColors = (teamName: string): { primary: string; secondary: string } => {
  if (!teamName) return { primary: '#6B7280', secondary: '#9CA3AF' };
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    // SEC
    'Alabama': { primary: '#9E1B32', secondary: '#FFFFFF' },
    'Auburn': { primary: '#0C2340', secondary: '#E87722' },
    'Georgia': { primary: '#BA0C2F', secondary: '#000000' },
    'Florida': { primary: '#0021A5', secondary: '#FA4616' },
    'LSU': { primary: '#461D7C', secondary: '#FDD023' },
    'Texas A&M': { primary: '#500000', secondary: '#FFFFFF' },
    'Ole Miss': { primary: '#CE1126', secondary: '#14213D' },
    'Mississippi State': { primary: '#5D1725', secondary: '#FFFFFF' },
    'Arkansas': { primary: '#9D2235', secondary: '#FFFFFF' },
    'Kentucky': { primary: '#0033A0', secondary: '#FFFFFF' },
    'Tennessee': { primary: '#FF8200', secondary: '#FFFFFF' },
    'South Carolina': { primary: '#73000A', secondary: '#000000' },
    'Missouri': { primary: '#F1B82D', secondary: '#000000' },
    'Vanderbilt': { primary: '#866D4B', secondary: '#000000' },
    'Oklahoma': { primary: '#841617', secondary: '#FDF9D8' },
    'Texas': { primary: '#BF5700', secondary: '#FFFFFF' },
    
    // Big Ten
    'Ohio State': { primary: '#BB0000', secondary: '#666666' },
    'Michigan': { primary: '#00274C', secondary: '#FFCB05' },
    'Penn State': { primary: '#041E42', secondary: '#FFFFFF' },
    'Michigan State': { primary: '#18453B', secondary: '#FFFFFF' },
    'Wisconsin': { primary: '#C5050C', secondary: '#FFFFFF' },
    'Iowa': { primary: '#FFCD00', secondary: '#000000' },
    'Minnesota': { primary: '#7A0019', secondary: '#FFCC33' },
    'Nebraska': { primary: '#E41C38', secondary: '#FFFFFF' },
    'Illinois': { primary: '#13294B', secondary: '#E84A27' },
    'Northwestern': { primary: '#4E2A84', secondary: '#FFFFFF' },
    'Purdue': { primary: '#000000', secondary: '#CFB991' },
    'Indiana': { primary: '#990000', secondary: '#FFFFFF' },
    'Rutgers': { primary: '#CC0033', secondary: '#FFFFFF' },
    'Maryland': { primary: '#E03A3E', secondary: '#FFD520' },
    'USC': { primary: '#990000', secondary: '#FFC72C' },
    'UCLA': { primary: '#2D68C4', secondary: '#FFE800' },
    'Oregon': { primary: '#154733', secondary: '#FEE11A' },
    'Washington': { primary: '#4B2E83', secondary: '#E8D3A2' },
    
    // ACC
    'Clemson': { primary: '#F56600', secondary: '#522D80' },
    'Miami': { primary: '#F47321', secondary: '#005030' },
    'Florida State': { primary: '#782F40', secondary: '#CEB888' },
    'North Carolina': { primary: '#7BAFD4', secondary: '#FFFFFF' },
    'NC State': { primary: '#CC0000', secondary: '#FFFFFF' },
    'Virginia': { primary: '#232D4B', secondary: '#F84C1E' },
    'Virginia Tech': { primary: '#630031', secondary: '#CF4420' },
    'Louisville': { primary: '#AD0000', secondary: '#000000' },
    'Pittsburgh': { primary: '#003594', secondary: '#FFB81C' },
    'Duke': { primary: '#003087', secondary: '#FFFFFF' },
    'Wake Forest': { primary: '#9E7E38', secondary: '#000000' },
    'Boston College': { primary: '#8B0015', secondary: '#FFCE06' },
    'Syracuse': { primary: '#D44500', secondary: '#FFFFFF' },
    'Georgia Tech': { primary: '#B3A369', secondary: '#003057' },
    'California': { primary: '#003262', secondary: '#FDB515' },
    'Stanford': { primary: '#8C1515', secondary: '#FFFFFF' },
    'SMU': { primary: '#0033A0', secondary: '#C8102E' },
    
    // Big 12
    'Oklahoma State': { primary: '#FF7300', secondary: '#000000' },
    'Kansas State': { primary: '#512888', secondary: '#FFFFFF' },
    'Baylor': { primary: '#003015', secondary: '#FFC72C' },
    'Texas Tech': { primary: '#CC0000', secondary: '#000000' },
    'TCU': { primary: '#4D1979', secondary: '#FFFFFF' },
    'West Virginia': { primary: '#002855', secondary: '#EAAA00' },
    'Kansas': { primary: '#0051BA', secondary: '#E8000D' },
    'Iowa State': { primary: '#C8102E', secondary: '#F1BE48' },
    'Cincinnati': { primary: '#E00122', secondary: '#000000' },
    'UCF': { primary: '#000000', secondary: '#FFC904' },
    'Houston': { primary: '#C8102E', secondary: '#FFFFFF' },
    'BYU': { primary: '#002E5D', secondary: '#FFFFFF' },
    'Colorado': { primary: '#000000', secondary: '#CFB87C' },
    'Utah': { primary: '#CC0000', secondary: '#FFFFFF' },
    'Arizona': { primary: '#003366', secondary: '#CC0033' },
    'Arizona State': { primary: '#8C1D40', secondary: '#FFC627' },
    
    // Other
    'Notre Dame': { primary: '#0C2340', secondary: '#C99700' },
    'Navy': { primary: '#000080', secondary: '#FFD700' },
    'Army': { primary: '#000000', secondary: '#D4AF37' },
    'Air Force': { primary: '#003087', secondary: '#8A8D8F' },
    'Boise State': { primary: '#0033A0', secondary: '#FF6600' },
    'San Diego State': { primary: '#A6192E', secondary: '#000000' },
    'Fresno State': { primary: '#DB0032', secondary: '#00447C' },
    'UNLV': { primary: '#CC0000', secondary: '#666666' },
    'Wyoming': { primary: '#492F24', secondary: '#FFC425' },
    'New Mexico': { primary: '#BA0C2F', secondary: '#63666A' },
    'Colorado State': { primary: '#1E4D2B', secondary: '#C8C372' },
    'Hawaii': { primary: '#024731', secondary: '#FFFFFF' },
    'Nevada': { primary: '#003366', secondary: '#C0C0C0' },
    'San Jose State': { primary: '#0055A2', secondary: '#E5A823' },
    'Memphis': { primary: '#003087', secondary: '#8A8D8F' },
    'Tulane': { primary: '#006747', secondary: '#418FDE' },
    'South Florida': { primary: '#006747', secondary: '#CFC493' },
    'Charlotte': { primary: '#046A38', secondary: '#FFFFFF' },
    'Florida Atlantic': { primary: '#003366', secondary: '#CC0000' },
    'Florida International': { primary: '#081E3F', secondary: '#B6862C' },
    'Marshall': { primary: '#00B140', secondary: '#FFFFFF' },
    'Old Dominion': { primary: '#003057', secondary: '#A2AAAD' },
    'Middle Tennessee': { primary: '#0066CC', secondary: '#FFFFFF' },
    'Western Kentucky': { primary: '#C8102E', secondary: '#FFFFFF' },
    'North Texas': { primary: '#00853E', secondary: '#FFFFFF' },
    'UTSA': { primary: '#0C2340', secondary: '#F15A22' },
    'Rice': { primary: '#00205B', secondary: '#8996A0' },
    'Louisiana Tech': { primary: '#00338D', secondary: '#EB1C2D' },
    'Southern Miss': { primary: '#FFAA3C', secondary: '#000000' },
    'UTEP': { primary: '#FF8200', secondary: '#041E42' },
    'New Mexico State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
    'Liberty': { primary: '#002D72', secondary: '#C8102E' },
    'James Madison': { primary: '#450084', secondary: '#FFB612' },
    'Appalachian State': { primary: '#000000', secondary: '#FFCC00' },
    'Coastal Carolina': { primary: '#006F71', secondary: '#A27752' },
    'Georgia Southern': { primary: '#003A70', secondary: '#FFFFFF' },
    'Georgia State': { primary: '#0033A0', secondary: '#C8102E' },
    'Troy': { primary: '#8B0015', secondary: '#A7A8AA' },
    'South Alabama': { primary: '#004B8D', secondary: '#C8102E' },
    'Louisiana': { primary: '#CE181E', secondary: '#FFFFFF' },
    'Louisiana Monroe': { primary: '#8B0015', secondary: '#FFC82E' },
    'Arkansas State': { primary: '#CC092F', secondary: '#000000' },
    'Texas State': { primary: '#501214', secondary: '#B29369' },
    'Buffalo': { primary: '#005BBB', secondary: '#FFFFFF' },
    'Akron': { primary: '#041E42', secondary: '#A89968' },
    'Kent State': { primary: '#002664', secondary: '#EEB111' },
    'Ohio': { primary: '#00694E', secondary: '#FFFFFF' },
    'Miami (OH)': { primary: '#C8102E', secondary: '#FFFFFF' },
    'Bowling Green': { primary: '#FE5000', secondary: '#4F2C1D' },
    'Toledo': { primary: '#003E7E', secondary: '#F7B718' },
    'Central Michigan': { primary: '#6A0032', secondary: '#FFC82E' },
    'Eastern Michigan': { primary: '#006633', secondary: '#FFFFFF' },
    'Western Michigan': { primary: '#5B4638', secondary: '#FFCB05' },
    'Northern Illinois': { primary: '#BA0C2F', secondary: '#000000' },
    'Ball State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
  };
  return colorMap[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
};

// Get CFB team initials (many CFB teams use full name abbreviations)
export const getCFBTeamInitials = (teamName: string): string => {
  if (!teamName) return 'TBD';
  const initialsMap: { [key: string]: string } = {
    'Alabama': 'ALA',
    'Auburn': 'AUB',
    'Georgia': 'UGA',
    'Florida': 'UF',
    'LSU': 'LSU',
    'Texas A&M': 'A&M',
    'Ole Miss': 'OM',
    'Mississippi State': 'MSU',
    'Arkansas': 'ARK',
    'Kentucky': 'UK',
    'Tennessee': 'UT',
    'South Carolina': 'SC',
    'Missouri': 'MIZ',
    'Vanderbilt': 'VAN',
    'Oklahoma': 'OU',
    'Texas': 'TEX',
    'Ohio State': 'OSU',
    'Michigan': 'UM',
    'Penn State': 'PSU',
    'Michigan State': 'MSU',
    'Wisconsin': 'WIS',
    'Iowa': 'IOW',
    'Minnesota': 'MIN',
    'Nebraska': 'NEB',
    'Illinois': 'ILL',
    'Northwestern': 'NU',
    'Purdue': 'PUR',
    'Indiana': 'IU',
    'Rutgers': 'RU',
    'Maryland': 'MD',
    'USC': 'USC',
    'UCLA': 'UCLA',
    'Oregon': 'ORE',
    'Washington': 'UW',
    'Clemson': 'CLEM',
    'Miami': 'MIA',
    'Florida State': 'FSU',
    'North Carolina': 'UNC',
    'NC State': 'NCSU',
    'Virginia': 'UVA',
    'Virginia Tech': 'VT',
    'Louisville': 'LOU',
    'Pittsburgh': 'PITT',
    'Duke': 'DUKE',
    'Wake Forest': 'WAKE',
    'Boston College': 'BC',
    'Syracuse': 'SYR',
    'Georgia Tech': 'GT',
    'California': 'CAL',
    'Stanford': 'STAN',
    'SMU': 'SMU',
    'Oklahoma State': 'OKST',
    'Kansas State': 'KSU',
    'Baylor': 'BAY',
    'Texas Tech': 'TTU',
    'TCU': 'TCU',
    'West Virginia': 'WVU',
    'Kansas': 'KU',
    'Iowa State': 'ISU',
    'Cincinnati': 'CIN',
    'UCF': 'UCF',
    'Houston': 'HOU',
    'BYU': 'BYU',
    'Colorado': 'CU',
    'Utah': 'UTE',
    'Arizona': 'ARIZ',
    'Arizona State': 'ASU',
    'Notre Dame': 'ND',
    'Navy': 'NAVY',
    'Army': 'ARMY',
    'Air Force': 'AF',
    'Boise State': 'BSU',
    'San Diego State': 'SDSU',
    'Fresno State': 'FRES',
    'UNLV': 'UNLV',
    'Wyoming': 'WYO',
    'New Mexico': 'UNM',
    'Colorado State': 'CSU',
    'Hawaii': 'HAW',
    'Nevada': 'NEV',
    'San Jose State': 'SJSU',
    'Memphis': 'MEM',
    'Tulane': 'TU',
    'South Florida': 'USF',
    'Charlotte': 'CLT',
    'Florida Atlantic': 'FAU',
    'Florida International': 'FIU',
    'Marshall': 'MAR',
    'Old Dominion': 'ODU',
    'Middle Tennessee': 'MTSU',
    'Western Kentucky': 'WKU',
    'North Texas': 'UNT',
    'UTSA': 'UTSA',
    'Rice': 'RICE',
    'Louisiana Tech': 'LT',
    'Southern Miss': 'USM',
    'UTEP': 'UTEP',
    'New Mexico State': 'NMSU',
    'Liberty': 'LIB',
    'James Madison': 'JMU',
    'Appalachian State': 'APP',
    'Coastal Carolina': 'CCU',
    'Georgia Southern': 'GASO',
    'Georgia State': 'GSU',
    'Troy': 'TROY',
    'South Alabama': 'USA',
    'Louisiana': 'ULL',
    'Louisiana Monroe': 'ULM',
    'Arkansas State': 'ARST',
    'Texas State': 'TXST',
    'Buffalo': 'BUF',
    'Akron': 'AKR',
    'Kent State': 'KENT',
    'Ohio': 'OHIO',
    'Miami (OH)': 'MU',
    'Bowling Green': 'BGSU',
    'Toledo': 'TOL',
    'Central Michigan': 'CMU',
    'Eastern Michigan': 'EMU',
    'Western Michigan': 'WMU',
    'Northern Illinois': 'NIU',
    'Ball State': 'BALL',
  };
  return initialsMap[teamName] || (teamName ? teamName.substring(0, 3).toUpperCase() : 'TBD');
};

// NBA Team Colors
export const getNBATeamColors = (teamName: string): { primary: string; secondary: string } => {
  if (!teamName) return { primary: '#6B7280', secondary: '#9CA3AF' };
  
  const colorMap: { [key: string]: { primary: string; secondary: string } } = {
    'Atlanta Hawks': { primary: '#E03A3E', secondary: '#C1D32F' },
    'Atlanta': { primary: '#E03A3E', secondary: '#C1D32F' },
    'Boston Celtics': { primary: '#007A33', secondary: '#BA9653' },
    'Boston': { primary: '#007A33', secondary: '#BA9653' },
    'Brooklyn Nets': { primary: '#000000', secondary: '#FFFFFF' },
    'Brooklyn': { primary: '#000000', secondary: '#FFFFFF' },
    'Charlotte Hornets': { primary: '#1D1160', secondary: '#00788C' },
    'Charlotte': { primary: '#1D1160', secondary: '#00788C' },
    'Chicago Bulls': { primary: '#CE1141', secondary: '#000000' },
    'Chicago': { primary: '#CE1141', secondary: '#000000' },
    'Cleveland Cavaliers': { primary: '#860038', secondary: '#041E42' },
    'Cleveland': { primary: '#860038', secondary: '#041E42' },
    'Dallas Mavericks': { primary: '#00538C', secondary: '#002B5E' },
    'Dallas': { primary: '#00538C', secondary: '#002B5E' },
    'Denver Nuggets': { primary: '#0E2240', secondary: '#FEC524' },
    'Denver': { primary: '#0E2240', secondary: '#FEC524' },
    'Detroit Pistons': { primary: '#C8102E', secondary: '#1D42BA' },
    'Detroit': { primary: '#C8102E', secondary: '#1D42BA' },
    'Golden State Warriors': { primary: '#1D428A', secondary: '#FFC72C' },
    'Golden State': { primary: '#1D428A', secondary: '#FFC72C' },
    'Houston Rockets': { primary: '#CE1141', secondary: '#000000' },
    'Houston': { primary: '#CE1141', secondary: '#000000' },
    'Indiana Pacers': { primary: '#002D62', secondary: '#FDBB30' },
    'Indiana': { primary: '#002D62', secondary: '#FDBB30' },
    'LA Clippers': { primary: '#C8102E', secondary: '#1D428A' },
    'Los Angeles Clippers': { primary: '#C8102E', secondary: '#1D428A' },
    'LA Lakers': { primary: '#552583', secondary: '#FDB927' },
    'Los Angeles Lakers': { primary: '#552583', secondary: '#FDB927' },
    'Memphis Grizzlies': { primary: '#5D76A9', secondary: '#12173F' },
    'Memphis': { primary: '#5D76A9', secondary: '#12173F' },
    'Miami Heat': { primary: '#98002E', secondary: '#F9A01B' },
    'Miami': { primary: '#98002E', secondary: '#F9A01B' },
    'Milwaukee Bucks': { primary: '#00471B', secondary: '#EEE1C6' },
    'Milwaukee': { primary: '#00471B', secondary: '#EEE1C6' },
    'Minnesota Timberwolves': { primary: '#0C2340', secondary: '#236192' },
    'Minnesota': { primary: '#0C2340', secondary: '#236192' },
    'New Orleans Pelicans': { primary: '#0C2340', secondary: '#C8102E' },
    'New Orleans': { primary: '#0C2340', secondary: '#C8102E' },
    'New York Knicks': { primary: '#006BB6', secondary: '#F58426' },
    'New York': { primary: '#006BB6', secondary: '#F58426' },
    'Oklahoma City Thunder': { primary: '#007AC1', secondary: '#EF3B24' },
    'Oklahoma City': { primary: '#007AC1', secondary: '#EF3B24' },
    'Orlando Magic': { primary: '#0077C0', secondary: '#C4CED4' },
    'Orlando': { primary: '#0077C0', secondary: '#C4CED4' },
    'Philadelphia 76ers': { primary: '#006BB6', secondary: '#ED174C' },
    'Philadelphia': { primary: '#006BB6', secondary: '#ED174C' },
    'Phoenix Suns': { primary: '#1D1160', secondary: '#E56020' },
    'Phoenix': { primary: '#1D1160', secondary: '#E56020' },
    'Portland Trail Blazers': { primary: '#E03A3E', secondary: '#000000' },
    'Portland': { primary: '#E03A3E', secondary: '#000000' },
    'Sacramento Kings': { primary: '#5A2D81', secondary: '#63727A' },
    'Sacramento': { primary: '#5A2D81', secondary: '#63727A' },
    'San Antonio Spurs': { primary: '#C4CED4', secondary: '#000000' },
    'San Antonio': { primary: '#C4CED4', secondary: '#000000' },
    'Toronto Raptors': { primary: '#CE1141', secondary: '#000000' },
    'Toronto': { primary: '#CE1141', secondary: '#000000' },
    'Utah Jazz': { primary: '#002B5C', secondary: '#00471B' },
    'Utah': { primary: '#002B5C', secondary: '#00471B' },
    'Washington Wizards': { primary: '#002B5C', secondary: '#E31837' },
    'Washington': { primary: '#002B5C', secondary: '#E31837' },
  };
  
  if (colorMap[teamName]) {
    return colorMap[teamName];
  }
  
  // Try to extract team name from full name
  const teamMascots = [
    'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Mavericks',
    'Nuggets', 'Pistons', 'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers',
    'Grizzlies', 'Heat', 'Bucks', 'Timberwolves', 'Pelicans', 'Knicks', 'Thunder',
    'Magic', '76ers', 'Suns', 'Trail Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards'
  ];
  
  let cityName = teamName;
  for (const mascot of teamMascots) {
    if (cityName.endsWith(` ${mascot}`)) {
      cityName = cityName.replace(` ${mascot}`, '').trim();
      break;
    }
  }
  
  if (colorMap[cityName]) {
    return colorMap[cityName];
  }
  
  return { primary: '#6B7280', secondary: '#9CA3AF' };
};

// NBA Team Initials
export const getNBATeamInitials = (teamName: string): string => {
  const initialsMap: { [key: string]: string } = {
    'Atlanta Hawks': 'ATL',
    'Atlanta': 'ATL',
    'Boston Celtics': 'BOS',
    'Boston': 'BOS',
    'Brooklyn Nets': 'BKN',
    'Brooklyn': 'BKN',
    'Charlotte Hornets': 'CHA',
    'Charlotte': 'CHA',
    'Chicago Bulls': 'CHI',
    'Chicago': 'CHI',
    'Cleveland Cavaliers': 'CLE',
    'Cleveland': 'CLE',
    'Dallas Mavericks': 'DAL',
    'Dallas': 'DAL',
    'Denver Nuggets': 'DEN',
    'Denver': 'DEN',
    'Detroit Pistons': 'DET',
    'Detroit': 'DET',
    'Golden State Warriors': 'GSW',
    'Golden State': 'GSW',
    'Houston Rockets': 'HOU',
    'Houston': 'HOU',
    'Indiana Pacers': 'IND',
    'Indiana': 'IND',
    'LA Clippers': 'LAC',
    'Los Angeles Clippers': 'LAC',
    'LA Lakers': 'LAL',
    'Los Angeles Lakers': 'LAL',
    'Memphis Grizzlies': 'MEM',
    'Memphis': 'MEM',
    'Miami Heat': 'MIA',
    'Miami': 'MIA',
    'Milwaukee Bucks': 'MIL',
    'Milwaukee': 'MIL',
    'Minnesota Timberwolves': 'MIN',
    'Minnesota': 'MIN',
    'New Orleans Pelicans': 'NOP',
    'New Orleans': 'NOP',
    'New York Knicks': 'NYK',
    'New York': 'NYK',
    'Oklahoma City Thunder': 'OKC',
    'Oklahoma City': 'OKC',
    'Orlando Magic': 'ORL',
    'Orlando': 'ORL',
    'Philadelphia 76ers': 'PHI',
    'Philadelphia': 'PHI',
    'Phoenix Suns': 'PHX',
    'Phoenix': 'PHX',
    'Portland Trail Blazers': 'POR',
    'Portland': 'POR',
    'Sacramento Kings': 'SAC',
    'Sacramento': 'SAC',
    'San Antonio Spurs': 'SAS',
    'San Antonio': 'SAS',
    'Toronto Raptors': 'TOR',
    'Toronto': 'TOR',
    'Utah Jazz': 'UTA',
    'Utah': 'UTA',
    'Washington Wizards': 'WAS',
    'Washington': 'WAS',
  };
  return initialsMap[teamName] || (teamName ? teamName.substring(0, 3).toUpperCase() : 'TBD');
};

// NCAAB Team Initials (reuse CFB initials for most teams)
export const getNCAABTeamInitials = (teamName: string): string => {
  return getCFBTeamInitials(teamName);
};

// NFL Team Logos from ESPN
export const getNFLTeamLogo = (teamName: string): string => {
  const logoMap: { [key: string]: string } = {
    'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
    'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
    'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
    'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
    'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
    'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
    'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
    'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
    'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
    'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
    'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
    'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
    'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
    'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
    'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
    'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
    'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
  };
  return logoMap[teamName] || '';
};

// NBA Team Logos from ESPN
export const getNBATeamLogo = (teamName: string): string => {
  if (!teamName) return '';

  const logoMap: { [key: string]: string } = {
    'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Boston': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Brooklyn': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Charlotte': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Golden State': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'Indiana': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'LA Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Memphis': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Milwaukee': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'New York': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Oklahoma City': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Orlando': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Phoenix': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Portland': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'Sacramento': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'San Antonio': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Toronto': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Utah': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  };

  return logoMap[teamName] || '';
};

// CFB Team Logos from ESPN (major programs)
export const getCFBTeamLogo = (teamName: string): string => {
  if (!teamName) return '';

  const logoMap: { [key: string]: string } = {
    'Alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
    'Ohio State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    'Georgia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
    'Michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
    'Texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    'USC': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
    'Clemson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
    'Notre Dame': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
    'LSU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
    'Florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
    'Oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
    'Penn State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
    'Oklahoma': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
    'Tennessee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
    'Florida State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
    'Auburn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
    'Texas A&M': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
    'Wisconsin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
    'Iowa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
    'Michigan State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
    'Nebraska': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
    'UCLA': 'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
    'Arkansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
    'Ole Miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
    'Mississippi State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
    'Kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
    'South Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
    'NC State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
    'Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
    'Virginia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
    'Duke': 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
    'North Carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
    'Stanford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
    'California': 'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png',
    'Arizona': 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
    'Arizona State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
    'Utah': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
    'Colorado': 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
    'Baylor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
    'TCU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
    'Kansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
    'Kansas State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
    'Iowa State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
    'Oklahoma State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
    'West Virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
    'Cincinnati': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png',
    'UCF': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png',
    'BYU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
    'Louisville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
    'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
    'Syracuse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
    'Boston College': 'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png',
    'Wake Forest': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
    'Georgia Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
    'Purdue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
    'Indiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
    'Illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
    'Northwestern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
    'Maryland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
    'Rutgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
    'SMU': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png',
    'Memphis': 'https://a.espncdn.com/i/teamlogos/ncaa/500/235.png',
    'Tulane': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png',
    'Navy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
    'Army': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
    'Air Force': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
    'Boise State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png',
    'San Diego State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/21.png',
    'Fresno State': 'https://a.espncdn.com/i/teamlogos/ncaa/500/278.png',
    'UNLV': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2439.png',
    'Nevada': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2440.png',
    'Vanderbilt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
    'Missouri': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
    'Texas Tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
  };

  return logoMap[teamName] || '';
};

// NCAAB Team Logos (reuse CFB logos for most teams)
export const getNCAABTeamLogo = (teamName: string): string => {
  return getCFBTeamLogo(teamName);
};

