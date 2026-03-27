import { createClient } from '@supabase/supabase-js';

// CFB Supabase credentials (where NBA data lives)
const supabaseUrl = 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk1MzE3MDIsImV4cCI6MjAzNTEwNzcwMn0.KYs8CqpFh6FmQ9cO6CJaWqTPEjNzYv42kYJsKe1eXvk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNBAPredictions() {
  console.log('🏀 Checking NBA predictions table...\n');
  
  try {
    // Check if table has any data
    const { count, error: countError } = await supabase
      .from('nba_predictions')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting predictions:', countError);
      return;
    }
    
    console.log(`📊 Total rows in nba_predictions: ${count || 0}`);
    
    if (count === 0) {
      console.log('\n❌ NBA predictions table is EMPTY - this is why no model predictions are showing!');
      console.log('\n💡 Solution: The NBA predictions need to be generated and inserted into the nba_predictions table.');
      console.log('   Contact your data team to run the NBA prediction model.');
      return;
    }
    
    // If there's data, check the latest run
    const { data: latestRun, error: runError } = await supabase
      .from('nba_predictions')
      .select('run_id, as_of_ts_utc')
      .order('as_of_ts_utc', { ascending: false })
      .limit(1)
      .single();
    
    if (runError) {
      console.error('❌ Error fetching latest run:', runError);
      return;
    }
    
    console.log('✅ Latest run_id:', latestRun.run_id);
    console.log('✅ As of:', latestRun.as_of_ts_utc);
    
    // Get a sample prediction
    const { data: sample, error: sampleError } = await supabase
      .from('nba_predictions')
      .select('*')
      .eq('run_id', latestRun.run_id)
      .limit(1)
      .single();
    
    if (sampleError) {
      console.error('❌ Error fetching sample:', sampleError);
      return;
    }
    
    console.log('\n📊 Sample prediction fields:');
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkNBAPredictions();
