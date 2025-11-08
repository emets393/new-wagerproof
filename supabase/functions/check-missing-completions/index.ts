import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the college football supabase URL and key for fetching predictions
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const cfbClient = createClient(cfbSupabaseUrl, cfbSupabaseKey);

    console.log('Starting check for missing AI completions...');

    // Get enabled widget configs
    const { data: configs, error: configError } = await supabaseClient
      .from('ai_completion_configs')
      .select('widget_type, sport_type')
      .eq('enabled', true);

    if (configError) {
      throw new Error(`Error fetching configs: ${configError.message}`);
    }

    console.log(`Found ${configs?.length || 0} enabled widget configs`);

    // Get date range (today + next 3 days)
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = threeDaysFromNow.toISOString().split('T')[0];

    console.log(`Checking games from ${todayStr} to ${futureStr}`);

    let totalGenerated = 0;
    let totalErrors = 0;
    const results: any[] = [];

    // Process NFL games
    if (configs?.some(c => c.sport_type === 'nfl')) {
      console.log('Fetching NFL predictions...');
      
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
          .gte('game_date', todayStr)
          .lte('game_date', futureStr);

        console.log(`Found ${nflGames?.length || 0} NFL games`);

        for (const game of nflGames || []) {
          const gameId = game.training_key || game.unique_id;
          
          for (const config of configs.filter(c => c.sport_type === 'nfl')) {
            // Check if completion exists
            const { data: existing } = await supabaseClient
              .from('ai_completions')
              .select('id')
              .eq('game_id', gameId)
              .eq('sport_type', 'nfl')
              .eq('widget_type', config.widget_type)
              .maybeSingle();

            if (!existing) {
              console.log(`Missing: NFL ${gameId} - ${config.widget_type}`);
              
              // Build payload (simplified for now, will be enhanced)
              const payload = buildNFLPayload(game, config.widget_type);

              // Call generate-ai-completion function
              try {
                const response = await fetch(`${supabaseUrl}/functions/v1/generate-ai-completion`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    game_id: gameId,
                    sport_type: 'nfl',
                    widget_type: config.widget_type,
                    game_data_payload: payload,
                  }),
                });

                const result = await response.json();
                
                if (result.success) {
                  totalGenerated++;
                  results.push({ gameId, widget: config.widget_type, status: 'generated' });
                } else {
                  totalErrors++;
                  results.push({ gameId, widget: config.widget_type, status: 'error', error: result.error });
                }
              } catch (error) {
                console.error(`Error generating completion: ${error.message}`);
                totalErrors++;
                results.push({ gameId, widget: config.widget_type, status: 'error', error: error.message });
              }

              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }
    }

    // Process CFB games
    if (configs?.some(c => c.sport_type === 'cfb')) {
      console.log('Fetching CFB predictions...');
      
      const { data: cfbGames } = await cfbClient
        .from('cfb_live_weekly_inputs')
        .select('*');

      console.log(`Found ${cfbGames?.length || 0} CFB games`);

      for (const game of cfbGames || []) {
        const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;
        
        for (const config of configs.filter(c => c.sport_type === 'cfb')) {
          const { data: existing } = await supabaseClient
            .from('ai_completions')
            .select('id')
            .eq('game_id', gameId)
            .eq('sport_type', 'cfb')
            .eq('widget_type', config.widget_type)
            .maybeSingle();

          if (!existing) {
            console.log(`Missing: CFB ${gameId} - ${config.widget_type}`);
            
            const payload = buildCFBPayload(game, config.widget_type);

            try {
              const response = await fetch(`${supabaseUrl}/functions/v1/generate-ai-completion`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  game_id: gameId,
                  sport_type: 'cfb',
                  widget_type: config.widget_type,
                  game_data_payload: payload,
                }),
              });

              const result = await response.json();
              
              if (result.success) {
                totalGenerated++;
                results.push({ gameId, widget: config.widget_type, status: 'generated' });
              } else {
                totalErrors++;
                results.push({ gameId, widget: config.widget_type, status: 'error', error: result.error });
              }
            } catch (error) {
              console.error(`Error generating completion: ${error.message}`);
              totalErrors++;
              results.push({ gameId, widget: config.widget_type, status: 'error', error: error.message });
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    console.log(`Completion check finished. Generated: ${totalGenerated}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalGenerated,
        totalErrors,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-missing-completions:', error);
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

// Helper function to build NFL payload
function buildNFLPayload(game: any, widgetType: string): any {
  const basePayload = {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.game_date,
      game_time: game.game_time,
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
  };

  if (widgetType === 'spread_prediction') {
    return {
      ...basePayload,
      predictions: {
        spread_cover_prob: game.home_away_spread_cover_prob,
        spread_line: game.home_spread,
        predicted_team: game.home_away_spread_cover_prob > 0.5 ? 'home' : 'away',
      },
    };
  } else if (widgetType === 'ou_prediction') {
    return {
      ...basePayload,
      predictions: {
        ou_prob: game.ou_result_prob,
        ou_line: game.over_line,
        predicted_result: game.ou_result_prob > 0.5 ? 'over' : 'under',
      },
    };
  }

  return basePayload;
}

// Helper function to build CFB payload
function buildCFBPayload(game: any, widgetType: string): any {
  const basePayload = {
    game: {
      away_team: game.away_team,
      home_team: game.home_team,
      game_date: game.start_time || game.start_date,
    },
    vegas_lines: {
      home_spread: game.api_spread || game.home_spread,
      away_spread: game.api_spread ? -game.api_spread : game.away_spread,
      home_ml: game.home_moneyline || game.home_ml,
      away_ml: game.away_moneyline || game.away_ml,
      over_line: game.api_over_line || game.total_line,
    },
    weather: {
      temperature: game.weather_temp_f || game.temperature,
      wind_speed: game.weather_windspeed_mph || game.wind_speed,
      icon: game.weather_icon_text || game.icon_code,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
  };

  if (widgetType === 'spread_prediction') {
    return {
      ...basePayload,
      predictions: {
        spread_cover_prob: game.pred_spread_proba || game.home_away_spread_cover_prob,
        spread_line: game.api_spread || game.home_spread,
        predicted_team: (game.pred_spread_proba || game.home_away_spread_cover_prob || 0) > 0.5 ? 'home' : 'away',
      },
    };
  } else if (widgetType === 'ou_prediction') {
    return {
      ...basePayload,
      predictions: {
        ou_prob: game.pred_total_proba || game.ou_result_prob,
        ou_line: game.api_over_line || game.total_line,
        predicted_result: (game.pred_total_proba || game.ou_result_prob || 0) > 0.5 ? 'over' : 'under',
      },
    };
  }

  return basePayload;
}

