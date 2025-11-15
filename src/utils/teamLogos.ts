import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

// Cache for team mappings to avoid repeated fetches
let nbaTeamMappingsCache: any[] | null = null;
let ncaabTeamMappingsCache: Map<number, { espn_team_url: string; team_abbrev: string | null }> | null = null;

// Fetch NBA team mappings (cached)
export async function getNBATeamMappings(): Promise<any[]> {
  if (nbaTeamMappingsCache) {
    return nbaTeamMappingsCache;
  }

  try {
    const { data, error } = await collegeFootballSupabase
      .from('nba_teams_master')
      .select('*');

    if (error) {
      debug.error('Error fetching NBA team mappings:', error);
      return [];
    }

    nbaTeamMappingsCache = data || [];
    return nbaTeamMappingsCache;
  } catch (error) {
    debug.error('Error fetching NBA team mappings:', error);
    return [];
  }
}

// Fetch NCAAB team mappings (cached)
export async function getNCAABTeamMappings(): Promise<Map<number, { espn_team_url: string; team_abbrev: string | null }>> {
  if (ncaabTeamMappingsCache) {
    return ncaabTeamMappingsCache;
  }

  try {
    const { data, error } = await collegeFootballSupabase
      .from('ncaab_team_mapping')
      .select('api_team_id, espn_team_id, team_abbrev');

    if (error) {
      debug.error('Error fetching NCAAB team mappings:', error);
      return new Map();
    }

    const teamMappingsMap = new Map<number, { espn_team_url: string; team_abbrev: string | null }>();
    
    if (data) {
      data.forEach((team: any) => {
        if (team.api_team_id !== null && team.api_team_id !== undefined) {
          const numericId = typeof team.api_team_id === 'string' ? parseInt(team.api_team_id, 10) : team.api_team_id;
          
          let logoUrl = '/placeholder.svg';
          if (team.espn_team_id !== null && team.espn_team_id !== undefined) {
            const espnTeamId = typeof team.espn_team_id === 'string' ? parseInt(team.espn_team_id, 10) : team.espn_team_id;
            logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`;
          }
          
          teamMappingsMap.set(numericId, {
            espn_team_url: logoUrl,
            team_abbrev: team.team_abbrev || null
          });
        }
      });
    }

    ncaabTeamMappingsCache = teamMappingsMap;
    return teamMappingsMap;
  } catch (error) {
    debug.error('Error fetching NCAAB team mappings:', error);
    return new Map();
  }
}

// Get NBA team logo by team name
export async function getNBATeamLogo(teamName: string): Promise<string> {
  if (!teamName) return '/placeholder.svg';

  const mappings = await getNBATeamMappings();
  
  // Try database mapping with flexible matching
  const mapping = mappings.find((t: any) => {
    const tName = t.team_name || t.name || t.full_name || '';
    return tName === teamName || 
      teamName.includes(tName) ||
      tName.includes(teamName);
  });
  
  if (mapping?.logo_url && mapping.logo_url !== '/placeholder.svg' && mapping.logo_url.trim() !== '') {
    return mapping.logo_url;
  }
  if (mapping?.logo && mapping.logo !== '/placeholder.svg' && mapping.logo.trim() !== '') {
    return mapping.logo;
  }
  
  // Fallback to ESPN logo URLs
  const espnLogoMap: { [key: string]: string } = {
    'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
    'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
    'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
    'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
    'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
    'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
    'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
    'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
    'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
    'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
    'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
    'LA Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
    'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
    'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
    'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
    'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
    'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
    'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
    'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
    'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
    'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
    'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
    'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
    'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
  };
  
  // Try exact match first
  if (espnLogoMap[teamName]) {
    return espnLogoMap[teamName];
  }
  
  // Try case-insensitive match
  const lowerTeamName = teamName.toLowerCase();
  const matchedKey = Object.keys(espnLogoMap).find(key => key.toLowerCase() === lowerTeamName);
  if (matchedKey) {
    return espnLogoMap[matchedKey];
  }
  
  // Try partial match
  for (const [key, url] of Object.entries(espnLogoMap)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return url;
    }
  }
  
  return '/placeholder.svg';
}

// Get NCAAB team logo by team ID
export async function getNCAABTeamLogo(teamId: number | null | undefined): Promise<string> {
  if (teamId === null || teamId === undefined) {
    return '/placeholder.svg';
  }

  const mappings = await getNCAABTeamMappings();
  const numericId = typeof teamId === 'string' ? parseInt(teamId, 10) : teamId;
  
  if (mappings.has(numericId)) {
    const mapping = mappings.get(numericId);
    if (mapping?.espn_team_url && mapping.espn_team_url !== '/placeholder.svg' && mapping.espn_team_url.trim() !== '') {
      return mapping.espn_team_url;
    }
  }
  
  return '/placeholder.svg';
}

