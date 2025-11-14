import { createClient } from '@supabase/supabase-js';

const cfbUrl = 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const cfbAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';
const supabase = createClient(cfbUrl, cfbAnonKey);

async function checkNCAABMoneylines() {
  console.log('🔍 Checking NCAAB Moneyline Columns...\n');
  
  try {
    // Query a sample game to see all columns
    const { data: games, error: gamesError } = await supabase
      .from('v_cbb_input_values')
      .select('*')
      .limit(1);
    
    if (gamesError) {
      console.error('❌ Error fetching games:', gamesError);
      return;
    }
    
    if (!games || games.length === 0) {
      console.log('⚠️ No games found');
      return;
    }
    
    const game = games[0];
    console.log('📊 Sample Game Data:');
    console.log('Game ID:', game.game_id);
    console.log('Home Team:', game.home_team);
    console.log('Away Team:', game.away_team);
    console.log('\n');
    
    // Find all moneyline-related columns
    const moneylineKeys = Object.keys(game).filter(k => 
      k.toLowerCase().includes('moneyline') || 
      k.toLowerCase().includes('money') ||
      k.toLowerCase().includes('ml')
    );
    
    console.log('💰 Moneyline-related columns found:');
    moneylineKeys.forEach(key => {
      console.log(`  - ${key}: ${game[key]} (type: ${typeof game[key]})`);
    });
    
    console.log('\n📋 All columns in game object:');
    Object.keys(game).sort().forEach(key => {
      const value = game[key];
      const type = value === null ? 'null' : typeof value;
      const preview = typeof value === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...' 
        : value;
      console.log(`  ${key.padEnd(30)} ${type.padEnd(10)} ${preview}`);
    });
    
    // Also check ncaab_predictions table
    console.log('\n\n🔍 Checking ncaab_predictions table...\n');
    const { data: latestRun } = await supabase
      .from('ncaab_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestRun) {
      const { data: predictions, error: predError } = await supabase
        .from('ncaab_predictions')
        .select('*')
        .eq('run_id', latestRun.run_id)
        .limit(1);
      
      if (!predError && predictions && predictions.length > 0) {
        const pred = predictions[0];
        console.log('📊 Sample Prediction Data:');
        console.log('Game ID:', pred.game_id);
        console.log('Home Team:', pred.home_team);
        console.log('Away Team:', pred.away_team);
        console.log('\n');
        
        const predMoneylineKeys = Object.keys(pred).filter(k => 
          k.toLowerCase().includes('moneyline') || 
          k.toLowerCase().includes('money') ||
          k.toLowerCase().includes('ml')
        );
        
        console.log('💰 Moneyline-related columns in predictions:');
        predMoneylineKeys.forEach(key => {
          console.log(`  - ${key}: ${pred[key]} (type: ${typeof pred[key]})`);
        });
      }
    }
    
    // Compare values for the same game
    if (games.length > 0 && latestRun) {
      const gameId = games[0].game_id;
      const { data: matchingPred } = await supabase
        .from('ncaab_predictions')
        .select('*')
        .eq('run_id', latestRun.run_id)
        .eq('game_id', gameId)
        .maybeSingle();
      
      if (matchingPred) {
        console.log('\n\n🔗 Comparing values for same game (game_id:', gameId, '):');
        console.log('From v_cbb_input_values:');
        moneylineKeys.forEach(key => {
          console.log(`  ${key}: ${game[key]}`);
        });
        console.log('\nFrom ncaab_predictions:');
        const predMoneylineKeys = Object.keys(matchingPred).filter(k => 
          k.toLowerCase().includes('moneyline') || 
          k.toLowerCase().includes('money') ||
          k.toLowerCase().includes('ml')
        );
        predMoneylineKeys.forEach(key => {
          console.log(`  ${key}: ${matchingPred[key]}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNCAABMoneylines();

