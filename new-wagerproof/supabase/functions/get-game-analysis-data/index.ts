
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

    // Get all game info including betting lines from input_values_view (same as Today's Games)
    const { data: gameData, error: gameError } = await supabase
      .from('input_values_view')
      .select(`
        unique_id,
        home_team,
        away_team,
        home_pitcher,
        away_pitcher,
        home_era,
        away_era,
        home_whip,
        away_whip,
        date,
        start_time_minutes,
        home_ml,
        away_ml,
        home_rl,
        away_rl,
        o_u_line
      `)
      .eq('unique_id', unique_id)
      .maybeSingle();

    if (gameError || !gameData) {
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Game data retrieved:', gameData);
    console.log('Betting lines from game data:');
    console.log('- O/U Line:', gameData.o_u_line);
    console.log('- Home ML:', gameData.home_ml);
    console.log('- Away ML:', gameData.away_ml);
    console.log('- Home RL:', gameData.home_rl);
    console.log('- Away RL:', gameData.away_rl);

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
    console.log('- O/U Line:', gameData.o_u_line);
    console.log('- Home ML:', gameData.home_ml);
    console.log('- Away ML:', gameData.away_ml);
    console.log('- Home RL:', gameData.home_rl);
    console.log('- Away RL:', gameData.away_rl);

    const analysisData = {
      game_info: {
        unique_id: unique_id,
        primary_team: gameData.home_team,
        opponent_team: gameData.away_team,
        is_home_team: true,
        o_u_line: gameData.o_u_line,
        home_ml: gameData.home_ml,
        away_ml: gameData.away_ml,
        home_rl: gameData.home_rl,
        away_rl: gameData.away_rl
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
