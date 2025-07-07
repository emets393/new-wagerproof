
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { unique_id, target, models } = await req.json();
    
    if (!unique_id || !target) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: unique_id and target' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get game info from the combined predictions view
    const { data: gameData, error: gameError } = await supabase
      .from('latest_predictions_today')
      .select('*')
      .eq('unique_id', unique_id)
      .single();

    if (gameError || !gameData) {
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get betting lines from input_values_team_format_view
    let o_u_line = null;
    let home_ml = null;
    let away_ml = null;
    let home_rl = null;
    let away_rl = null;
    
    console.log('Querying betting data for unique_id:', unique_id);
    
    const { data: bettingData, error: bettingError } = await supabase
      .from('input_values_team_format_view')
      .select('o_u_line, primary_ml, opponent_ml, primary_rl, opponent_rl')
      .eq('unique_id', unique_id)
      .eq('is_home_team', true)
      .single();
    
    console.log('Betting data query result:');
    console.log('- Error:', bettingError);
    console.log('- Data:', bettingData);
    
    if (bettingError) {
      console.error('Betting data query failed:', bettingError);
      // Try without the is_home_team filter to see if there's any data at all
      const { data: allBettingData, error: allBettingError } = await supabase
        .from('input_values_team_format_view')
        .select('*')
        .eq('unique_id', unique_id);
      
      console.log('All betting data for this unique_id:');
      console.log('- Error:', allBettingError);
      console.log('- Data:', allBettingData);
      console.log('- Count:', allBettingData?.length || 0);
    }
    
    if (!bettingError && bettingData) {
      o_u_line = bettingData.o_u_line;
      // Since primary_team is home_team, primary_ml is home_ml
      home_ml = bettingData.primary_ml;
      away_ml = bettingData.opponent_ml;
      home_rl = bettingData.primary_rl;
      away_rl = bettingData.opponent_rl;
      
      console.log('Betting lines extracted:');
      console.log('- O/U Line:', o_u_line);
      console.log('- Home ML:', home_ml);
      console.log('- Away ML:', away_ml);
      console.log('- Home RL:', home_rl);
      console.log('- Away RL:', away_rl);
    } else {
      console.log('No betting data found or error occurred');
    }

    // Use real model data if provided, otherwise fall back to single prediction
    let modelPredictions = [];
    
    if (models && Array.isArray(models) && models.length > 0) {
      // Use the actual model matches passed from Custom Models
      modelPredictions = models.map((model, index) => ({
        unique_id: model.unique_id,
        primary_team: model.primary_team,
        opponent_team: model.opponent_team,
        is_home_team: model.is_home_team,
        combo: model.combo,
        win_pct: model.win_pct,
        opponent_win_pct: model.opponent_win_pct,
        games: model.games,
        feature_count: model.feature_count,
        features: model.features,
        model_name: `Custom Model #${index + 1}`,
        confidence: 0.7 // Default confidence since this isn't in the model data
      }));
    } else {
      // Fallback to single prediction from database
      modelPredictions = [{
        unique_id: unique_id,
        primary_team: gameData.home_team,
        opponent_team: gameData.away_team,
        is_home_team: true,
        combo: "base_model_combo",
        win_pct: target === 'moneyline' 
          ? (gameData.ml_probability || 0.5)
          : target === 'runline' 
            ? (gameData.run_line_probability || 0.5)
            : (gameData.ou_probability || 0.5),
        opponent_win_pct: target === 'moneyline' 
          ? (1 - (gameData.ml_probability || 0.5))
          : target === 'runline' 
            ? (1 - (gameData.run_line_probability || 0.5))
            : (1 - (gameData.ou_probability || 0.5)),
        games: 250,
        feature_count: 8,
        features: ["primary_era", "opponent_era", "primary_win_pct", "opponent_win_pct", "primary_streak", "opponent_streak", "primary_whip", "opponent_whip"],
        model_name: "Base Model",
        confidence: gameData.ml_tier_accuracy || 0.7
      }];
    }

    // Calculate team-specific win probabilities
    // Group models by the actual team they're predicting for
    const teamPredictions = new Map();
    
    modelPredictions.forEach(model => {
      const teamName = model.primary_team;
      
      if (!teamPredictions.has(teamName)) {
        teamPredictions.set(teamName, { totalWeightedWinPct: 0, totalWeight: 0, models: [] });
      }
      
      const teamData = teamPredictions.get(teamName);
      teamData.totalWeightedWinPct += model.win_pct * model.games;
      teamData.totalWeight += model.games;
      teamData.models.push(model);
    });

    // Calculate final win probabilities for each team
    const teamWinProbabilities = new Map();
    teamPredictions.forEach((data, teamName) => {
      const winProbability = data.totalWeight > 0 ? data.totalWeightedWinPct / data.totalWeight : 0.5;
      teamWinProbabilities.set(teamName, winProbability);
    });

    // Determine the winning team based on highest win probability
    let teamWinnerPrediction = gameData.home_team;
    let highestWinPct = 0;
    
    teamWinProbabilities.forEach((winPct, teamName) => {
      if (winPct > highestWinPct) {
        highestWinPct = winPct;
        teamWinnerPrediction = teamName;
      }
    });

    // Calculate consensus percentages for display (primary vs opponent perspective)
    const homeTeamWinPct = teamWinProbabilities.get(gameData.home_team) || 0.5;
    const awayTeamWinPct = teamWinProbabilities.get(gameData.away_team) || 0.5;
    
    // Normalize so they add up to 1
    const totalWinPct = homeTeamWinPct + awayTeamWinPct;
    const weightedPrimaryWinPct = totalWinPct > 0 ? homeTeamWinPct / totalWinPct : 0.5;
    const weightedOpponentWinPct = 1 - weightedPrimaryWinPct;

    // Calculate model agreement confidence
    const avgWinPct = modelPredictions.reduce((sum, model) => sum + model.win_pct, 0) / modelPredictions.length;
    const variance = modelPredictions.reduce((sum, model) => 
      sum + Math.pow(model.win_pct - avgWinPct, 2), 0
    ) / modelPredictions.length;
    const agreement = Math.max(0, 1 - (variance * 4)); // Scale variance to 0-1 range
    const modelAgreementConfidence = Math.round(agreement * 100);

    console.log('Final betting lines being returned:');
    console.log('- O/U Line:', o_u_line);
    console.log('- Home ML:', home_ml);
    console.log('- Away ML:', away_ml);
    console.log('- Home RL:', home_rl);
    console.log('- Away RL:', away_rl);

    const analysisData = {
      game_info: {
        unique_id: unique_id,
        primary_team: gameData.home_team,
        opponent_team: gameData.away_team,
        is_home_team: true,
        o_u_line: o_u_line,
        home_ml: home_ml,
        away_ml: away_ml,
        home_rl: home_rl,
        away_rl: away_rl
      },
      matches: modelPredictions,
      target: target,
      consensus: {
        primary_percentage: weightedPrimaryWinPct,
        opponent_percentage: weightedOpponentWinPct,
        confidence: modelAgreementConfidence,
        models: modelPredictions.length,
        team_winner_prediction: teamWinnerPrediction
      }
    };

    return new Response(
      JSON.stringify(analysisData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-game-analysis-data:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
