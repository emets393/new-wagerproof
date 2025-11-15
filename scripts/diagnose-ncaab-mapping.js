/**
 * Diagnostic script to check ncaab_team_mapping table
 * This will help us understand what's actually in the table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_COLLEGE_FOOTBALL_SUPABASE_URL || "https://jpxnjuwglavsjbgbasnl.supabase.co";
const supabaseKey = process.env.VITE_COLLEGE_FOOTBALL_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseTable() {
  console.log('🔍 Diagnosing ncaab_team_mapping table...\n');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Using anon key:', supabaseKey.substring(0, 20) + '...\n');

  try {
    // Test 0: List all tables to see what's available
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 0: Check if we can query other tables (v_cbb_input_values)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: testGames, error: testGamesError } = await supabase
      .from('v_cbb_input_values')
      .select('home_team_id, away_team_id')
      .limit(3);
    
    if (testGamesError) {
      console.error('❌ Cannot query v_cbb_input_values:', testGamesError);
    } else {
      console.log('✅ Can query v_cbb_input_values:', testGames?.length || 0, 'rows');
      if (testGames && testGames.length > 0) {
        console.log('Sample team IDs from games:', testGames.map(g => ({ home: g.home_team_id, away: g.away_team_id })));
      }
    }

    // Test 1: Query all columns with limit
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Query all columns (limit 5)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: allData, error: allError } = await supabase
      .from('ncaab_team_mapping')
      .select('*')
      .limit(5);

    if (allError) {
      console.error('❌ Error:', allError);
      console.error('Error code:', allError.code);
      console.error('Error message:', allError.message);
      console.error('Error details:', allError.details);
      console.error('Error hint:', allError.hint);
    } else {
      console.log('✅ Success! Found', allData?.length || 0, 'rows');
      if (allData && allData.length > 0) {
        console.log('\n📋 Column names:', Object.keys(allData[0]));
        console.log('\n📋 First row sample:');
        console.log(JSON.stringify(allData[0], null, 2));
      }
    }

    // Test 2: Query specific columns we need
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Query api_team_id and espn_team_url (limit 10)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: specificData, error: specificError } = await supabase
      .from('ncaab_team_mapping')
      .select('api_team_id, espn_team_url')
      .limit(10);

    if (specificError) {
      console.error('❌ Error:', specificError);
      console.error('Error code:', specificError.code);
      console.error('Error message:', specificError.message);
    } else {
      console.log('✅ Success! Found', specificData?.length || 0, 'rows');
      if (specificData && specificData.length > 0) {
        console.log('\n📋 Sample rows:');
        specificData.slice(0, 5).forEach((row, idx) => {
          console.log(`  Row ${idx + 1}:`, row);
        });
        
        // Check for null/undefined values
        const withNullIds = specificData.filter(r => r.api_team_id === null || r.api_team_id === undefined);
        const withNullUrls = specificData.filter(r => !r.espn_team_url || r.espn_team_url.trim() === '');
        console.log(`\n⚠️  Rows with null api_team_id: ${withNullIds.length}`);
        console.log(`⚠️  Rows with empty espn_team_url: ${withNullUrls.length}`);
      }
    }

    // Test 3: Count total rows
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Count total rows');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { count, error: countError } = await supabase
      .from('ncaab_team_mapping')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting:', countError);
    } else {
      console.log('✅ Total rows in table:', count);
    }

    // Test 4: Check for specific team IDs that we know exist from the game data
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: Check for specific team IDs (1, 20, 56, 98, 101, 115, 118, 235, 288)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const testIds = [1, 20, 56, 98, 101, 115, 118, 235, 288];
    const { data: testIdData, error: testIdError } = await supabase
      .from('ncaab_team_mapping')
      .select('api_team_id, espn_team_url, api_team_name')
      .in('api_team_id', testIds);

    if (testIdError) {
      console.error('❌ Error:', testIdError);
    } else {
      console.log('✅ Found', testIdData?.length || 0, 'matching rows');
      if (testIdData && testIdData.length > 0) {
        testIdData.forEach(row => {
          console.log(`  ✅ ID ${row.api_team_id}: ${row.api_team_name} - ${row.espn_team_url || 'NO URL'}`);
        });
        
        const foundIds = testIdData.map(r => r.api_team_id);
        const missingIds = testIds.filter(id => !foundIds.includes(id));
        if (missingIds.length > 0) {
          console.log(`\n⚠️  Missing IDs: ${missingIds.join(', ')}`);
        }
      }
    }

    console.log('\n✅ Diagnosis complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

diagnoseTable();

