import { createClient } from '@supabase/supabase-js';

// Main Supabase instance (where AI completion tables are)
const MAIN_SUPABASE_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co";
const MAIN_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ";

const supabase = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_ANON_KEY);

async function checkBasketballSupport() {
  console.log('Checking Basketball AI Completion Support...\n');

  // 1. Check ai_completion_configs for NBA and NCAAB
  console.log('=== AI Completion Configs ===');
  const { data: configs, error: configError } = await supabase
    .from('ai_completion_configs')
    .select('widget_type, sport_type, enabled')
    .order('sport_type, widget_type');

  if (configError) {
    console.error('Error fetching configs:', configError);
  } else {
    console.table(configs);
    const nbaConfigs = configs.filter(c => c.sport_type === 'nba');
    const ncaabConfigs = configs.filter(c => c.sport_type === 'ncaab');
    console.log(`\nNBA configs: ${nbaConfigs.length}`);
    console.log(`NCAAB configs: ${ncaabConfigs.length}`);
  }

  // 2. Check for any existing basketball completions
  console.log('\n=== Existing Basketball Completions ===');
  const { data: nbaCompletions, error: nbaError } = await supabase
    .from('ai_completions')
    .select('game_id, widget_type, generated_at')
    .eq('sport_type', 'nba');

  const { data: ncaabCompletions, error: ncaabError } = await supabase
    .from('ai_completions')
    .select('game_id, widget_type, generated_at')
    .eq('sport_type', 'ncaab');

  if (nbaError) {
    console.error('Error fetching NBA completions:', nbaError.message);
    console.log('This error suggests the table constraint might not allow "nba" yet.');
  } else {
    console.log(`NBA completions: ${nbaCompletions?.length || 0}`);
  }

  if (ncaabError) {
    console.error('Error fetching NCAAB completions:', ncaabError.message);
    console.log('This error suggests the table constraint might not allow "ncaab" yet.');
  } else {
    console.log(`NCAAB completions: ${ncaabCompletions?.length || 0}`);
  }

  // 3. Try to test if we can insert a basketball completion
  console.log('\n=== Testing Basketball Insertion ===');
  const testData = {
    game_id: 'test-nba-game-123',
    sport_type: 'nba',
    widget_type: 'spread_prediction',
    completion_text: 'Test completion',
    data_payload: { test: true },
    model_used: 'test',
  };

  const { error: insertError } = await supabase
    .from('ai_completions')
    .insert(testData);

  if (insertError) {
    console.error('❌ Cannot insert NBA completion:', insertError.message);
    if (insertError.message.includes('violates check constraint')) {
      console.log('\n🔍 ISSUE FOUND: The ai_completions table CHECK constraint does not allow "nba" or "ncaab"');
      console.log('The migration 20250115000000_add_basketball_sports.sql needs to be applied.');
    }
  } else {
    console.log('✅ Successfully inserted test NBA completion');
    // Clean up the test data
    await supabase
      .from('ai_completions')
      .delete()
      .eq('game_id', 'test-nba-game-123');
    console.log('Cleaned up test data');
  }
}

checkBasketballSupport().catch(console.error);

