import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      }
    });
  }

  // Get filters from request body
  let filters: Record<string, string> = {};
  
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      filters = body.filters || {};
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } else {
    // Fallback to query parameters for GET requests
    const url = new URL(req.url);
    filters = Object.fromEntries(url.searchParams.entries());
  }

  console.log('NFL Edge function received filters:', filters);
  console.log('Priority team ID filter:', filters.priority_team_id, 'Type:', typeof filters.priority_team_id);
  console.log('Opponent team ID filter:', filters.opponent_team_id, 'Type:', typeof filters.opponent_team_id);
  console.log('Season filter value:', filters.season, 'Type:', typeof filters.season);
  console.log('Week filter value:', filters.week, 'Type:', typeof filters.week);
  
  const supabase = createClient(
    "https://jpxnjuwglavsjbgbasnl.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
  );

  // NFL Team Logo mapping function (same as NFL page)
  const getNFLTeamLogo = (teamName: string): string => {
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
    return logoMap[teamName] || '/placeholder.svg';
  };

  // Helper: derive day-of-week in America/New_York
  const normalizeDateInput = (dateVal: string | number | Date | null | undefined): Date | null => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
      // If format is YYYY-MM-DD, treat as UTC midnight to avoid TZ skew
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        const dt = new Date(dateVal + 'T00:00:00Z');
        return Number.isNaN(dt.getTime()) ? null : dt;
      }
    }
    const dt = new Date(dateVal as any);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const getDayOfWeekEST = (dateVal: string | number | Date | null | undefined): string | null => {
    try {
      const dt = normalizeDateInput(dateVal);
      if (!dt) return null;
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
      });
      return formatter.format(dt).toLowerCase();
    } catch {
      return null;
    }
  };

  const getDayOfWeekUTC = (dateVal: string | number | Date | null | undefined): string | null => {
    try {
      const dt = normalizeDateInput(dateVal);
      if (!dt) return null;
      const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      return names[dt.getUTCDay()];
    } catch {
      return null;
    }
  };

  // Determine view type
  const viewType = filters.view_type || "individual";
  
  let query;
  let teamStats: any[] = [];
  let summary: any = {};

  if (viewType === "individual") {
    // Individual Team Performance - use v_nfl_training_exploded
    // First get all teams from nfl_team_mapping
    const { data: teamMapping, error: teamMappingError } = await supabase
      .from('nfl_team_mapping')
      .select('city_and_name, team_name, team_id');

    if (teamMappingError) {
      console.error('Team mapping error:', teamMappingError);
      return new Response(JSON.stringify({ error: teamMappingError.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('Team mapping data:', teamMapping);
    console.log('Team mapping count:', teamMapping?.length);
    if (teamMapping && teamMapping.length > 0) {
      console.log('First team mapping entry:', teamMapping[0]);
      console.log('Team mapping columns:', Object.keys(teamMapping[0]));
    }

    // If no team mapping data, return empty result
    if (!teamMapping || teamMapping.length === 0) {
      console.log('No team mapping data found');
      return new Response(JSON.stringify({ 
        teamStats: [], 
        summary: {},
        viewType: "individual",
        debug: "No team mapping data found"
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Initialize team map - deduplicate by team_id and prefer current team names
    const teamMap = new Map();
    
    // First, deduplicate team mapping data by team_id, preferring current names
    const deduplicatedTeamMapping = new Map();
    teamMapping?.forEach(team => {
      const existingTeam = deduplicatedTeamMapping.get(team.team_id);
      
      // If no existing team or if current team name is more recent (contains "Las Vegas" vs "Oakland")
      if (!existingTeam || 
          (team.city_and_name.includes('Las Vegas') && existingTeam.city_and_name.includes('Oakland'))) {
        deduplicatedTeamMapping.set(team.team_id, team);
      }
    });
    
    // If priority_team_id is specified, only initialize those teams
    if (filters.priority_team_id && filters.priority_team_id.length > 0) {
      const teamIds = Array.isArray(filters.priority_team_id) ? filters.priority_team_id : [filters.priority_team_id];
      teamIds.forEach(teamId => {
        const selectedTeam = deduplicatedTeamMapping.get(teamId);
        if (selectedTeam) {
          teamMap.set(selectedTeam.team_id, {
            teamId: selectedTeam.team_id,
            teamName: selectedTeam.city_and_name,
            teamLogo: getNFLTeamLogo(selectedTeam.team_name),
            games: 0,
            wins: 0,
            covers: 0,
            overs: 0,
            totalGames: 0
          });
        }
      });
    } else {
      // If no priority_team_id filter, initialize all teams
      deduplicatedTeamMapping.forEach(team => {
        teamMap.set(team.team_id, {
          teamId: team.team_id,
          teamName: team.city_and_name,
          teamLogo: getNFLTeamLogo(team.team_name),
          games: 0,
          wins: 0,
          covers: 0,
          overs: 0,
          totalGames: 0
        });
      });
    }

    console.log('Initialized teams:', teamMap.size);

    // Now get filtered data from v_nfl_training_exploded
    query = supabase.from('v_nfl_training_exploded').select('*');
    
    // Apply filters - filter by team_id directly (support arrays)
    if (filters.priority_team_id && filters.priority_team_id.length > 0) {
      console.log('Filtering by priority_team_id:', filters.priority_team_id);
      console.log('Filtering by priority_team_id type:', typeof filters.priority_team_id);
      if (Array.isArray(filters.priority_team_id)) {
        query = query.in('priority_team_id', filters.priority_team_id);
      } else {
        query = query.eq('priority_team_id', filters.priority_team_id);
      }
    }
    if (filters.opponent_team_id && filters.opponent_team_id.length > 0) {
      console.log('Filtering by opponent_team_id:', filters.opponent_team_id);
      console.log('Filtering by opponent_team_id type:', typeof filters.opponent_team_id);
      if (Array.isArray(filters.opponent_team_id)) {
        query = query.in('opponent_team_id', filters.opponent_team_id);
      } else {
        query = query.eq('opponent_team_id', filters.opponent_team_id);
      }
    }
    if (filters.season) {
      if (filters.season.includes(',')) {
        // Range filter: "2020,2024"
        const [minSeason, maxSeason] = filters.season.split(',').map(Number);
        query = query.gte('season', minSeason).lte('season', maxSeason);
      } else {
        query = query.eq('season', filters.season);
      }
    }
    if (filters.week) {
      if (filters.week.includes(',')) {
        // Range filter: "1,18"
        const [minWeek, maxWeek] = filters.week.split(',').map(Number);
        query = query.gte('week', minWeek).lte('week', maxWeek);
      } else {
        query = query.eq('week', filters.week);
      }
    }
    if (filters.start) {
      query = query.eq('start', filters.start);
    }
    // Day filter handled after fetch (derive from date column)
    if (filters.ou_vegas_line) {
      if (filters.ou_vegas_line.includes(',')) {
        const [minOu, maxOu] = filters.ou_vegas_line.split(',').map(Number);
        query = query.gte('ou_vegas_line', minOu).lte('ou_vegas_line', maxOu);
      } else {
        query = query.eq('ou_vegas_line', Number(filters.ou_vegas_line));
      }
    }
    if (filters.spread_closing) {
      if (filters.spread_closing.includes(',')) {
        const [minSpread, maxSpread] = filters.spread_closing.split(',').map(Number);
        query = query.gte('spread_closing', minSpread).lte('spread_closing', maxSpread);
      } else {
        query = query.eq('spread_closing', Number(filters.spread_closing));
      }
    }
    if (filters.surface) {
      const s = (filters.surface || '').toLowerCase();
      console.log('Filtering by surface:', s);
      if (s === 'grass') {
        query = query.ilike('surface', '%grass%');
      } else if (s === 'turf') {
        // Match common turf variants
        query = query.or(
          "surface.ilike.%turf%,surface.ilike.%artificial%,surface.ilike.%synthetic%,surface.ilike.%fieldturf%,surface.ilike.%astro%"
        );
      } else {
        query = query.eq('surface', filters.surface);
      }
    }
    if (filters.game_stadium_dome) {
      query = query.eq('game_stadium_dome', filters.game_stadium_dome);
    }
    if (filters.temperature) {
      if (filters.temperature.includes(',')) {
        const [minTemp, maxTemp] = filters.temperature.split(',').map(Number);
        query = query.gte('temperature', minTemp).lte('temperature', maxTemp);
      } else {
        query = query.eq('temperature', Number(filters.temperature));
      }
    }
    if (filters.precipitation_type) {
      const p = (filters.precipitation_type || '').toLowerCase();
      console.log('Filtering by precipitation_type:', p);
      if (p === 'rain') {
        // Match any rain variants
        query = query.ilike('precipitation_type', '%rain%');
      } else if (p === 'snow') {
        // Match any snow variants
        query = query.ilike('precipitation_type', '%snow%');
      } else if (p === 'none') {
        // Treat none as null/clear/dry/no precipitation
        query = query.or("precipitation_type.is.null,precipitation_type.ilike.clear,precipitation_type.ilike.dry,precipitation_type.ilike.none,precipitation_type.ilike.no%precipitation% ");
      } else {
        query = query.eq('precipitation_type', filters.precipitation_type);
      }
    }
    if (filters.wind_speed) {
      if (filters.wind_speed.includes(',')) {
        const [minWind, maxWind] = filters.wind_speed.split(',').map(Number);
        query = query.gte('wind_speed', minWind).lte('wind_speed', maxWind);
      } else {
        query = query.eq('wind_speed', Number(filters.wind_speed));
      }
    }
    if (filters.conference_game) {
      query = query.eq('conference_game', filters.conference_game === 'true');
    }
    
    // Boolean filters (1 and 0 in database)
    if (filters.team_last_spread) {
      query = query.eq('team_last_spread', Number(filters.team_last_spread));
    }
    if (filters.team_last_ou) {
      query = query.eq('team_last_ou', Number(filters.team_last_ou));
    }
    if (filters.team_last_ml) {
      query = query.eq('team_last_ml', Number(filters.team_last_ml));
    }
    if (filters.opponent_last_spread) {
      query = query.eq('opponent_last_spread', Number(filters.opponent_last_spread));
    }
    if (filters.opponent_last_ou) {
      query = query.eq('opponent_last_ou', Number(filters.opponent_last_ou));
    }
    if (filters.opponent_last_ml) {
      query = query.eq('opponent_last_ml', Number(filters.opponent_last_ml));
    }
    
    // Home/Away last game filters
    if (filters.team_consecutive_home_away) {
      if (filters.team_consecutive_home_away === 'home') {
        // Home: positive numbers >= 2
        query = query.gte('team_consecutive_home_away', 2);
      } else if (filters.team_consecutive_home_away === 'away') {
        // Away: negative numbers OR positive 1
        query = query.or('team_consecutive_home_away.lt.0,team_consecutive_home_away.eq.1');
      }
    }
    if (filters.opponent_consecutive_home_away) {
      if (filters.opponent_consecutive_home_away === 'home') {
        // Home: positive numbers >= 2
        query = query.gte('opponent_consecutive_home_away', 2);
      } else if (filters.opponent_consecutive_home_away === 'away') {
        // Away: negative numbers OR positive 1
        query = query.or('opponent_consecutive_home_away.lt.0,opponent_consecutive_home_away.eq.1');
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('Filtered data count:', data?.length);
    console.log('Sample data row:', data?.[0]);
    if (data && data.length > 0) {
      console.log('Sample row columns:', Object.keys(data[0]));
      console.log('Sample priority_team_id values:', data.slice(0, 5).map(row => row.priority_team_id));
      console.log('Sample opponent_team_id values:', data.slice(0, 5).map(row => row.opponent_team_id));
      // Check if there are other team-related columns
      const teamColumns = Object.keys(data[0]).filter(key => key.includes('team') || key.includes('Team'));
      console.log('Team-related columns:', teamColumns);
    }
    
    // Debug: Check what priority_team_id values exist in the data
    if (data && data.length > 0) {
      const uniqueTeamIds = [...new Set(data.map(row => row.priority_team_id))];
      console.log('Unique priority_team_id values in data:', uniqueTeamIds.slice(0, 10));
    }
    
    // Debug: Check what precipitation values exist
    const { data: precipData } = await supabase
      .from('v_nfl_training_exploded')
      .select('precipitation_type')
      .not('precipitation_type', 'is', null)
      .limit(10);
    console.log('Sample precipitation values:', precipData?.map(r => r.precipitation_type));

    // If no data from v_nfl_training_exploded, still return all teams with 0 stats
    if (!data || data.length === 0) {
      console.log('No data from v_nfl_training_exploded, returning teams with 0 stats');
    }

    // Apply derived day-of-week filter if requested
    const filteredByDay = (filters.day
      ? data?.filter((row: any) => {
          const d = (filters.day || '').toLowerCase();
          const valid = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
          if (!valid.includes(d)) return true;
          const dateVal = row.game_date || row.start || row.date || row.game_date_time || row.datetime;
          const est = getDayOfWeekEST(dateVal);
          const utc = getDayOfWeekUTC(dateVal);
          if (!est && !utc) return true; // don't exclude on parse failure
          const match = (est === d) || (utc === d);
          if (!match && (Math.random() < 0.01)) {
            console.log('Day filter mismatch sample:', { input: dateVal, est, utc, want: d });
          }
          return match;
        })
      : data) || [];

    // Process the filtered data and update team stats (non-deduped)
    filteredByDay.forEach(row => {
      // priority_team_id in v_nfl_training_exploded contains team IDs
      const teamId = row.priority_team_id;
      
      // If team not in map yet, add it (for opponent filtering case)
      if (!teamMap.has(teamId)) {
        const teamInfo = deduplicatedTeamMapping.get(teamId);
        if (teamInfo) {
          teamMap.set(teamId, {
            teamId: teamInfo.team_id,
            teamName: teamInfo.city_and_name,
            teamLogo: getNFLTeamLogo(teamInfo.team_name),
            games: 0,
            wins: 0,
            covers: 0,
            overs: 0,
            totalGames: 0
          });
        }
      }
      
      if (teamMap.has(teamId)) {
        const team = teamMap.get(teamId);
        team.games++;
        team.totalGames++;
        
        if (row.priority_team_won === 1) team.wins++;
        if (row.priority_team_covered === 1) team.covers++;
        if (row.ou_result === 1) team.overs++;
      }
    });

    // Convert to array and calculate percentages
    teamStats = Array.from(teamMap.values()).map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      teamLogo: team.teamLogo,
      games: team.games,
      winPercentage: team.games > 0 ? (team.wins / team.games * 100).toFixed(1) : 0,
      coverPercentage: team.games > 0 ? (team.covers / team.games * 100).toFixed(1) : 0,
      overPercentage: team.games > 0 ? (team.overs / team.games * 100).toFixed(1) : 0
    }));

    console.log('Final team stats count:', teamStats.length);

    // Compute deduped game-level summary for donuts
    const uniqueMap = new Map<string, any>();
    filteredByDay.forEach((row: any) => {
      const id = String(row.unique_id ?? `${row.game_id ?? ''}-${row.start ?? row.game_date ?? ''}`);
      if (!uniqueMap.has(id)) uniqueMap.set(id, row);
    });

    const games = Array.from(uniqueMap.values());
    const totalGames = games.length;
    const homeWins = games.filter(r => r.home_away_ml === 1).length;
    const awayWins = totalGames - homeWins;
    const homeCovers = games.filter(r => r.home_away_spread_cover === 1).length;
    const awayCovers = totalGames - homeCovers;
    const favoriteCovers = games.filter(r => r.favorite_covered === 1).length;
    const underdogCovers = totalGames - favoriteCovers;
    const overs = games.filter(r => r.ou_result === 1).length;
    const unders = totalGames - overs;

    summary = {
      totalGames,
      homeWinPercentage: totalGames ? (homeWins / totalGames * 100).toFixed(1) : 0,
      awayWinPercentage: totalGames ? (awayWins / totalGames * 100).toFixed(1) : 0,
      homeCoverPercentage: totalGames ? (homeCovers / totalGames * 100).toFixed(1) : 0,
      awayCoverPercentage: totalGames ? (awayCovers / totalGames * 100).toFixed(1) : 0,
      favoriteCoverPercentage: totalGames ? (favoriteCovers / totalGames * 100).toFixed(1) : 0,
      underdogCoverPercentage: totalGames ? (underdogCovers / totalGames * 100).toFixed(1) : 0,
      overPercentage: totalGames ? (overs / totalGames * 100).toFixed(1) : 0,
      underPercentage: totalGames ? (unders / totalGames * 100).toFixed(1) : 0,
    };

  } else {
    // Game Level Performance - use nfl_training_data
    query = supabase.from('nfl_training_data').select('*');
    
    // Apply filters
    if (filters.home_team_id) {
      query = query.eq('home_team_id', filters.home_team_id);
    }
    if (filters.away_team_id) {
      query = query.eq('away_team_id', filters.away_team_id);
    }
    if (filters.home_spread) {
      query = query.eq('home_spread', filters.home_spread);
    }
    if (filters.start) {
      query = query.eq('start', filters.start);
    }
    // Day filter handled after fetch (derive from date column)
    if (filters.temperature) {
      if (filters.temperature.includes(',')) {
        const [minTemp, maxTemp] = filters.temperature.split(',').map(Number);
        query = query.gte('temperature', minTemp).lte('temperature', maxTemp);
      } else {
        query = query.eq('temperature', Number(filters.temperature));
      }
    }
    if (filters.wind_speed) {
      if (filters.wind_speed.includes(',')) {
        const [minWind, maxWind] = filters.wind_speed.split(',').map(Number);
        query = query.gte('wind_speed', minWind).lte('wind_speed', maxWind);
      } else {
        query = query.eq('wind_speed', Number(filters.wind_speed));
      }
    }
    if (filters.precipitation_type) {
      const p = (filters.precipitation_type || '').toLowerCase();
      console.log('Filtering by precipitation_type:', p);
      if (p === 'rain') {
        query = query.ilike('precipitation_type', '%rain%');
      } else if (p === 'snow') {
        query = query.ilike('precipitation_type', '%snow%');
      } else if (p === 'none') {
        query = query.or("precipitation_type.is.null,precipitation_type.ilike.clear,precipitation_type.ilike.dry,precipitation_type.ilike.none,precipitation_type.ilike.no%precipitation% ");
      } else {
        query = query.eq('precipitation_type', filters.precipitation_type);
      }
    }
    if (filters.game_stadium_dome) {
      query = query.eq('game_stadium_dome', filters.game_stadium_dome);
    }
    if (filters.conference_game) {
      query = query.eq('conference_game', filters.conference_game === 'true');
    }
    if (filters.surface) {
      const s = (filters.surface || '').toLowerCase();
      console.log('Filtering by surface:', s);
      if (s === 'grass') {
        query = query.ilike('surface', '%grass%');
      } else if (s === 'turf') {
        query = query.or(
          "surface.ilike.%turf%,surface.ilike.%artificial%,surface.ilike.%synthetic%,surface.ilike.%fieldturf%,surface.ilike.%astro%"
        );
      } else {
        query = query.eq('surface', filters.surface);
      }
    }
    if (filters.week) {
      if (filters.week.includes(',')) {
        // Range filter: "1,18"
        const [minWeek, maxWeek] = filters.week.split(',').map(Number);
        query = query.gte('week', minWeek).lte('week', maxWeek);
      } else {
        query = query.eq('week', filters.week);
      }
    }
    if (filters.season) {
      if (filters.season.includes(',')) {
        // Range filter: "2020,2024"
        const [minSeason, maxSeason] = filters.season.split(',').map(Number);
        query = query.gte('season', minSeason).lte('season', maxSeason);
      } else {
        query = query.eq('season', filters.season);
      }
    }
    if (filters.ou_vegas_line) {
      if (filters.ou_vegas_line.includes(',')) {
        const [minOu, maxOu] = filters.ou_vegas_line.split(',').map(Number);
        query = query.gte('ou_vegas_line', minOu).lte('ou_vegas_line', maxOu);
      } else {
        query = query.eq('ou_vegas_line', Number(filters.ou_vegas_line));
      }
    }
    
    // Boolean filters (1 and 0 in database)
    if (filters.team_last_spread) {
      query = query.eq('team_last_spread', Number(filters.team_last_spread));
    }
    if (filters.team_last_ou) {
      query = query.eq('team_last_ou', Number(filters.team_last_ou));
    }
    if (filters.team_last_ml) {
      query = query.eq('team_last_ml', Number(filters.team_last_ml));
    }
    if (filters.opponent_last_spread) {
      query = query.eq('opponent_last_spread', Number(filters.opponent_last_spread));
    }
    if (filters.opponent_last_ou) {
      query = query.eq('opponent_last_ou', Number(filters.opponent_last_ou));
    }
    if (filters.opponent_last_ml) {
      query = query.eq('opponent_last_ml', Number(filters.opponent_last_ml));
    }
    
    // Home/Away last game filters
    if (filters.team_consecutive_home_away) {
      if (filters.team_consecutive_home_away === 'home') {
        // Home: positive numbers >= 2
        query = query.gte('team_consecutive_home_away', 2);
      } else if (filters.team_consecutive_home_away === 'away') {
        // Away: negative numbers OR positive 1
        query = query.or('team_consecutive_home_away.lt.0,team_consecutive_home_away.eq.1');
      }
    }
    if (filters.opponent_consecutive_home_away) {
      if (filters.opponent_consecutive_home_away === 'home') {
        // Home: positive numbers >= 2
        query = query.gte('opponent_consecutive_home_away', 2);
      } else if (filters.opponent_consecutive_home_away === 'away') {
        // Away: negative numbers OR positive 1
        query = query.or('opponent_consecutive_home_away.lt.0,opponent_consecutive_home_away.eq.1');
      }
    }

    console.log('About to execute query with filters:', {
      season: filters.season,
      week: filters.week,
      seasonType: typeof filters.season,
      weekType: typeof filters.week
    });

    const { data, error } = await query;
    
    if (error) {
      console.error('Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Calculate summary stats for game level
    const derivedDayFiltered = (filters.day
      ? data?.filter((row: any) => {
          const d = (filters.day || '').toLowerCase();
          const valid = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
          if (!valid.includes(d)) return true;
          const dateVal = row.game_date || row.start || row.date || row.game_date_time || row.datetime;
          const est = getDayOfWeekEST(dateVal);
          const utc = getDayOfWeekUTC(dateVal);
          if (!est && !utc) return true;
          return (est === d) || (utc === d);
        })
      : data) || [];

    const totalGames = derivedDayFiltered.length || 0;
    const homeWins = derivedDayFiltered.filter(row => row.home_away_ml === 1).length || 0;
    const homeCovers = derivedDayFiltered.filter(row => row.home_away_spread_cover === 1).length || 0;
    const overs = derivedDayFiltered.filter(row => row.ou_result === 1).length || 0;

    summary = {
      totalGames,
      homeWinPercentage: totalGames > 0 ? (homeWins / totalGames * 100).toFixed(1) : 0,
      awayWinPercentage: totalGames > 0 ? ((totalGames - homeWins) / totalGames * 100).toFixed(1) : 0,
      homeCoverPercentage: totalGames > 0 ? (homeCovers / totalGames * 100).toFixed(1) : 0,
      awayCoverPercentage: totalGames > 0 ? ((totalGames - homeCovers) / totalGames * 100).toFixed(1) : 0,
      overPercentage: totalGames > 0 ? (overs / totalGames * 100).toFixed(1) : 0,
      underPercentage: totalGames > 0 ? ((totalGames - overs) / totalGames * 100).toFixed(1) : 0
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  return new Response(JSON.stringify({ 
    teamStats, 
    summary,
    viewType 
  }), {
    status: 200,
    headers
  });
});
