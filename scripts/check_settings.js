
async function checkSettings() {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS for diagnostics
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Checking site_settings table...');
  const { data, error } = await supabase
    .from('site_settings')
    .select('*');

  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }

  console.log(`Found ${data.length} rows in site_settings.`);
  if (data.length > 0) {
    console.log('Settings:', JSON.stringify(data[0], null, 2));
    console.log('show_user_wins_section:', data[0].show_user_wins_section);
  }
}

checkSettings();

