import { createClient } from '@supabase/supabase-js';

const MAIN_SUPABASE_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co";
const MAIN_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ";

const CFB_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
const CFB_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";

const mainSupabase = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_ANON_KEY);
const cfbSupabase = createClient(CFB_SUPABASE_URL, CFB_SUPABASE_ANON_KEY);

async function checkGameIdMismatch() {
  console.log('=== Checking NCAAB Game ID Mismatch ===\n');
  
  // Get a sample Duke game from the database
  const { data: dukeGames, error: dukeError } = await cfbSupabase
    .from('v_cbb_input_values')
    .select('game_id, away_team, home_team, game_date_et')
    .or('away_team.ilike.%Duke%,home_team.ilike.%Duke%')
    .order('game_date_et', { ascending: false })
    .limit(3);

  if (dukeError) {
    console.error('Error fetching Duke games:', dukeError.message);
    return;
  }

  console.log(`Found ${dukeGames?.length || 0} Duke games\n`);
  
  for (const game of dukeGames || []) {
    console.log(`\n--- Game: ${game.away_team} @ ${game.home_team} (${game.game_date_et}) ---`);
    console.log(`Database game_id: ${game.game_id} (type: ${typeof game.game_id})`);
    
    // Check what's in ai_completions for this game
    const gameIdAsString = String(game.game_id);
    
    const { data: completions, error: completionsError } = await mainSupabase
      .from('ai_completions')
      .select('game_id, widget_type, completion_text')
      .eq('sport_type', 'ncaab')
      .eq('game_id', gameIdAsString);
    
    if (completionsError) {
      console.error('Error fetching completions:', completionsError.message);
    } else if (completions && completions.length > 0) {
      console.log(`✅ Found ${completions.length} completions in database:`);
      completions.forEach(c => {
        console.log(`   - ${c.widget_type}: "${c.completion_text.substring(0, 80)}..."`);
        console.log(`     Stored game_id: "${c.game_id}" (type: ${typeof c.game_id})`);
      });
    } else {
      console.log(`❌ No completions found for game_id: "${gameIdAsString}"`);
      
      // Check if there are ANY completions with a similar game_id
      const { data: allCompletions } = await mainSupabase
        .from('ai_completions')
        .select('game_id, widget_type')
        .eq('sport_type', 'ncaab')
        .limit(5);
      
      console.log(`\nAll NCAAB completions in database (sample):`);
      allCompletions?.forEach(c => {
        console.log(`   - game_id: "${c.game_id}" (type: ${typeof c.game_id})`);
      });
    }
  }
  
  console.log('\n\n=== Summary ===');
  console.log('If completions exist but are not displaying, the issue is likely:');
  console.log('1. Game ID format mismatch between storage and fetching');
  console.log('2. The NCAAB page is looking for a different game_id format');
  console.log('3. The game data has training_key or unique_id that differs from game_id');
}

checkGameIdMismatch().catch(console.error);

