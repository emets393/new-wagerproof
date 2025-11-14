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
  if (league === 'cfb' || league === 'ncaab') {
    // CFB/NCAAB: Use school name as-is, matching will handle mascot variations
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

    if (nflTagId) {
      const nflEventsUrl = `https://gamma-api.polymarket.com/events?tag_id=${nflTagId}&closed=false&limit=100&related_tags=true`;
      const nflEventsResponse = await fetch(nflEventsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketCache/1.0'
        }
      });

      if (nflEventsResponse.ok) {
        const nflEventsData = await nflEventsResponse.json();
        const nflEvents = Array.isArray(nflEventsData) ? nflEventsData : (nflEventsData.events || nflEventsData.data || []);
        allEvents.push(...nflEvents.map((e: any) => ({ event: e, league: 'nfl' as const })));
        console.log(`📋 Found ${nflEvents.length} NFL events on Polymarket`);
      }
    }

    if (cfbTagId) {
      const cfbEventsUrl = `https://gamma-api.polymarket.com/events?tag_id=${cfbTagId}&closed=false&limit=100&related_tags=true`;
      const cfbEventsResponse = await fetch(cfbEventsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketCache/1.0'
        }
      });

      if (cfbEventsResponse.ok) {
        const cfbEventsData = await cfbEventsResponse.json();
        const cfbEvents = Array.isArray(cfbEventsData) ? cfbEventsData : (cfbEventsData.events || cfbEventsData.data || []);
        allEvents.push(...cfbEvents.map((e: any) => ({ event: e, league: 'cfb' as const })));
        console.log(`📋 Found ${cfbEvents.length} CFB events on Polymarket`);
      }
    }

    if (ncaabTagId) {
      const ncaabEventsUrl = `https://gamma-api.polymarket.com/events?tag_id=${ncaabTagId}&closed=false&limit=100&related_tags=true`;
      const ncaabEventsResponse = await fetch(ncaabEventsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketCache/1.0'
        }
      });

      if (ncaabEventsResponse.ok) {
        const ncaabEventsData = await ncaabEventsResponse.json();
        const ncaabEvents = Array.isArray(ncaabEventsData) ? ncaabEventsData : (ncaabEventsData.events || ncaabEventsData.data || []);
        allEvents.push(...ncaabEvents.map((e: any) => ({ event: e, league: 'ncaab' as const })));
        console.log(`📋 Found ${ncaabEvents.length} NCAAB events on Polymarket`);
      }
    }

    if (nbaTagId) {
      const nbaEventsUrl = `https://gamma-api.polymarket.com/events?tag_id=${nbaTagId}&closed=false&limit=100&related_tags=true`;
      const nbaEventsResponse = await fetch(nbaEventsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketCache/1.0'
        }
      });

      if (nbaEventsResponse.ok) {
        const nbaEventsData = await nbaEventsResponse.json();
        const nbaEvents = Array.isArray(nbaEventsData) ? nbaEventsData : (nbaEventsData.events || nbaEventsData.data || []);
        allEvents.push(...nbaEvents.map((e: any) => ({ event: e, league: 'nba' as const })));
        console.log(`📋 Found ${nbaEvents.length} NBA events on Polymarket`);
      }
    }

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

    // Step 4: Process each game
    for (const game of allGames) {
      leagueStats[game.league].total++;
      try {
        const gameKey = `${game.league}_${game.away_team}_${game.home_team}`;
        console.log(`\n🔍 Processing ${game.league.toUpperCase()}: ${game.away_team} vs ${game.home_team}`);

        // Find matching event (filter by league and only game events)
        const leagueEvents = gameEvents.filter(e => e.league === game.league).map(e => e.event);
        const event = findMatchingEvent(leagueEvents, game.away_team, game.home_team, game.league);
        
        if (!event) {
          console.log(`⚠️ No Polymarket event found for ${gameKey}`);
          debugInfo.push({
            game: gameKey,
            league: game.league,
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            awayName: getTeamName(game.away_team, game.league),
            homeName: getTeamName(game.home_team, game.league),
            matched: false
          });
          continue;
        }

        leagueStats[game.league].matched++;
        debugInfo.push({
          game: gameKey,
          league: game.league,
          awayTeam: game.away_team,
          homeTeam: game.home_team,
          matched: true,
          eventTitle: event.title
        });

        console.log(`✅ Found event: ${event.title}`);
        console.log(`📊 Event has ${event.markets?.length || 0} markets`);

        // Extract all market types
        const markets = extractMarkets(event);
        console.log(`📋 Extracted markets:`, JSON.stringify(markets, null, 2));

        // Fetch and store data for each market type
        for (const [marketType, marketData] of Object.entries(markets)) {
          if (!marketData) continue;

          try {
            // Fetch price history
            const priceUrl = `https://clob.polymarket.com/prices-history?market=${marketData.tokenId}&interval=max&fidelity=60`;
            const priceResponse = await fetch(priceUrl);
            
            if (!priceResponse.ok) {
              console.log(`⚠️ Failed to fetch ${marketType} price history`);
              continue;
            }

            const priceData = await priceResponse.json();
            const history = priceData.history || [];

            if (history.length === 0) {
              console.log(`⚠️ No price history for ${marketType}`);
              continue;
            }

            // Calculate current odds
            const latest = history[history.length - 1];
            const currentAwayOdds = Math.round(latest.p * 100);
            const currentHomeOdds = 100 - currentAwayOdds;

            // Upsert to database
            const { error: upsertError } = await supabase
              .from('polymarket_markets')
              .upsert({
                game_key: gameKey,
                league: game.league,
                away_team: game.away_team,
                home_team: game.home_team,
                market_type: marketType,
                price_history: history,
                current_away_odds: currentAwayOdds,
                current_home_odds: currentHomeOdds,
                token_id: marketData.tokenId,
                question: marketData.question,
                last_updated: new Date().toISOString(),
              }, {
                onConflict: 'game_key,market_type'
              });

            if (upsertError) {
              console.error(`❌ Error upserting ${marketType}:`, upsertError);
              errors.push(`${gameKey}-${marketType}: ${upsertError.message}`);
            } else {
              console.log(`✅ Updated ${marketType}: ${currentAwayOdds}% - ${currentHomeOdds}%`);
              updatedCount++;
              leagueStats[game.league].markets++;
            }
          } catch (err) {
            console.error(`❌ Error processing ${marketType}:`, err);
            errors.push(`${gameKey}-${marketType}: ${err.message}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing game ${game.away_team} vs ${game.home_team}:`, err);
        errors.push(`${game.away_team}_${game.home_team}: ${err.message}`);
      }
    }

    console.log(`\n✅ Cache update complete! Updated ${updatedCount} markets`);
    console.log(`📊 League Stats:`, JSON.stringify(leagueStats, null, 2));
    if (errors.length > 0) {
      console.log(`⚠️ Errors: ${errors.length}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount,
        games: allGames.length,
        nflGames: allGames.filter(g => g.league === 'nfl').length,
        cfbGames: allGames.filter(g => g.league === 'cfb').length,
        ncaabGames: allGames.filter(g => g.league === 'ncaab').length,
        nbaGames: allGames.filter(g => g.league === 'nba').length,
        leagueStats: leagueStats,
        errors: errors.length > 0 ? errors : undefined,
        debug: debugInfo.slice(0, 10), // First 10 games for debugging
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

// Helper: Find matching event
function findMatchingEvent(events: any[], awayTeam: string, homeTeam: string, league: 'nfl' | 'cfb' | 'nba' | 'ncaab'): any | null {
  const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  // Get team names for matching (mascots for NFL, full names for CFB/NCAAB/NBA)
  const awayName = getTeamName(awayTeam, league);
  const homeName = getTeamName(homeTeam, league);
  
  console.log(`🔍 Looking for ${league.toUpperCase()}: ${awayTeam} (${awayName}) vs ${homeTeam} (${homeName})`);
  
  // Extract key words from team names for flexible matching
  const getKeyWords = (name: string, isNcaab: boolean = false): string[] => {
    const cleaned = cleanName(name);
    const words = cleaned.split(/\s+/).filter(w => w.length > 2); // Filter out short words like "LA"
    
    // For NCAAB, database has "Duke" but Polymarket has "Duke Blue Devils"
    // We need to match on just the school name
    if (isNcaab) {
      // Return individual words and the full cleaned name
      return [cleaned, ...words];
    }
    
    // For NBA/NFL, also include the last word (usually the mascot: "Hornets", "Bucks", etc.)
    if (words.length > 1) {
      return [cleaned, words[words.length - 1], words.join(' ')];
    }
    return [cleaned];
  };
  
  const isNcaab = league === 'ncaab';
  const awayKeywords = getKeyWords(awayName, isNcaab);
  const homeKeywords = getKeyWords(homeName, isNcaab);
  
  console.log(`  Away keywords: [${awayKeywords.join(', ')}]`);
  console.log(`  Home keywords: [${homeKeywords.join(', ')}]`);
  
  for (const event of events) {
    const title = event.title || '';
    const titleClean = cleanName(title);
    
    // For NCAAB, use word-based matching (any word from school name matches)
    // For others, require full keyword match
    let awayMatch = false;
    let homeMatch = false;
    
    if (isNcaab) {
      // NCAAB: Match if any word from school name appears in title
      // e.g., "Duke" matches "Duke Blue Devils"
      awayMatch = awayKeywords.some(keyword => {
        // For single-word schools, match as word boundary
        const words = titleClean.split(/\s+/);
        return words.some(w => w === keyword || w.startsWith(keyword));
      });
      homeMatch = homeKeywords.some(keyword => {
        const words = titleClean.split(/\s+/);
        return words.some(w => w === keyword || w.startsWith(keyword));
      });
    } else {
      // NBA/NFL/CFB: Standard keyword matching
      awayMatch = awayKeywords.some(keyword => titleClean.includes(keyword));
      homeMatch = homeKeywords.some(keyword => titleClean.includes(keyword));
    }
    
    // Also check reversed (sometimes Polymarket lists home team first)
    let awayMatchReversed = false;
    let homeMatchReversed = false;
    
    if (isNcaab) {
      awayMatchReversed = homeKeywords.some(keyword => {
        const words = titleClean.split(/\s+/);
        return words.some(w => w === keyword || w.startsWith(keyword));
      });
      homeMatchReversed = awayKeywords.some(keyword => {
        const words = titleClean.split(/\s+/);
        return words.some(w => w === keyword || w.startsWith(keyword));
      });
    } else {
      awayMatchReversed = homeKeywords.some(keyword => titleClean.includes(keyword));
      homeMatchReversed = awayKeywords.some(keyword => titleClean.includes(keyword));
    }
    
    if ((awayMatch && homeMatch) || (awayMatchReversed && homeMatchReversed)) {
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

