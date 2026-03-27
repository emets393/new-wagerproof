import { createClient } from '@supabase/supabase-js';

const CFB_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
const CFB_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";

const cfbSupabase = createClient(CFB_SUPABASE_URL, CFB_SUPABASE_ANON_KEY);

async function checkGameStructure() {
  console.log('=== Checking NCAAB Game Structure (as seen by NCAAB page) ===\n');
  
  // Fetch exactly as the NCAAB page does
  const { data: games, error } = await cfbSupabase
    .from('v_cbb_input_values')
    .select('*')
    .or('away_team.ilike.%Duke%,home_team.ilike.%Duke%')
    .order('game_date_et', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Game: ${games.away_team} @ ${games.home_team}\n`);
  
  // Check what IDs are available
  console.log('Available ID fields:');
  console.log(`  game_id: ${games.game_id} (type: ${typeof games.game_id})`);
  console.log(`  training_key: ${games.training_key || 'NOT PRESENT'}`);
  console.log(`  unique_id: ${games.unique_id || 'NOT PRESENT'}`);
  console.log(`  id: ${games.id || 'NOT PRESENT'}`);
  
  // Simulate what the NCAAB page does
  const gameIdOptions = [
    games.training_key,
    games.unique_id,
    games.id,
    `${games.away_team}_${games.home_team}`,
    String(games.game_id || games.id)
  ].filter(Boolean);
  
  console.log('\nGame ID options the NCAAB page will try (in order):');
  gameIdOptions.forEach((id, idx) => {
    console.log(`  ${idx + 1}. "${id}"`);
  });
  
  console.log('\n✅ The page SHOULD find completions for game_id: "209898"');
  console.log('   because it tries: String(games.game_id || games.id)');
  console.log(`   which would be: String(${games.game_id}) = "${String(games.game_id)}"`);
  
  // Show what game object keys exist
  console.log('\n📋 All available game object keys:');
  console.log(Object.keys(games).sort().join(', '));
}

checkGameStructure().catch(console.error);

