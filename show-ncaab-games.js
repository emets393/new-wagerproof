#!/usr/bin/env node

/**
 * Script to show NCAAB games from the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the same credentials as the app (from college-football-client.ts)
const COLLEGE_FOOTBALL_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
const COLLEGE_FOOTBALL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";

const supabase = createClient(COLLEGE_FOOTBALL_SUPABASE_URL, COLLEGE_FOOTBALL_SUPABASE_ANON_KEY);

console.log('===================================');
console.log('NCAAB Games from Database');
console.log('===================================\n');

async function showNCAABGames() {
  try {
    // Fetch games from v_cbb_input_values
    console.log('📊 Fetching NCAAB games from v_cbb_input_values...\n');
    
    const { data: games, error } = await supabase
      .from('v_cbb_input_values')
      .select('*')
      .order('game_date_et', { ascending: true })
      .order('tipoff_time_et', { ascending: true })
      .limit(20); // Show first 20 games

    if (error) {
      console.error('❌ Error fetching games:', error);
      return;
    }

    if (!games || games.length === 0) {
      console.log('⚠️ No NCAAB games found in database');
      return;
    }

    console.log(`✅ Found ${games.length} NCAAB games\n`);
    console.log('─'.repeat(80));

    // Get latest predictions
    const { data: latestRun } = await supabase
      .from('ncaab_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .maybeSingle();

    let predictionMap = new Map();
    if (latestRun) {
      const gameIds = games.map(g => g.game_id);
      const { data: predictions } = await supabase
        .from('ncaab_predictions')
        .select('*')
        .eq('run_id', latestRun.run_id)
        .in('game_id', gameIds);

      predictions?.forEach(pred => {
        predictionMap.set(pred.game_id, pred);
      });
    }

    // Display games
    games.forEach((game, idx) => {
      const prediction = predictionMap.get(game.game_id);
      
      console.log(`\n${idx + 1}. ${game.away_team} @ ${game.home_team}`);
      console.log(`   Game ID: ${game.game_id}`);
      console.log(`   Date: ${game.game_date_et || 'N/A'}`);
      console.log(`   Time: ${game.tipoff_time_et || 'N/A'}`);
      
      // Betting lines
      console.log(`   📊 Betting Lines:`);
      console.log(`      Spread: ${game.home_team} ${game.spread || 'N/A'}`);
      console.log(`      Total: ${game.over_under || 'N/A'}`);
      console.log(`      Home ML: ${game.homeMoneyline || 'N/A'}`);
      console.log(`      Away ML: ${game.awayMoneyline || 'N/A'}`);
      
      // Predictions
      if (prediction) {
        console.log(`   🤖 Model Predictions:`);
        console.log(`      Home Win Prob: ${prediction.home_win_prob ? (prediction.home_win_prob * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`      Predicted Margin: ${prediction.pred_home_margin || 'N/A'}`);
        console.log(`      Predicted Total: ${prediction.pred_total_points || 'N/A'}`);
        console.log(`      Run ID: ${prediction.run_id || 'N/A'}`);
      } else {
        console.log(`   🤖 Model Predictions: Not available`);
      }
      
      // Context
      if (game.conference_game || game.neutral_site || game.home_ranking || game.away_ranking) {
        console.log(`   📋 Context:`);
        if (game.conference_game) console.log(`      Conference Game`);
        if (game.neutral_site) console.log(`      Neutral Site`);
        if (game.home_ranking) console.log(`      Home Rank: #${game.home_ranking}`);
        if (game.away_ranking) console.log(`      Away Rank: #${game.away_ranking}`);
      }
      
      console.log('─'.repeat(80));
    });

    // Summary
    console.log(`\n📈 Summary:`);
    console.log(`   Total games shown: ${games.length}`);
    console.log(`   Games with predictions: ${predictionMap.size}`);
    if (latestRun) {
      console.log(`   Latest run_id: ${latestRun.run_id}`);
      console.log(`   Predictions as of: ${latestRun.as_of_ts_utc}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

showNCAABGames();

