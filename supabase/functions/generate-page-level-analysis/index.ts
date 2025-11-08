import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PageLevelRequest {
  sport_type: 'nfl' | 'cfb';
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

    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const cfbClient = createClient(cfbSupabaseUrl, cfbSupabaseKey);

    const { sport_type, analysis_date, user_id }: PageLevelRequest = await req.json();

    const targetDate = analysis_date || new Date().toISOString().split('T')[0];

    console.log(`Generating page-level analysis for ${sport_type} on ${targetDate}`);

    // Get system prompt from schedule config
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('ai_page_level_schedules')
      .select('system_prompt')
      .eq('sport_type', sport_type)
      .single();

    if (scheduleError || !schedule) {
      throw new Error(`No schedule config found for ${sport_type}`);
    }

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
        const { data: nflGames } = await cfbClient
          .from('nfl_predictions_epa')
          .select('*')
          .eq('run_id', latestRun.run_id)
          .eq('game_date', targetDate);

        games = nflGames || [];
      }
    } else if (sport_type === 'cfb') {
      const { data: cfbGames } = await cfbClient
        .from('cfb_live_weekly_inputs')
        .select('*');

      games = cfbGames || [];
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
    const gameIds = games.map(g => g.training_key || g.unique_id || `${g.away_team}_${g.home_team}`);
    
    const { data: completions } = await supabaseClient
      .from('ai_completions')
      .select('*')
      .in('game_id', gameIds)
      .eq('sport_type', sport_type);

    console.log(`Found ${completions?.length || 0} completions`);

    // Build comprehensive payload
    const gamesWithCompletions = games.map(game => {
      const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;
      const gameCompletions = completions?.filter(c => c.game_id === gameId) || [];

      return {
        game_id: gameId,
        matchup: `${game.away_team} @ ${game.home_team}`,
        game_data: sport_type === 'nfl' ? buildNFLGameData(game) : buildCFBGameData(game),
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

    console.log('Calling OpenAI for page-level analysis...');

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
          {
            role: 'system',
            content: schedule.system_prompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const analysisContent = openaiData.choices[0].message.content;
    
    console.log('OpenAI page-level analysis received');

    const analysisJson = JSON.parse(analysisContent);
    const valuePicks = analysisJson.value_picks || [];
    const summaryText = analysisJson.summary || 'No summary provided';

    // Store in database
    const { error: insertError } = await supabaseClient
      .from('ai_value_finds')
      .insert({
        sport_type,
        analysis_date: targetDate,
        value_picks: valuePicks,
        analysis_json: analysisJson,
        summary_text: summaryText,
        generated_by: user_id || null,
        generated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error storing value finds:', insertError);
      throw insertError;
    }

    // Update last_run_at in schedule
    await supabaseClient
      .from('ai_page_level_schedules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('sport_type', sport_type);

    console.log(`Value finds analysis complete. Found ${valuePicks.length} value opportunities`);

    return new Response(
      JSON.stringify({
        success: true,
        sport_type,
        analysis_date: targetDate,
        value_picks: valuePicks,
        summary: summaryText,
        tokens_used: openaiData.usage?.total_tokens || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-page-level-analysis:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildNFLGameData(game: any): any {
  return {
    teams: {
      away: game.away_team,
      home: game.home_team,
    },
    predictions: {
      spread_cover_prob: game.home_away_spread_cover_prob,
      ml_prob: game.home_away_ml_prob,
      ou_prob: game.ou_result_prob,
    },
    vegas_lines: {
      home_spread: game.home_spread,
      away_spread: game.away_spread,
      home_ml: game.home_ml,
      away_ml: game.away_ml,
      over_line: game.over_line,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    weather: {
      temperature: game.temperature,
      wind_speed: game.wind_speed,
      precipitation: game.precipitation,
    },
  };
}

function buildCFBGameData(game: any): any {
  return {
    teams: {
      away: game.away_team,
      home: game.home_team,
    },
    predictions: {
      spread_cover_prob: game.pred_spread_proba || game.home_away_spread_cover_prob,
      ml_prob: game.pred_ml_proba || game.home_away_ml_prob,
      ou_prob: game.pred_total_proba || game.ou_result_prob,
    },
    vegas_lines: {
      home_spread: game.api_spread || game.home_spread,
      away_spread: game.api_spread ? -game.api_spread : game.away_spread,
      home_ml: game.home_moneyline || game.home_ml,
      away_ml: game.away_moneyline || game.away_ml,
      over_line: game.api_over_line || game.total_line,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    weather: {
      temperature: game.weather_temp_f || game.temperature,
      wind_speed: game.weather_windspeed_mph || game.wind_speed,
    },
  };
}

