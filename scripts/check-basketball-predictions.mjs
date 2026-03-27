import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const cfbSupabaseUrl = process.env.VITE_CFB_SUPABASE_URL;
const cfbSupabaseKey = process.env.VITE_CFB_SUPABASE_ANON_KEY;

console.log('Config check:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('VITE_CFB_SUPABASE_URL:', cfbSupabaseUrl ? 'SET' : 'MISSING');

if (!supabaseUrl || !supabaseKey || !cfbSupabaseUrl || !cfbSupabaseKey) {
  console.error('Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const cfbSupabase = createClient(cfbSupabaseUrl, cfbSupabaseKey);

async function checkBasketballPredictions() {
  console.log('\n🔍 CHECKING BASKETBALL PREDICTIONS...\n');

  // Check live_scores for NBA/NCAAB games
  console.log('📺 Live Scores Table:');
  const { data: liveGames } = await supabase
    .from('live_scores')
    .select('*')
    .in('league', ['NBA', 'NCAAB'])
    .order('league');
  
  console.log(`\nFound ${liveGames?.length || 0} live basketball games:`);
  liveGames?.forEach(game => {
    console.log(`  ${game.league}: ${game.away_abbr} @ ${game.home_abbr}`);
    console.log(`    game_id: ${game.game_id}`);
    console.log(`    is_live: ${game.is_live}`);
    console.log(`    scores: ${game.away_score}-${game.home_score}`);
  });

  // Check NBA predictions
  console.log('\n\n📊 NBA Predictions:');
  const { data: nbaLatestRun } = await cfbSupabase
    .from('nba_predictions')
    .select('run_id, as_of_ts_utc')
    .order('as_of_ts_utc', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (nbaLatestRun) {
    console.log(`Latest run_id: ${nbaLatestRun.run_id}`);
    console.log(`Timestamp: ${nbaLatestRun.as_of_ts_utc}`);

    const { data: nbaPreds } = await cfbSupabase
      .from('nba_predictions')
      .select('game_id, home_team, away_team, home_win_prob')
      .eq('run_id', nbaLatestRun.run_id)
      .limit(5);

    console.log(`\nSample predictions (${nbaPreds?.length || 0}):`);
    nbaPreds?.forEach(pred => {
      console.log(`  game_id: ${pred.game_id} (type: ${typeof pred.game_id})`);
      console.log(`    ${pred.away_team} @ ${pred.home_team}`);
      console.log(`    home_win_prob: ${pred.home_win_prob}`);
    });
  } else {
    console.log('❌ No NBA predictions found!');
  }

  // Check NCAAB predictions
  console.log('\n\n📊 NCAAB Predictions:');
  const { data: ncaabLatestRun } = await cfbSupabase
    .from('ncaab_predictions')
    .select('run_id, as_of_ts_utc')
    .order('as_of_ts_utc', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ncaabLatestRun) {
    console.log(`Latest run_id: ${ncaabLatestRun.run_id}`);
    console.log(`Timestamp: ${ncaabLatestRun.as_of_ts_utc}`);

    const { data: ncaabPreds } = await cfbSupabase
      .from('ncaab_predictions')
      .select('game_id, home_team, away_team, home_win_prob')
      .eq('run_id', ncaabLatestRun.run_id)
      .limit(5);

    console.log(`\nSample predictions (${ncaabPreds?.length || 0}):`);
    ncaabPreds?.forEach(pred => {
      console.log(`  game_id: ${pred.game_id} (type: ${typeof pred.game_id})`);
      console.log(`    ${pred.away_team} @ ${pred.home_team}`);
      console.log(`    home_win_prob: ${pred.home_win_prob}`);
    });
  } else {
    console.log('❌ No NCAAB predictions found!');
  }

  // Try to match
  console.log('\n\n🔍 MATCHING ATTEMPT:');
  if (liveGames && liveGames.length > 0) {
    for (const game of liveGames) {
      console.log(`\n${game.league}: ${game.away_team} @ ${game.home_team}`);
      console.log(`  live_scores.game_id: "${game.game_id}" (type: ${typeof game.game_id})`);
      
      // Extract numeric part
      const gameIdStr = game.game_id.replace(/^NBA-/, '').replace(/^NCAAB-/, '');
      const gameIdNum = parseInt(gameIdStr, 10);
      console.log(`  Extracted numeric ID: ${gameIdNum} (type: ${typeof gameIdNum})`);
      
      // Check if this game_id exists in predictions
      if (game.league === 'NBA' && nbaLatestRun) {
        const { data: match } = await cfbSupabase
          .from('nba_predictions')
          .select('*')
          .eq('run_id', nbaLatestRun.run_id)
          .eq('game_id', gameIdNum)
          .maybeSingle();
        
        if (match) {
          console.log(`  ✅ MATCH FOUND in nba_predictions!`);
          console.log(`     Home win prob: ${match.home_win_prob}`);
        } else {
          console.log(`  ❌ No match in nba_predictions`);
        }
      } else if (game.league === 'NCAAB' && ncaabLatestRun) {
        const { data: match } = await cfbSupabase
          .from('ncaab_predictions')
          .select('*')
          .eq('run_id', ncaabLatestRun.run_id)
          .eq('game_id', gameIdNum)
          .maybeSingle();
        
        if (match) {
          console.log(`  ✅ MATCH FOUND in ncaab_predictions!`);
          console.log(`     Home win prob: ${match.home_win_prob}`);
        } else {
          console.log(`  ❌ No match in ncaab_predictions`);
        }
      }
    }
  }

  console.log('\n✅ Check complete!\n');
}

checkBasketballPredictions().catch(console.error);

