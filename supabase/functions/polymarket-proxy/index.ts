import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolymarketRequest {
  action: 'search' | 'price-history' | 'sports' | 'events' | 'teams';
  query?: string;
  tokenId?: string;
  interval?: string;
  fidelity?: number;
  sport?: string;
  tagId?: string;
  league?: string;
  limit?: number;
  offset?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, tokenId, interval, fidelity, sport, tagId, league, limit, offset }: PolymarketRequest = await req.json();

    console.log('Polymarket proxy request:', { action, query, tokenId, interval, sport, tagId });

    // Search markets via Gamma API
    if (action === 'search') {
      if (!query) {
        return new Response(
          JSON.stringify({ error: 'Query parameter required for search' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 1: Fetch sports-tagged markets (not generic markets)
      // Try multiple approaches to get NFL markets specifically
      const urls = [
        'https://gamma-api.polymarket.com/markets?closed=false&active=true&tag=Sports',
        'https://gamma-api.polymarket.com/markets?closed=false&active=true&tag=NFL',
        'https://gamma-api.polymarket.com/events?closed=false&active=true',
      ];

      let sportsMarkets: any[] = [];

      for (const url of urls) {
        try {
          console.log('Fetching sports markets from:', url);
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            const markets = Array.isArray(data) ? data : (data.data || data.markets || []);
            
            if (markets.length > 0) {
              sportsMarkets = markets;
              console.log(`✅ Got ${markets.length} markets from ${url}`);
              break;
            }
          }
        } catch (err) {
          console.error('Error fetching from', url, err);
        }
      }

      // Fallback: fetch large set and filter by tags
      if (sportsMarkets.length === 0) {
        console.log('Trying fallback: fetch all and filter by sports tags');
        const fallbackUrl = 'https://gamma-api.polymarket.com/markets?limit=1000&closed=false&active=true';
        try {
          const response = await fetch(fallbackUrl);
          if (response.ok) {
            const allMarkets = await response.json();
            // Filter for sports-related tags
            sportsMarkets = (allMarkets || []).filter((m: any) => {
              const tags = (m.tags || []).map((t: string) => t.toLowerCase());
              return tags.some((t: string) => 
                ['sports', 'nfl', 'football', 'nba', 'mlb'].includes(t)
              );
            });
            console.log(`Filtered to ${sportsMarkets.length} sports markets`);
          }
        } catch (err) {
          console.error('Fallback fetch error:', err);
        }
      }

      // Step 2: Parse query (team names)
      const queryTerms = query.toLowerCase().split(/\s+/);
      console.log('Searching for teams:', queryTerms);

      // Step 3: Match against "Will Team A beat Team B?" format
      const matchedMarkets = sportsMarkets.filter((market: any) => {
        const question = (market.question || market.title || '').toLowerCase();
        
        // Polymarket format: "Will the [Team A] beat the [Team B] on [Date]?"
        // We need to check if ALL our query terms appear in the question
        const matchesAllTerms = queryTerms.every((term: string) => question.includes(term));
        
        if (matchesAllTerms) {
          console.log('✅ Matched market:', market.question || market.title);
        }
        
        return matchesAllTerms;
      });

      console.log(`Found ${matchedMarkets.length} markets matching "${query}"`);

      return new Response(
        JSON.stringify({ markets: matchedMarkets }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get price history via CLOB API
    if (action === 'price-history') {
      if (!tokenId) {
        return new Response(
          JSON.stringify({ error: 'tokenId parameter required for price-history' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const params = new URLSearchParams({
        market: tokenId,
        interval: interval || 'max',
        fidelity: String(fidelity || 60),
      });

      const url = `https://clob.polymarket.com/prices-history?${params.toString()}`;
      console.log('Fetching price history:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Price history API error:', response.status, response.statusText);
        return new Response(
          JSON.stringify({ error: `Price history API returned ${response.status}`, history: [] }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log('Price history returned:', data?.history?.length || 0, 'points');

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sports metadata (tag IDs, series IDs)
    if (action === 'sports') {
      const url = 'https://gamma-api.polymarket.com/sports';
      console.log('Fetching sports metadata:', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketIntegration/1.0'
        }
      });

      if (!response.ok) {
        console.error('Sports API error:', response.status, response.statusText);
        return new Response(
          JSON.stringify({ error: `Sports API returned ${response.status}`, sports: [] }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log('Sports metadata returned:', Array.isArray(data) ? data.length : 0, 'sports');

      return new Response(
        JSON.stringify({ sports: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get events for a specific sport/tag
    if (action === 'events') {
      if (!tagId) {
        return new Response(
          JSON.stringify({ error: 'tagId parameter required for events' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const params = new URLSearchParams({
        tag_id: tagId,
        closed: 'false',
        limit: '100',
        related_tags: 'true',
      });

      const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;
      console.log('Fetching events:', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketIntegration/1.0'
        }
      });

      if (!response.ok) {
        console.error('Events API error:', response.status, response.statusText);
        return new Response(
          JSON.stringify({ error: `Events API returned ${response.status}`, events: [] }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const events = Array.isArray(data) ? data : (data.events || data.data || []);
      console.log('Events returned:', events.length, 'events');

      return new Response(
        JSON.stringify({ events }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get teams for a specific league
    if (action === 'teams') {
      if (!league) {
        return new Response(
          JSON.stringify({ error: 'league parameter required for teams' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const params = new URLSearchParams({
        league: league,
        limit: String(limit || 100),
        offset: String(offset || 0),
      });

      const url = `https://gamma-api.polymarket.com/teams?${params.toString()}`;
      console.log('Fetching teams:', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-PolymarketIntegration/1.0'
        }
      });

      if (!response.ok) {
        console.error('Teams API error:', response.status, response.statusText);
        return new Response(
          JSON.stringify({ error: `Teams API returned ${response.status}`, teams: [] }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const teams = Array.isArray(data) ? data : (data.teams || data.data || []);
      console.log('Teams returned:', teams.length, 'teams');

      return new Response(
        JSON.stringify({ teams }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "search", "price-history", "sports", "events", or "teams"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Polymarket proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

