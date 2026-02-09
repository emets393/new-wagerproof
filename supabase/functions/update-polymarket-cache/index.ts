import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NFLGame {
  away_team: string;
  home_team: string;
}

// NFL team mascots for matching Polymarket event titles
const NFL_TEAM_MASCOTS: Record<string, string> = {
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

// NBA teams - extract mascot from full name for Polymarket matching
// Database has "Charlotte Hornets", Polymarket uses "Hornets"
const NBA_TEAM_TO_MASCOT: Record<string, string> = {
  'Atlanta Hawks': 'Hawks',
  'Boston Celtics': 'Celtics',
  'Brooklyn Nets': 'Nets',
  'Charlotte Hornets': 'Hornets',
  'Chicago Bulls': 'Bulls',
  'Cleveland Cavaliers': 'Cavaliers',
  'Dallas Mavericks': 'Mavericks',
  'Denver Nuggets': 'Nuggets',
  'Detroit Pistons': 'Pistons',
  'Golden State Warriors': 'Warriors',
  'Houston Rockets': 'Rockets',
  'Indiana Pacers': 'Pacers',
  'LA Clippers': 'Clippers',
  'Los Angeles Clippers': 'Clippers',
  'Los Angeles Lakers': 'Lakers',
  'Memphis Grizzlies': 'Grizzlies',
  'Miami Heat': 'Heat',
  'Milwaukee Bucks': 'Bucks',
  'Minnesota Timberwolves': 'Timberwolves',
  'New Orleans Pelicans': 'Pelicans',
  'New York Knicks': 'Knicks',
  'Oklahoma City Thunder': 'Thunder',
  'Orlando Magic': 'Magic',
  'Philadelphia 76ers': '76ers',
  'Phoenix Suns': 'Suns',
  'Portland Trail Blazers': 'Trail Blazers',
  'Sacramento Kings': 'Kings',
  'San Antonio Spurs': 'Spurs',
  'Toronto Raptors': 'Raptors',
  'Utah Jazz': 'Jazz',
  'Washington Wizards': 'Wizards',
};

// CFB teams - map common variations to Polymarket names
const CFB_TEAM_MAPPINGS: Record<string, string> = {
  'Ohio State': 'Ohio State',
  'Michigan': 'Michigan',
  'Alabama': 'Alabama',
  'Georgia': 'Georgia',
  'Texas': 'Texas',
  'Oregon': 'Oregon',
  'Penn State': 'Penn State',
  'Notre Dame': 'Notre Dame',
  'USC': 'USC',
  'LSU': 'LSU',
  'Clemson': 'Clemson',
  'Florida State': 'Florida State',
  'Florida': 'Florida',
  'Tennessee': 'Tennessee',
  'Oklahoma': 'Oklahoma',
  'Texas A&M': 'Texas A&M',
  'Auburn': 'Auburn',
  'Ole Miss': 'Ole Miss',
  'Miami': 'Miami',
  'Washington': 'Washington',
  'Wisconsin': 'Wisconsin',
  'Iowa': 'Iowa',
  'Utah': 'Utah',
  'Oklahoma State': 'Oklahoma State',
  'Kentucky': 'Kentucky',
  'South Carolina': 'South Carolina',
  'Mississippi State': 'Mississippi State',
  'Arkansas': 'Arkansas',
  'Missouri': 'Missouri',
  'Kansas State': 'Kansas State',
  'TCU': 'TCU',
  'Baylor': 'Baylor',
  'North Carolina': 'North Carolina',
  'NC State': 'NC State',
  'Virginia Tech': 'Virginia Tech',
  'Pittsburgh': 'Pittsburgh',
  'Louisville': 'Louisville',
  'Jacksonville State': 'Jacksonville State',
  'Middle Tennessee': 'Middle Tennessee',
};

// NCAAB-specific team name mappings: DB name -> Polymarket name
// Handles cases where database abbreviations differ from Polymarket's full names
const NCAAB_TEAM_MAPPINGS: Record<string, string> = {
  // "U" prefix abbreviations
  'UAlbany': 'Albany',
  'UMass Lowell': 'Massachusetts Lowell',
  'UMass': 'Massachusetts',
  'UConn': 'Connecticut',
  'UNC': 'North Carolina',
  'UNC Wilmington': 'UNCW',
  'UNC Greensboro': 'UNCG',
  'UNC Asheville': 'UNC Asheville',
  'UNLV': 'UNLV',
  'UTEP': 'UTEP',
  'UTSA': 'UTSA',
  'UT Martin': 'UT Martin',
  'UT Arlington': 'UT Arlington',
  'UCF': 'UCF',
  'UCLA': 'UCLA',
  'UCSB': 'UC Santa Barbara',
  'UCI': 'UC Irvine',
  'UCD': 'UC Davis',
  'UCR': 'UC Riverside',
  // Directional/regional abbreviations
  'ETSU': 'East Tennessee State',
  'MTSU': 'Middle Tennessee',
  'FGCU': 'Florida Gulf Coast',
  'SFA': 'Stephen F Austin',
  'SMU': 'SMU',
  'VCU': 'VCU',
  'BYU': 'BYU',
  'TCU': 'TCU',
  'LSU': 'LSU',
  'USC': 'USC',
  // Saint/St variations
  "St. John's": "St Johns",
  "Saint Mary's": "Saint Marys",
  "St. Bonaventure": "St Bonaventure",
  "St. Thomas": "St Thomas",
  "Saint Peter's": "Saint Peters",
  "St. Francis (PA)": "St Francis",
  // Cal State / UC system
  'Cal State Northridge': 'CSUN',
  'Cal State Bakersfield': 'Bakersfield',
  'Cal State Fullerton': 'Cal State Fullerton',
  'Cal Poly': 'Cal Poly',
  'UC Irvine': 'UC Irvine',
  'UC San Diego': 'California San Diego',
  'UC Davis': 'UC Davis',
  'UC Riverside': 'UC Riverside',
  'UC Santa Barbara': 'UC Santa Barbara',
  'Long Beach State': 'Long Beach State',
  // Other common variations
  'Queens University': 'Queens',
  'Long Island University': 'LIU',
  'Ole Miss': 'Ole Miss',
  'Loyola Chicago': 'Loyola Chicago',
  'Loyola Marymount': 'Loyola Marymount',
  'Miami (OH)': 'Miami OH',
  'Miami (FL)': 'Miami',
  'LIU': 'LIU',
  'NJIT': 'NJIT',
  'SIU Edwardsville': 'SIU Edwardsville',
  'Southern Indiana': 'Southern Indiana',
  'Southeast Missouri State': 'Southeast Missouri State',
  'Purdue Fort Wayne': 'Purdue Fort Wayne',
  'Little Rock': 'Little Rock',
  'Central Arkansas': 'Central Arkansas',
};

// Get team mascot from database team name (NFL only)
function getTeamMascot(teamName: string): string {
  // Check if it's already a mascot
  if (Object.values(NFL_TEAM_MASCOTS).includes(teamName)) {
    return teamName;
  }
  // Check if it's a city name
  return NFL_TEAM_MASCOTS[teamName] || teamName;
}

// Get team name for matching with Polymarket format
// NFL: uses mascots (Ravens, Dolphins)
// NBA: uses mascots (Hornets, Bucks) - extract from full name
// CFB: uses school names (Ohio State, Michigan)
// NCAAB: Note - Polymarket uses full names like "Duke Blue Devils" but database has "Duke"
//        The matching function will handle this via flexible matching
function getTeamName(teamName: string, league: 'nfl' | 'cfb' | 'nba' | 'ncaab'): string {
  if (league === 'nba') {
    // NBA: Extract mascot from full name (Charlotte Hornets -> Hornets)
    const mascot = NBA_TEAM_TO_MASCOT[teamName];
    if (mascot) {
      console.log(`NBA team mapping: "${teamName}" -> "${mascot}"`);
      return mascot;
    }
    // Fallback: try to extract last word as mascot
    const parts = teamName.split(' ');
    const extracted = parts[parts.length - 1];
    console.log(`NBA team fallback: "${teamName}" -> "${extracted}"`);
    return extracted;
  }
  if (league === 'ncaab') {
    // NCAAB: Check NCAAB-specific mappings first, then CFB mappings, then use as-is
    return NCAAB_TEAM_MAPPINGS[teamName] || CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  if (league === 'cfb') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  // NFL uses mascot-based names
  return getTeamMascot(teamName);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for main project (for polymarket_markets table)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize College Football Supabase client (for nfl_predictions_epa table)
    const cfbUrl = 'https://jpxnjuwglavsjbgbasnl.supabase.co';
    const cfbAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';
    const cfbSupabase = createClient(cfbUrl, cfbAnonKey);

    console.log('🔄 Starting Polymarket cache update...');

    // Step 1: Get current games for NFL, CFB, NCAAB, and NBA
    const today = new Date().toISOString().split('T')[0];
    // Fetch games for next 7 days (matching frontend logic)
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowStr = weekFromNow.toISOString().split('T')[0];
    
    // Fetch NFL games
    const { data: nflLines, error: nflError } = await cfbSupabase
      .from('nfl_betting_lines')
      .select('away_team, home_team, game_date, training_key')
      .gte('game_date', today)
      .lte('game_date', weekFromNowStr);

    if (nflError) {
      console.error('Error fetching NFL betting lines:', nflError);
    }

    // Fetch CFB games
    const { data: cfbGames, error: cfbError } = await cfbSupabase
      .from('cfb_live_weekly_inputs')
      .select('away_team, home_team');

    if (cfbError) {
      console.error('Error fetching CFB games:', cfbError);
    }

    // Fetch NCAAB games
    const { data: ncaabGames, error: ncaabError } = await cfbSupabase
      .from('v_cbb_input_values')
      .select('away_team, home_team, game_date_et')
      .gte('game_date_et', today)
      .lte('game_date_et', weekFromNowStr);

    if (ncaabError) {
      console.error('Error fetching NCAAB games:', ncaabError);
    }

    // Fetch NBA games from nba_input_values_view (same view used by NBA page)
    let nbaGames: any[] = [];
    try {
      const { data: nbaData, error: nbaError } = await cfbSupabase
        .from('nba_input_values_view')
        .select('away_team, home_team, game_date')
        .gte('game_date', today)
        .lte('game_date', weekFromNowStr);
      
      if (!nbaError && nbaData) {
        nbaGames = nbaData;
        console.log(`📋 Found ${nbaGames.length} NBA games from nba_input_values_view`);
      } else if (nbaError) {
        console.error('Error fetching NBA games:', nbaError);
      }
    } catch (e) {
      console.log('NBA games view may not exist, skipping...', e);
    }

    // Combine and tag with league
    const allGames: Array<{ away_team: string; home_team: string; league: 'nfl' | 'cfb' | 'ncaab' | 'nba'; training_key?: string }> = [];
    
    if (nflLines && nflLines.length > 0) {
      // Deduplicate NFL by training_key
      const nflMap = new Map<string, any>();
      for (const line of nflLines) {
        if (!nflMap.has(line.training_key)) {
          nflMap.set(line.training_key, { ...line, league: 'nfl' });
        }
      }
      allGames.push(...Array.from(nflMap.values()));
    }

    if (cfbGames && cfbGames.length > 0) {
      allGames.push(...cfbGames.map(g => ({ ...g, league: 'cfb' as const })));
    }

    if (ncaabGames && ncaabGames.length > 0) {
      allGames.push(...ncaabGames.map(g => ({ ...g, league: 'ncaab' as const })));
    }

    if (nbaGames && nbaGames.length > 0) {
      allGames.push(...nbaGames.map(g => ({ ...g, league: 'nba' as const })));
    }

    if (allGames.length === 0) {
      console.log('No games found to update');
      return new Response(
        JSON.stringify({ success: true, message: 'No games to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${allGames.length} games to update (${nflLines?.length || 0} NFL, ${cfbGames?.length || 0} CFB, ${ncaabGames?.length || 0} NCAAB, ${nbaGames?.length || 0} NBA)`);

    // Step 2: Get tag IDs for all leagues (using hardcoded values for CBB and NBA)
    // Fetch sports metadata for NFL and CFB
    const sportsResponse = await fetch('https://gamma-api.polymarket.com/sports', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-PolymarketCache/1.0'
      }
    });

    let nflTagId: string | null = null;
    let cfbTagId: string | null = null;

    if (sportsResponse.ok) {
      const sportsList = await sportsResponse.json();
      
      // Get NFL tag
      const nflSport = sportsList.find((s: any) => s.sport?.toLowerCase() === 'nfl');
      const nflTagCandidates = nflSport?.tags.split(',').map((t: string) => t.trim()).filter(Boolean) || [];
      nflTagId = nflTagCandidates.find((t: string) => t !== '1') || nflTagCandidates[0];

      // Get CFB tag
      const cfbSport = sportsList.find((s: any) => s.sport?.toLowerCase() === 'cfb');
      const cfbTagCandidates = cfbSport?.tags.split(',').map((t: string) => t.trim()).filter(Boolean) || [];
      cfbTagId = cfbTagCandidates.find((t: string) => t !== '1') || cfbTagCandidates[0];
    }

    // Use hardcoded tag IDs for CBB and NBA (these are the correct ones)
    const ncaabTagId = '102114'; // CBB tag ID
    const nbaTagId = '745'; // NBA tag ID

    console.log(`🏈 NFL tag ID: ${nflTagId}, 🏈 CFB tag ID: ${cfbTagId}, 🏀 NCAAB tag ID: ${ncaabTagId}, 🏀 NBA tag ID: ${nbaTagId}`);

    // Step 3: Fetch events for all leagues
    const allEvents: Array<{ event: any; league: 'nfl' | 'cfb' | 'ncaab' | 'nba' }> = [];

    // Helper to fetch ALL events for a tag with pagination (Polymarket caps at 100 per request)
    async function fetchAllEventsForTag(tagId: string, leagueName: string): Promise<any[]> {
      const allLeagueEvents: any[] = [];
      let offset = 0;
      const pageSize = 100;
      const maxPages = 10; // Safety limit: 1000 events max per league

      for (let page = 0; page < maxPages; page++) {
        const url = `https://gamma-api.polymarket.com/events?tag_id=${tagId}&closed=false&limit=${pageSize}&offset=${offset}&related_tags=true`;
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'WagerProof-PolymarketCache/1.0'
          }
        });

        if (!response.ok) {
          console.error(`❌ Failed to fetch ${leagueName} events page ${page + 1}: ${response.status}`);
          break;
        }

        const responseData = await response.json();
        const pageEvents = Array.isArray(responseData) ? responseData : (responseData.events || responseData.data || []);
        
        if (pageEvents.length === 0) break; // No more events
        
        allLeagueEvents.push(...pageEvents);
        console.log(`📋 ${leagueName} page ${page + 1}: fetched ${pageEvents.length} events (total so far: ${allLeagueEvents.length})`);
        
        if (pageEvents.length < pageSize) break; // Last page (partial)
        offset += pageSize;
      }

      return allLeagueEvents;
    }

    // Fetch events for all leagues in parallel
    const eventFetches: Promise<void>[] = [];
    
    if (nflTagId) {
      eventFetches.push(fetchAllEventsForTag(nflTagId, 'NFL').then(events => {
        allEvents.push(...events.map((e: any) => ({ event: e, league: 'nfl' as const })));
        console.log(`📋 Found ${events.length} total NFL events on Polymarket`);
      }));
    }
    if (cfbTagId) {
      eventFetches.push(fetchAllEventsForTag(cfbTagId, 'CFB').then(events => {
        allEvents.push(...events.map((e: any) => ({ event: e, league: 'cfb' as const })));
        console.log(`📋 Found ${events.length} total CFB events on Polymarket`);
      }));
    }
    if (ncaabTagId) {
      eventFetches.push(fetchAllEventsForTag(ncaabTagId, 'NCAAB').then(events => {
        allEvents.push(...events.map((e: any) => ({ event: e, league: 'ncaab' as const })));
        console.log(`📋 Found ${events.length} total NCAAB events on Polymarket`);
      }));
    }
    if (nbaTagId) {
      eventFetches.push(fetchAllEventsForTag(nbaTagId, 'NBA').then(events => {
        allEvents.push(...events.map((e: any) => ({ event: e, league: 'nba' as const })));
        console.log(`📋 Found ${events.length} total NBA events on Polymarket`);
      }));
    }
    
    await Promise.all(eventFetches);

    // Filter events to only include games (vs/@ pattern) - excludes props, futures, etc.
    const gameEvents = allEvents.filter((e: any) => {
      const title = e.event.title || '';
      return title.includes(' vs. ') || title.includes(' @ ');
    });
    console.log(`🔍 Filtered to ${gameEvents.length} game events (from ${allEvents.length} total events)`);

    // Step 3.5: Cache the events list for each league
    console.log('💾 Caching events list...');
    const leagueTypes: Array<'nfl' | 'cfb' | 'ncaab' | 'nba'> = ['nfl', 'cfb', 'ncaab', 'nba'];
    
    for (const league of leagueTypes) {
      const leagueEvents = gameEvents.filter(e => e.league === league).map(e => e.event);
      const tagId = league === 'nfl' ? nflTagId : 
                    league === 'cfb' ? cfbTagId : 
                    league === 'ncaab' ? ncaabTagId : 
                    nbaTagId;
      
      if (!tagId) continue;
      
      try {
        const { error: cacheError } = await supabase
          .from('polymarket_events')
          .upsert({
            league,
            tag_id: tagId,
            events: leagueEvents,
            event_count: leagueEvents.length,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'league'
          });
        
        if (cacheError) {
          console.error(`❌ Error caching ${league.toUpperCase()} events:`, cacheError);
        } else {
          console.log(`✅ Cached ${leagueEvents.length} ${league.toUpperCase()} events`);
        }
      } catch (err) {
        console.error(`❌ Error caching ${league.toUpperCase()} events:`, err);
      }
    }

    let updatedCount = 0;
    const errors: string[] = [];
    const debugInfo: any[] = [];
    
    // Track processing stats by league
    const leagueStats = {
      nfl: { total: 0, matched: 0, markets: 0 },
      cfb: { total: 0, matched: 0, markets: 0 },
      ncaab: { total: 0, matched: 0, markets: 0 },
      nba: { total: 0, matched: 0, markets: 0 }
    };

    // Pre-index league events for fast lookup (avoid re-filtering per game)
    const leagueEventsMap: Record<string, any[]> = {};
    for (const league of ['nfl', 'cfb', 'ncaab', 'nba'] as const) {
      leagueEventsMap[league] = gameEvents.filter(e => e.league === league).map(e => e.event);
    }

    // Step 4a: Match all games to events and collect market tasks (fast, in-memory)
    interface MarketTask {
      gameKey: string;
      league: string;
      away_team: string;
      home_team: string;
      marketType: string;
      tokenId: string;
      question: string;
    }
    const marketTasks: MarketTask[] = [];

    for (const game of allGames) {
      leagueStats[game.league].total++;
      const gameKey = `${game.league}_${game.away_team}_${game.home_team}`;

      const leagueEvents = leagueEventsMap[game.league] || [];
      const event = findMatchingEvent(leagueEvents, game.away_team, game.home_team, game.league);
      
      if (!event) {
        debugInfo.push({
          game: gameKey, league: game.league,
          awayTeam: game.away_team, homeTeam: game.home_team,
          awayName: getTeamName(game.away_team, game.league),
          homeName: getTeamName(game.home_team, game.league),
          matched: false
        });
        continue;
      }

      leagueStats[game.league].matched++;
      debugInfo.push({
        game: gameKey, league: game.league,
        awayTeam: game.away_team, homeTeam: game.home_team,
        matched: true, eventTitle: event.title
      });

      const markets = extractMarkets(event);
      for (const [marketType, marketData] of Object.entries(markets)) {
        if (!marketData) continue;
        marketTasks.push({
          gameKey, league: game.league,
          away_team: game.away_team, home_team: game.home_team,
          marketType, tokenId: marketData.tokenId, question: marketData.question,
        });
      }
    }

    console.log(`📊 Matched games - NFL: ${leagueStats.nfl.matched}/${leagueStats.nfl.total}, CFB: ${leagueStats.cfb.matched}/${leagueStats.cfb.total}, NCAAB: ${leagueStats.ncaab.matched}/${leagueStats.ncaab.total}, NBA: ${leagueStats.nba.matched}/${leagueStats.nba.total}`);
    console.log(`📋 Total market tasks to fetch: ${marketTasks.length}`);

    // Step 4b: Fetch price histories and upsert in parallel batches
    const BATCH_SIZE = 15; // Process 15 markets concurrently
    
    async function processMarketTask(task: MarketTask): Promise<boolean> {
      try {
        const priceUrl = `https://clob.polymarket.com/prices-history?market=${task.tokenId}&interval=max&fidelity=60`;
        const priceResponse = await fetch(priceUrl);
        
        if (!priceResponse.ok) return false;

        const priceData = await priceResponse.json();
        const history = priceData.history || [];
        if (history.length === 0) return false;

        const latest = history[history.length - 1];
        const currentAwayOdds = Math.round(latest.p * 100);
        const currentHomeOdds = 100 - currentAwayOdds;

        const { error: upsertError } = await supabase
          .from('polymarket_markets')
          .upsert({
            game_key: task.gameKey,
            league: task.league,
            away_team: task.away_team,
            home_team: task.home_team,
            market_type: task.marketType,
            price_history: history,
            current_away_odds: currentAwayOdds,
            current_home_odds: currentHomeOdds,
            token_id: task.tokenId,
            question: task.question,
            last_updated: new Date().toISOString(),
          }, { onConflict: 'game_key,market_type' });

        if (upsertError) {
          errors.push(`${task.gameKey}-${task.marketType}: ${upsertError.message}`);
          return false;
        }
        return true;
      } catch (err) {
        errors.push(`${task.gameKey}-${task.marketType}: ${err.message}`);
        return false;
      }
    }

    // Process in batches for controlled parallelism
    for (let i = 0; i < marketTasks.length; i += BATCH_SIZE) {
      const batch = marketTasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(processMarketTask));
      const batchSuccesses = results.filter(Boolean).length;
      updatedCount += batchSuccesses;
      
      // Attribute successes to league stats
      for (let j = 0; j < batch.length; j++) {
        if (results[j]) {
          leagueStats[batch[j].league as keyof typeof leagueStats].markets++;
        }
      }
      
      console.log(`⚡ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(marketTasks.length / BATCH_SIZE)}: ${batchSuccesses}/${batch.length} succeeded`);
    }

    console.log(`\n✅ Cache update complete! Updated ${updatedCount}/${marketTasks.length} markets`);
    console.log(`📊 League Stats:`, JSON.stringify(leagueStats, null, 2));
    if (errors.length > 0) {
      console.log(`⚠️ Errors: ${errors.length}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount,
        totalMarketTasks: marketTasks.length,
        games: allGames.length,
        nflGames: allGames.filter(g => g.league === 'nfl').length,
        cfbGames: allGames.filter(g => g.league === 'cfb').length,
        ncaabGames: allGames.filter(g => g.league === 'ncaab').length,
        nbaGames: allGames.filter(g => g.league === 'nba').length,
        leagueStats: leagueStats,
        errors: errors.length > 0 ? errors : undefined,
        debug: debugInfo.slice(0, 10),
        availableEvents: allEvents.slice(0, 5).map((e: any) => ({ title: e.event.title, league: e.league }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Parse teams from Polymarket title "Team A vs. Team B" or "Team A @ Team B"
function parseTeamsFromTitle(title: string): { team1: string; team2: string } | null {
  // Try "vs." first, then "@"
  let parts = title.split(' vs. ');
  if (parts.length !== 2) {
    parts = title.split(' @ ');
  }
  if (parts.length !== 2) return null;
  return { team1: parts[0].trim(), team2: parts[1].trim() };
}

// Helper: Find matching event
function findMatchingEvent(events: any[], awayTeam: string, homeTeam: string, league: 'nfl' | 'cfb' | 'nba' | 'ncaab'): any | null {
  // Replace non-alphanumeric chars with spaces (not remove them) so hyphens become word boundaries
  // e.g., "Massachusetts-Lowell" -> "massachusetts lowell" (not "massachusettslowell")
  const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Get team names for matching (mascots for NFL, full names for CFB/NCAAB/NBA)
  const awayName = getTeamName(awayTeam, league);
  const homeName = getTeamName(homeTeam, league);
  
  console.log(`🔍 Looking for ${league.toUpperCase()}: ${awayTeam} (${awayName}) vs ${homeTeam} (${homeName})`);
  
  // Check if a DB team name matches one side of a Polymarket title
  // Splits the Polymarket team side into words, checks if the DB name appears as a substring
  const teamMatchesSide = (dbTeamName: string, polymarketSide: string): boolean => {
    const dbClean = cleanName(dbTeamName);
    const sideClean = cleanName(polymarketSide);
    
    // First: try full name as substring (handles "Penn State" in "Penn State Nittany Lions")
    if (sideClean.includes(dbClean)) return true;
    
    // Second: for single-word names, check word-level match (handles "Duke" in "Duke Blue Devils")
    const dbWords = dbClean.split(/\s+/);
    if (dbWords.length === 1 && dbWords[0].length > 2) {
      const sideWords = sideClean.split(/\s+/);
      return sideWords.some(w => w === dbWords[0] || w.startsWith(dbWords[0]));
    }
    
    return false;
  };
  
  for (const event of events) {
    const title = event.title || '';
    const parsed = parseTeamsFromTitle(title);
    if (!parsed) continue;
    
    // Match each DB team against each SIDE of the title independently
    // This prevents "Penn State" matching the wrong side in "Michigan State vs Temple"
    const awayMatchesSide1 = teamMatchesSide(awayName, parsed.team1) || teamMatchesSide(awayTeam, parsed.team1);
    const homeMatchesSide2 = teamMatchesSide(homeName, parsed.team2) || teamMatchesSide(homeTeam, parsed.team2);
    const awayMatchesSide2 = teamMatchesSide(awayName, parsed.team2) || teamMatchesSide(awayTeam, parsed.team2);
    const homeMatchesSide1 = teamMatchesSide(homeName, parsed.team1) || teamMatchesSide(homeTeam, parsed.team1);
    
    // Normal order: away matches side1, home matches side2
    // Reversed order: away matches side2, home matches side1
    if ((awayMatchesSide1 && homeMatchesSide2) || (awayMatchesSide2 && homeMatchesSide1)) {
      console.log(`✅ Matched: "${title}"`);
      return event;
    }
  }
  
  console.log(`❌ No match found for ${awayTeam} vs ${homeTeam}`);
  return null;
}

// Helper: Extract markets from /events endpoint response
function extractMarkets(event: any): Record<string, { tokenId: string; question: string } | null> {
  const result: Record<string, { tokenId: string; question: string } | null> = {
    moneyline: null,
    spread: null,
    total: null,
  };

  if (!event.markets || event.markets.length === 0) {
    console.log('⚠️ No markets in event');
    return result;
  }

  console.log(`🔍 Inspecting ${event.markets.length} markets...`);

  for (const market of event.markets) {
    // /events endpoint uses 'active' and 'closed' fields
    if (market.closed || !market.active) {
      console.log(`⏭️ Skipping closed/inactive market: ${market.question}`);
      continue;
    }

    const question = (market.question || '').toLowerCase();
    const slug = (market.marketSlug || market.slug || '').toLowerCase();

    console.log(`🔎 Market: "${market.question}" | Slug: "${slug}"`);

    // Skip 1H markets
    if (question.includes('1h') || slug.includes('-1h-')) {
      console.log(`⏭️ Skipping 1H market`);
      continue;
    }

    let marketType: string | null = null;

    if (question.includes('spread') || slug.includes('-spread-')) {
      marketType = 'spread';
    } else if (question.includes('o/u') || question.includes('total') || slug.includes('-total-')) {
      marketType = 'total';
    } else if (slug.includes('-moneyline') || (!slug.includes('-total-') && !slug.includes('-spread-'))) {
      marketType = 'moneyline';
    }

    if (!marketType) {
      console.log(`⏭️ Unknown market type`);
      continue;
    }

    if (result[marketType]) {
      console.log(`⏭️ Already have ${marketType} market`);
      continue;
    }

    // Extract token ID - /events endpoint uses 'clobTokenIds' (JSON string!)
    let tokenId: string | null = null;
    
    // Try clobTokenIds first (it's a JSON string, not an array!)
    if (typeof market.clobTokenIds === 'string') {
      try {
        const arr = JSON.parse(market.clobTokenIds);
        if (Array.isArray(arr) && arr.length > 0) {
          tokenId = arr[0]; // YES token
          if (tokenId) console.log(`✅ Found clobTokenIds (parsed): ${tokenId.substring(0, 20)}...`);
        }
      } catch (e) {
        console.log(`⚠️ Failed to parse clobTokenIds: ${e.message}`);
      }
    } else if (market.clobTokenIds && Array.isArray(market.clobTokenIds) && market.clobTokenIds.length > 0) {
      // Fallback if it's already an array
      tokenId = market.clobTokenIds[0];
      if (tokenId) console.log(`✅ Found clobTokenIds[0]: ${tokenId.substring(0, 20)}...`);
    } else if (market.tokens && Array.isArray(market.tokens)) {
      // Old format fallback
      const yesToken = market.tokens.find((t: any) => (t.outcome || '').toLowerCase() === 'yes');
      tokenId = yesToken?.token_id || null;
      if (tokenId) console.log(`✅ Found token via tokens array: ${tokenId.substring(0, 20)}...`);
    }

    if (!tokenId) {
      console.log(`⚠️ No token ID found for ${marketType}`);
      continue;
    }

    console.log(`✅ Found ${marketType} token: ${tokenId.substring(0, 20)}...`);

    result[marketType] = {
      tokenId,
      question: market.question,
    };
  }

  return result;
}

