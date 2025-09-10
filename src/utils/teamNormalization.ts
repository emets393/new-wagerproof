/**
 * Team name normalization utility
 * Handles historical team name changes and variations
 */

// Team name mapping for historical changes and variations
const teamNameMap: { [key: string]: string } = {
  // Oakland Raiders -> Las Vegas Raiders (2020)
  'Oakland Raiders': 'Las Vegas Raiders',
  'Oakland': 'Las Vegas',
  
  // Washington Redskins -> Washington Commanders (2022)
  'Washington Redskins': 'Washington Commanders',
  'Washington Football Team': 'Washington Commanders',
  
  // St. Louis Rams -> Los Angeles Rams (2016)
  'St. Louis Rams': 'Los Angeles Rams',
  
  // San Diego Chargers -> Los Angeles Chargers (2017)
  'San Diego Chargers': 'Los Angeles Chargers',
  
  // Add more team name changes as needed
};

/**
 * Normalizes a team name to its current/standard form
 * @param teamName - The team name to normalize
 * @returns The normalized team name
 */
export const normalizeTeamName = (teamName: string): string => {
  if (!teamName) return teamName;
  
  // Check for exact matches first
  if (teamNameMap[teamName]) {
    return teamNameMap[teamName];
  }
  
  // Check for partial matches (e.g., "Oakland" in "Oakland Raiders")
  for (const [oldName, newName] of Object.entries(teamNameMap)) {
    if (teamName.includes(oldName)) {
      return teamName.replace(oldName, newName);
    }
  }
  
  return teamName;
};

/**
 * Normalizes team names in filter objects
 * @param filters - The filters object containing team names
 * @returns The filters object with normalized team names
 */
export const normalizeTeamNamesInFilters = (filters: Record<string, string>): Record<string, string> => {
  const normalizedFilters = { ...filters };
  
  // Fields that typically contain team names
  const teamFields = ['home_team', 'away_team', 'team'];
  
  teamFields.forEach(field => {
    if (normalizedFilters[field]) {
      normalizedFilters[field] = normalizeTeamName(normalizedFilters[field]);
    }
  });
  
  return normalizedFilters;
};

/**
 * Gets all possible team name variations for a given team
 * @param currentTeamName - The current team name
 * @returns Array of all possible historical names for this team
 */
export const getTeamNameVariations = (currentTeamName: string): string[] => {
  const variations = [currentTeamName];
  
  // Find reverse mappings
  for (const [oldName, newName] of Object.entries(teamNameMap)) {
    if (newName === currentTeamName) {
      variations.push(oldName);
    }
  }
  
  return variations;
};
