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

// Get team name for matching (NFL uses mascots, CFB uses school names)
function getTeamName(teamName: string, league: 'nfl' | 'cfb'): string {
  if (league === 'cfb') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
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

    // Step 1: Get current games for BOTH NFL and CFB
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch NFL games
    const { data: nflLines, error: nflError } = await cfbSupabase
      .from('nfl_betting_lines')
      .select('away_team, home_team, game_date, training_key')
      .gte('game_date', today);

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

    // Combine and tag with league
    const allGames: Array<{ away_team: string; home_team: string; league: 'nfl' | 'cfb'; training_key?: string }> = [];
    
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

    if (allGames.length === 0) {
      console.log('No games found to update');
      return new Response(
        JSON.stringify({ success: true, message: 'No games to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${allGames.length} games to update (${nflLines?.length || 0} NFL, ${cfbGames?.length || 0} CFB)`);

    // Step 2: Fetch sports metadata to get tag IDs for both leagues
    const sportsResponse = await fetch('https://gamma-api.polymarket.com/sports', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-PolymarketCache/1.0'
      }
    });

    if (!sportsResponse.ok) {
      throw new Error('Failed to fetch sports metadata');
    }

    const sportsList = await sportsResponse.json();
    
    // Get NFL tag
    const nflSport = sportsList.find((s: any) => s.sport?.toLowerCase() === 'nfl');
    const nflTagCandidates = nflSport?.tags.split(',').map((t: string) => t.trim()).filter(Boolean) || [];
    const nflTagId = nflTagCandidates.find((t: string) => t !== '1') || nflTagCandidates[0];

    // Get CFB tag
    const cfbSport = sportsList.find((s: any) => s.sport?.toLowerCase() === 'cfb');
    const cfbTagCandidates = cfbSport?.tags.split(',').map((t: string) => t.trim()).filter(Boolean) || [];
    const cfbTagId = cfbTagCandidates.find((t: string) => t !== '1') || cfbTagCandidates[0];

    console.log(`🏈 NFL tag ID: ${nflTagId}, 🏈 CFB tag ID: ${cfbTagId}`);

    // Step 3: Fetch events for both leagues
    const allEvents: Array<{ event: any; league: 'nfl' | 'cfb' }> = [];

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

    let updatedCount = 0;
    const errors: string[] = [];
    const debugInfo: any[] = [];

    // Step 4: Process each game
    for (const game of allGames) {
      try {
        const gameKey = `${game.league}_${game.away_team}_${game.home_team}`;
        console.log(`\n🔍 Processing ${game.league.toUpperCase()}: ${game.away_team} vs ${game.home_team}`);

        // Find matching event (filter by league)
        const leagueEvents = allEvents.filter(e => e.league === game.league).map(e => e.event);
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
function findMatchingEvent(events: any[], awayTeam: string, homeTeam: string, league: 'nfl' | 'cfb'): any | null {
  const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  // Get team names for matching (mascots for NFL, school names for CFB)
  const awayName = getTeamName(awayTeam, league);
  const homeName = getTeamName(homeTeam, league);
  
  console.log(`🔍 Looking for ${league.toUpperCase()}: ${awayTeam} (${awayName}) vs ${homeTeam} (${homeName})`);
  
  for (const event of events) {
    const title = event.title || '';
    const titleClean = cleanName(title);
    const awayClean = cleanName(awayName);
    const homeClean = cleanName(homeName);
    
    // Match using team names
    if (titleClean.includes(awayClean) && titleClean.includes(homeClean)) {
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
          console.log(`✅ Found clobTokenIds (parsed): ${tokenId.substring(0, 20)}...`);
        }
      } catch (e) {
        console.log(`⚠️ Failed to parse clobTokenIds: ${e.message}`);
      }
    } else if (market.clobTokenIds && Array.isArray(market.clobTokenIds) && market.clobTokenIds.length > 0) {
      // Fallback if it's already an array
      tokenId = market.clobTokenIds[0];
      console.log(`✅ Found clobTokenIds[0]: ${tokenId.substring(0, 20)}...`);
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

