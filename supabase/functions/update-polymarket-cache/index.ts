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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting Polymarket cache update...');

    // Step 1: Get current NFL games from predictions table
    const { data: predictions, error: predError } = await supabase
      .from('nfl_predictions_latest')
      .select('away_team, home_team')
      .order('game_date', { ascending: true })
      .limit(20); // Limit to current week's games

    if (predError) {
      console.error('Error fetching predictions:', predError);
      throw predError;
    }

    if (!predictions || predictions.length === 0) {
      console.log('No games found to update');
      return new Response(
        JSON.stringify({ success: true, message: 'No games to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${predictions.length} games to update`);

    // Step 2: Fetch sports metadata to get NFL tag ID
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
    const nflSport = sportsList.find((s: any) => s.sport?.toLowerCase() === 'nfl');
    
    if (!nflSport) {
      throw new Error('NFL sport not found');
    }

    const tagCandidates = nflSport.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    const nflTagId = tagCandidates.find((t: string) => t !== '1') || tagCandidates[0];

    console.log(`🏈 NFL tag ID: ${nflTagId}`);

    // Step 3: Fetch all NFL events
    const eventsUrl = `https://gamma-api.polymarket.com/events?tag_id=${nflTagId}&closed=false&limit=100&related_tags=true`;
    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-PolymarketCache/1.0'
      }
    });

    if (!eventsResponse.ok) {
      throw new Error('Failed to fetch events');
    }

    const eventsData = await eventsResponse.json();
    const events = Array.isArray(eventsData) ? eventsData : (eventsData.events || eventsData.data || []);

    console.log(`📋 Found ${events.length} NFL events on Polymarket`);

    let updatedCount = 0;
    const errors: string[] = [];

    // Step 4: Process each game
    for (const game of predictions) {
      try {
        const gameKey = `${game.away_team}_${game.home_team}`;
        console.log(`\n🔍 Processing: ${gameKey}`);

        // Find matching event
        const event = findMatchingEvent(events, game.away_team, game.home_team);
        
        if (!event) {
          console.log(`⚠️ No Polymarket event found for ${gameKey}`);
          continue;
        }

        console.log(`✅ Found event: ${event.title}`);

        // Extract all market types
        const markets = extractMarkets(event);

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
        games: predictions.length,
        errors: errors.length > 0 ? errors : undefined
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
function findMatchingEvent(events: any[], awayTeam: string, homeTeam: string): any | null {
  const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  for (const event of events) {
    const title = event.title || '';
    const titleClean = cleanName(title);
    const awayClean = cleanName(awayTeam);
    const homeClean = cleanName(homeTeam);
    
    if (titleClean.includes(awayClean) && titleClean.includes(homeClean)) {
      return event;
    }
  }
  return null;
}

// Helper: Extract markets
function extractMarkets(event: any): Record<string, { tokenId: string; question: string } | null> {
  const result: Record<string, { tokenId: string; question: string } | null> = {
    moneyline: null,
    spread: null,
    total: null,
  };

  if (!event.markets || event.markets.length === 0) {
    return result;
  }

  for (const market of event.markets) {
    if (!market.active || market.closed) continue;

    const question = (market.question || '').toLowerCase();
    const slug = (market.slug || '').toLowerCase();

    // Skip 1H markets
    if (question.includes('1h') || slug.includes('-1h-')) continue;

    let marketType: string | null = null;

    if (question.includes('spread') || slug.includes('-spread-')) {
      marketType = 'spread';
    } else if (question.includes('o/u') || question.includes('total') || slug.includes('-total-')) {
      marketType = 'total';
    } else if (slug.includes('-moneyline') || (!slug.includes('-total-') && !slug.includes('-spread-'))) {
      marketType = 'moneyline';
    }

    if (!marketType || result[marketType]) continue;

    // Extract token ID
    let tokenId: string | null = null;
    if (market.tokens && Array.isArray(market.tokens)) {
      const yesToken = market.tokens.find((t: any) => (t.outcome || '').toLowerCase() === 'yes');
      tokenId = yesToken?.token_id || null;
    }

    if (!tokenId) continue;

    result[marketType] = {
      tokenId,
      question: market.question,
    };
  }

  return result;
}

