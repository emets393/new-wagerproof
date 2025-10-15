// College Football Supabase client
import { createClient } from '@supabase/supabase-js';

const COLLEGE_FOOTBALL_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
const COLLEGE_FOOTBALL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";

// Create a separate client for college football data
export const collegeFootballSupabase = createClient(
  COLLEGE_FOOTBALL_SUPABASE_URL, 
  COLLEGE_FOOTBALL_SUPABASE_ANON_KEY
);

// Export the URL and key for potential use elsewhere
export const COLLEGE_FOOTBALL_CONFIG = {
  url: COLLEGE_FOOTBALL_SUPABASE_URL,
  anonKey: COLLEGE_FOOTBALL_SUPABASE_ANON_KEY
}; 