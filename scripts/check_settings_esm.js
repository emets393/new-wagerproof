
import { createClient } from '@supabase/supabase-js';

async function checkSettings() {
  
  const supabaseUrl = "https://gnjrklxotmbvnxbnnqgq.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ";
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Checking site_settings table via ANON key...');
  
  // Try selecting all columns first to see if access is allowed
  const { data: allData, error: allError } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1);

  if (allError) {
    console.error('Error fetching * settings (ANON):', allError);
  } else {
    console.log('Settings (ANON) *:', allData);
  }

  // Try specifically the column we want
  const { data, error } = await supabase
    .from('site_settings')
    .select('show_user_wins_section')
    .single();

  if (error) {
    console.error('Error fetching specific column (ANON):', error);
  } else {
    console.log('Settings (ANON) specific:', data);
  }
}

checkSettings();
