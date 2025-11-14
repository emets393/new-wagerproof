import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { VALUE_FINDS_SCHEMA } from './schema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PageLevelRequest {
  sport_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  analysis_date?: string; // YYYY-MM-DD, defaults to today
  user_id?: string; // Admin who triggered it
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the college football supabase URL and key from edge function secrets
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const cfbClient = createClient(cfbSupabaseUrl, cfbSupabaseKey);

    const { sport_type, analysis_date, user_id }: PageLevelRequest = await req.json();

    const targetDate = analysis_date || new Date().toISOString().split('T')[0];

    console.log(`Generating page-level analysis for ${sport_type} on ${targetDate}`);

    // Get system prompt and auto_publish from schedule config
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('ai_page_level_schedules')
      .select('system_prompt, auto_publish')
      .eq('sport_type', sport_type)
      .single();

    if (scheduleError || !schedule) {
      throw new Error(`No schedule config found for ${sport_type}`);
    }

    const shouldAutoPublish = schedule.auto_publish || false;

    // Fetch games for the date
    let games: any[] = [];
    
    if (sport_type === 'nfl') {
      // Get latest run_id
      const { data: latestRun } = await cfbClient
        .from('nfl_predictions_epa')
        .select('run_id')
        .order('run_id', { ascending: false })
        .limit(1)
        .single();

      if (latestRun) {
        // Get all games for this run_id (don't filter by date - analyze all current games on the page)
        const { data: nflGames } = await cfbClient
          .from('nfl_predictions_epa')
          .select('*')
          .eq('run_id', latestRun.run_id);

        games = nflGames || [];
      }
    } else if (sport_type === 'cfb') {
      const { data: cfbGames } = await cfbClient
        .from('cfb_live_weekly_inputs')
        .select('*');

      games = cfbGames || [];
    } else if (sport_type === 'nba') {
      const { data: nbaGames } = await cfbClient
        .from('nba_input_values_view')
        .select('*')
        .gte('game_date', targetDate)
        .lte('game_date', targetDate);

      games = nbaGames || [];
    } else if (sport_type === 'ncaab') {
      const { data: ncaabGames } = await cfbClient
        .from('v_cbb_input_values')
        .select('*')
        .gte('game_date_et', targetDate)
        .lte('game_date_et', targetDate);

      games = ncaabGames || [];
    }

    console.log(`Found ${games.length} games for ${sport_type} on ${targetDate}`);

    if (games.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No games found for the specified date',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch completions for all games
    const gameIds = games.map(g => {
      if (sport_type === 'nba' || sport_type === 'ncaab') {
        return String(g.game_id);
      }
      return g.training_key || g.unique_id || `${g.away_team}_${g.home_team}`;
    });
    
    const { data: completions } = await supabaseClient
      .from('ai_completions')
      .select('*')
      .in('game_id', gameIds)
      .eq('sport_type', sport_type);

    console.log(`Found ${completions?.length || 0} completions`);

    // Fetch Polymarket data for all games from cache
    const polymarketCache = new Map<string, any>();
    
    for (const game of games) {
      const gameKey = `${sport_type}_${game.away_team}_${game.home_team}`;
      
      const { data: polymarketData } = await supabaseClient
        .from('polymarket_markets')
        .select('*')
        .eq('game_key', gameKey)
        .eq('league', sport_type);
      
      if (polymarketData && polymarketData.length > 0) {
        // Organize by market type - format to match individual card payloads
        const marketsByType: any = {};
        for (const market of polymarketData) {
          if (market.market_type === 'total') {
            // For totals, use over_odds and under_odds instead of away/home
            marketsByType.total = {
              over_odds: market.current_away_odds,  // Away = Over
              under_odds: market.current_home_odds,  // Home = Under
            };
          } else {
            // For moneyline and spread, use away_odds and home_odds
            marketsByType[market.market_type] = {
              away_odds: market.current_away_odds,
              home_odds: market.current_home_odds,
            };
          }
        }
        polymarketCache.set(gameKey, marketsByType);
        console.log(`✅ Found Polymarket data for ${game.away_team} @ ${game.home_team}`);
      } else {
        console.log(`⚠️ No Polymarket data for ${game.away_team} @ ${game.home_team}`);
      }
    }

    console.log(`Fetched Polymarket data for ${polymarketCache.size} games`);

    // Build comprehensive payload
    const gamesWithCompletions = games.map(game => {
      const gameId = sport_type === 'nba' || sport_type === 'ncaab' 
        ? String(game.game_id)
        : (game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`);
      const gameCompletions = completions?.filter(c => c.game_id === gameId) || [];
      const gameKey = `${sport_type}_${game.away_team}_${game.home_team}`;
      const polymarketData = polymarketCache.get(gameKey);

      let gameData;
      if (sport_type === 'nfl') {
        gameData = buildNFLGameData(game, polymarketData);
      } else if (sport_type === 'cfb') {
        gameData = buildCFBGameData(game, polymarketData);
      } else if (sport_type === 'nba') {
        gameData = buildNBAGameData(game, polymarketData);
      } else {
        gameData = buildNCAABGameData(game, polymarketData);
      }

      return {
        game_id: gameId,
        matchup: `${game.away_team} @ ${game.home_team}`,
        game_data: gameData,
        completions: gameCompletions.reduce((acc, comp) => {
          acc[comp.widget_type] = comp.completion_text;
          return acc;
        }, {} as Record<string, string>),
      };
    });

    const userPrompt = JSON.stringify({
      sport: sport_type.toUpperCase(),
      date: targetDate,
      games: gamesWithCompletions,
      instructions: 'Analyze all games and identify value opportunities where there are mismatches between model predictions, Vegas lines, public betting, and Polymarket odds. Focus on games where the data suggests an edge.',
    }, null, 2);

    console.log('Calling OpenAI Chat Completions API with Structured Outputs...');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: schedule.system_prompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "value_finds_analysis",
            strict: true,
            schema: VALUE_FINDS_SCHEMA
          }
        }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI page-level analysis received');
    
    // Chat Completions API with Structured Outputs returns: { choices: [{ message: { content: "..." } }] }
    if (!openaiData.choices || !openaiData.choices[0]) {
      throw new Error('Invalid response structure from OpenAI - no choices');
    }
    
    const messageContent = openaiData.choices[0].message.content;
    if (!messageContent) {
      throw new Error('No content in OpenAI response');
    }
    
    console.log('Analysis content received, length:', messageContent.length);

    // Parse the JSON (Structured Outputs guarantees valid JSON matching our schema)
    const analysisJson = JSON.parse(messageContent);

    console.log('Parsed analysis JSON keys:', Object.keys(analysisJson));
    console.log('High value badges count:', analysisJson.high_value_badges?.length || 0);
    console.log('Page header compact picks count:', analysisJson.page_header?.compact_picks?.length || 0);
    console.log('Editor cards count:', analysisJson.editor_cards?.length || 0);
    console.log('Total games analyzed:', analysisJson.total_games_analyzed);
    
    // Debug: Log the actual data structures
    if (analysisJson.high_value_badges?.length > 0) {
      console.log('First badge:', JSON.stringify(analysisJson.high_value_badges[0]));
    }
    if (analysisJson.editor_cards?.length > 0) {
      console.log('First editor card:', JSON.stringify(analysisJson.editor_cards[0]));
    } else {
      console.log('WARNING: No editor cards generated!');
      console.log('Full analysis JSON:', JSON.stringify(analysisJson, null, 2));
    }

    // Store all three outputs in database
    const { data: insertedData, error: insertError } = await supabaseClient
      .from('ai_value_finds')
      .insert({
        sport_type,
        analysis_date: targetDate,
        high_value_badges: analysisJson.high_value_badges,
        page_header_data: analysisJson.page_header,
        editor_cards: analysisJson.editor_cards,
        value_picks: analysisJson.editor_cards, // Keep for backward compatibility
        analysis_json: analysisJson,
        summary_text: analysisJson.page_header.summary_text,
        generated_by: user_id || null,
        generated_at: new Date().toISOString(),
        published: shouldAutoPublish, // Auto-publish if enabled in schedule
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error storing value finds:', insertError);
      throw insertError;
    }

    // If auto-publish is enabled, the value find is already published
    if (shouldAutoPublish && insertedData) {
      console.log(`Auto-published value finds for ${sport_type} (ID: ${insertedData.id})`);
    }

    // Update last_run_at in schedule
    await supabaseClient
      .from('ai_page_level_schedules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('sport_type', sport_type);

    console.log(`Value finds analysis complete. High Value Badges: ${analysisJson.high_value_badges.length}, Editor Cards: ${analysisJson.editor_cards.length}`);

    // Note: Discord posting now happens when admin manually publishes (not automatic)
    // This allows review before public distribution

    return new Response(
      JSON.stringify({
        success: true,
        sport_type,
        analysis_date: targetDate,
        high_value_badges: analysisJson.high_value_badges,
        page_header: analysisJson.page_header,
        editor_cards: analysisJson.editor_cards,
        total_games_analyzed: analysisJson.total_games_analyzed,
        tokens_used: openaiData.usage?.total_tokens || 0,
        published: shouldAutoPublish, // Auto-published if enabled
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-page-level-analysis:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.constructor.name,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildNFLGameData(game: any, polymarketData?: any): any {
  return {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date,
      game_time: game.game_time || '00:00:00',
    },
    vegas_lines: {
      home_spread: game.home_spread,
      away_spread: game.away_spread,
      home_ml: game.home_ml,
      away_ml: game.away_ml,
      over_line: game.over_line,
    },
    weather: {
      temperature: game.temperature,
      wind_speed: game.wind_speed,
      precipitation: game.precipitation,
      icon: game.icon,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    polymarket: polymarketData || null,
    predictions: {
      spread_cover_prob: game.home_away_spread_cover_prob,
      spread_line: game.home_spread,
      predicted_team: (game.home_away_spread_cover_prob || 0) > 0.5 ? 'home' : 'away',
      confidence_level: (game.home_away_spread_cover_prob || 0) <= 0.58 ? 'low' : (game.home_away_spread_cover_prob || 0) <= 0.65 ? 'moderate' : 'high',
      ml_prob: game.home_away_ml_prob,
      ou_prob: game.ou_result_prob,
    },
  };
}

function buildCFBGameData(game: any, polymarketData?: any): any {
  const spreadProb = game.pred_spread_proba || game.home_away_spread_cover_prob;
  const homeSpread = game.api_spread || game.home_spread;

  return {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date || game.start_date,
      game_time: game.game_time || game.start_time || '00:00:00',
    },
    vegas_lines: {
      home_spread: homeSpread,
      away_spread: game.api_spread ? -game.api_spread : game.away_spread,
      home_ml: game.home_moneyline || game.home_ml,
      away_ml: game.away_moneyline || game.away_ml,
      over_line: game.api_over_line || game.total_line,
    },
    weather: {
      temperature: game.weather_temp_f || game.temperature,
      wind_speed: game.weather_windspeed_mph || game.wind_speed,
      precipitation: game.precipitation,
      icon: game.weather_icon_text || game.icon_code,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    polymarket: polymarketData || null,
    predictions: {
      spread_cover_prob: spreadProb,
      spread_line: homeSpread,
      predicted_team: (spreadProb || 0) > 0.5 ? 'home' : 'away',
      confidence_level: (spreadProb || 0) <= 0.58 ? 'low' : (spreadProb || 0) <= 0.65 ? 'moderate' : 'high',
      ml_prob: game.pred_ml_proba || game.home_away_ml_prob,
      ou_prob: game.pred_total_proba || game.ou_result_prob,
    },
  };
}

function buildNBAGameData(game: any, polymarketData?: any): any {
  // Calculate away moneyline from home moneyline
  const homeML = game.home_moneyline;
  let awayML = null;
  if (homeML) {
    awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
  }

  return {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date,
      game_time: game.tipoff_time_et,
    },
    vegas_lines: {
      home_spread: game.home_spread,
      away_spread: game.home_spread ? -game.home_spread : null,
      home_ml: homeML,
      away_ml: awayML,
      over_line: game.total_line,
    },
    team_stats: {
      home_pace: game.home_adj_pace,
      away_pace: game.away_adj_pace,
      home_offense: game.home_adj_offense,
      away_offense: game.away_adj_offense,
      home_defense: game.home_adj_defense,
      away_defense: game.away_adj_defense,
    },
    trends: {
      home_ats_pct: game.home_ats_pct,
      away_ats_pct: game.away_ats_pct,
      home_over_pct: game.home_over_pct,
      away_over_pct: game.away_over_pct,
    },
    polymarket: polymarketData || null,
    predictions: {
      note: 'Analysis based on team stats and trends',
    },
  };
}

function buildNCAABGameData(game: any, polymarketData?: any): any {
  return {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date_et,
      game_time: game.start_utc || game.tipoff_time_et,
      conference_game: game.conference_game,
      neutral_site: game.neutral_site,
    },
    vegas_lines: {
      home_spread: game.spread,
      away_spread: game.spread ? -game.spread : null,
      home_ml: game.homeMoneyline,
      away_ml: game.awayMoneyline,
      over_line: game.over_under,
    },
    team_stats: {
      home_pace: game.home_adj_pace,
      away_pace: game.away_adj_pace,
      home_offense: game.home_adj_offense,
      away_offense: game.away_adj_offense,
      home_defense: game.home_adj_defense,
      away_defense: game.away_adj_defense,
      home_ranking: game.home_ranking,
      away_ranking: game.away_ranking,
    },
    polymarket: polymarketData || null,
    predictions: {
      note: 'Analysis based on team stats and trends',
    },
  };
}

async function postToDiscord(
  webhookUrl: string,
  sportType: string,
  valuePicks: any[],
  summary: string,
  date: string
): Promise<void> {
  const sportEmojis: Record<string, string> = {
    nfl: '🏈',
    cfb: '🏈',
    nba: '🏀',
    ncaab: '🏀',
  };
  
  const sportLabels: Record<string, string> = {
    nfl: 'NFL',
    cfb: 'College Football',
    nba: 'NBA',
    ncaab: 'College Basketball',
  };
  
  const sportColors: Record<string, number> = {
    nfl: 0x0055A4,  // NFL blue
    cfb: 0xFF6B00,  // CFB orange
    nba: 0xFF6600,  // NBA orange
    ncaab: 0x003366, // NCAAB navy
  };
  
  const sportEmoji = sportEmojis[sportType] || '🏈';
  const sportLabel = sportLabels[sportType] || sportType.toUpperCase();
  const color = sportColors[sportType] || 0x0055A4;

  // Create embed fields for each value pick
  const fields = valuePicks.slice(0, 5).map((pick, index) => ({
    name: `${index + 1}. ${pick.matchup}`,
    value: `**${pick.recommended_pick}** (${pick.bet_type.toUpperCase()})
Confidence: ${'⭐'.repeat(Math.min(pick.confidence, 10))} (${pick.confidence}/10)
${pick.explanation.substring(0, 150)}${pick.explanation.length > 150 ? '...' : ''}`,
    inline: false
  }));

  // Add a summary field
  fields.push({
    name: '📊 Analysis Summary',
    value: summary.substring(0, 300) + (summary.length > 300 ? '...' : ''),
    inline: false
  });

  // Create the Discord embed
  const embed = {
    title: `${sportEmoji} ${sportLabel} Value Finds - ${date}`,
    description: `WagerProof AI has identified **${valuePicks.length} value opportunities** for today's games.`,
    color: color,
    fields: fields,
    footer: {
      text: 'WagerProof AI Analysis • Always research before betting',
      icon_url: 'https://wagerproof.com/wagerproof-logo.png' // Update with actual logo URL
    },
    timestamp: new Date().toISOString(),
    url: 'https://wagerproof.com/editors-picks' // Link to your Value Finds page
  };

  // Post to Discord
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'WagerProof AI',
      avatar_url: 'https://wagerproof.com/wagerproof-logo.png', // Update with actual logo URL
      embeds: [embed],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord webhook failed: ${error}`);
  }
}

