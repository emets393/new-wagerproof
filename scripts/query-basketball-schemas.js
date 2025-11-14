// Script to query NBA and NCAAB table schemas
// Run with: node scripts/query-basketball-schemas.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Get Supabase URL and key from environment or use defaults
const MAIN_SUPABASE_URL = process.env.SUPABASE_URL || 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
const MAIN_SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ';

// CFB Supabase project (basketball tables might be here too)
const CFB_SUPABASE_URL = 'https://jpxnjuwglavsjbgbasnl.supabase.co';
const CFB_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo';

const mainSupabase = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_KEY);
const cfbSupabase = createClient(CFB_SUPABASE_URL, CFB_SUPABASE_KEY);

async function queryTableSchema(tableName, supabaseClient, projectName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Querying schema for: ${tableName} (in ${projectName})`);
  console.log('='.repeat(80));
  
  try {
    // Try to get a sample row to understand structure
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`Error querying ${tableName}:`, error.message);
      console.error('Full error:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log(`⚠️  Table ${tableName} exists but has no data`);
      return null;
    }
    
    console.log(`\n✅ Sample row from ${tableName}:`);
    console.log(JSON.stringify(data[0], null, 2));
    
    // Extract column names and types from the sample
    const columns = Object.keys(data[0]);
    console.log(`\n📋 Columns (${columns.length} total):`);
    columns.forEach((col, idx) => {
      const value = data[0][col];
      const type = value === null ? 'null' : typeof value;
      const sample = value === null ? 'null' : 
                    typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : 
                    value;
      console.log(`  ${idx + 1}. ${col.padEnd(40)} [${type.padEnd(10)}] ${JSON.stringify(sample)}`);
    });
    
    return { columns, sample: data[0] };
  } catch (err) {
    console.error(`Exception querying ${tableName}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('🏀 Querying NBA and NCAAB Table Schemas');
  console.log('='.repeat(80));
  
  const tables = [
    'nba_input_values_view',
    'nba_predictions',
    'v_cbb_input_values',
    'ncaab_predictions'
  ];
  
  const results = {};
  
  // Try each table in both Supabase projects
  for (const table of tables) {
    // Try main Supabase first
    let result = await queryTableSchema(table, mainSupabase, 'Main Supabase');
    if (!result) {
      // Try CFB Supabase
      result = await queryTableSchema(table, cfbSupabase, 'CFB Supabase');
    }
    
    if (result) {
      results[table] = result;
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 Summary');
  console.log('='.repeat(80));
  
  for (const [table, result] of Object.entries(results)) {
    console.log(`\n${table}:`);
    console.log(`  Columns: ${result.columns.length}`);
    console.log(`  Key fields: ${result.columns.slice(0, 10).join(', ')}${result.columns.length > 10 ? '...' : ''}`);
  }
  
  // Write results to JSON file for reference
  fs.writeFileSync(
    'basketball-schemas.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n✅ Results saved to basketball-schemas.json');
}

main().catch(console.error);

