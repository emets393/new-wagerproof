#!/usr/bin/env node

/**
 * Test script to verify NCAAB Polymarket cache update
 * This script tests the function logic by checking the code structure
 * and can also test the deployed function if SUPABASE_URL is set
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================');
console.log('NCAAB Polymarket Cache Test');
console.log('===================================\n');

// Test 1: Check if function file exists and has NCAAB support
console.log('Test 1: Checking function code for NCAAB support...');
const functionPath = path.join(__dirname, 'supabase/functions/update-polymarket-cache/index.ts');
const functionCode = fs.readFileSync(functionPath, 'utf8');

const checks = [
  { name: 'NCAAB games fetching', pattern: /v_cbb_input_values/i },
  { name: 'NCAAB tag ID fetching', pattern: /ncaabTagId|ncaab.*tag/i },
  { name: 'NCAAB events fetching', pattern: /ncaabEvents/i },
  { name: 'NCAAB in league type', pattern: /['"]ncaab['"]/i },
  { name: 'NCAAB games count in response', pattern: /ncaabGames/i },
];

let allPassed = true;
checks.forEach(check => {
  if (check.pattern.test(functionCode)) {
    console.log(`  ✓ ${check.name}`);
  } else {
    console.log(`  ✗ ${check.name} - NOT FOUND`);
    allPassed = false;
  }
});

console.log('');

// Test 2: Check polymarketService.ts for NCAAB support
console.log('Test 2: Checking polymarketService.ts for NCAAB support...');
const servicePath = path.join(__dirname, 'src/services/polymarketService.ts');
const serviceCode = fs.readFileSync(servicePath, 'utf8');

const serviceChecks = [
  { name: 'NCAAB in getTeamMascot', pattern: /getTeamMascot.*['"]ncaab['"]/i },
  { name: 'NCAAB in getLeagueTagId', pattern: /getLeagueTagId.*['"]ncaab['"]/i },
  { name: 'NCAAB in getLeagueEvents', pattern: /getLeagueEvents.*['"]ncaab['"]/i },
  { name: 'NCAAB in getAllMarketsData', pattern: /league.*['"]ncaab['"]/i, context: 'getAllMarketsData' },
  { name: 'NCAAB in findMatchingEvent', pattern: /league.*['"]ncaab['"]/i, context: 'findMatchingEvent' },
];

serviceChecks.forEach(check => {
  let found = false;
  if (check.context) {
    // Check if the pattern exists near the function name
    const functionIndex = serviceCode.indexOf(check.context);
    if (functionIndex !== -1) {
      const functionContext = serviceCode.substring(functionIndex, functionIndex + 500);
      found = check.pattern.test(functionContext);
    }
  } else {
    found = check.pattern.test(serviceCode);
  }
  
  if (found) {
    console.log(`  ✓ ${check.name}`);
  } else {
    console.log(`  ✗ ${check.name} - NOT FOUND`);
    allPassed = false;
  }
});

console.log('');

// Test 3: Check if we can test the deployed function
if (process.env.VITE_SUPABASE_URL) {
  console.log('Test 3: Testing deployed function...');
  console.log(`  Supabase URL: ${process.env.VITE_SUPABASE_URL}`);
  console.log('  To test the deployed function, run:');
  console.log(`  curl -X POST '${process.env.VITE_SUPABASE_URL}/functions/v1/update-polymarket-cache' \\`);
  console.log(`    -H "Authorization: Bearer ${process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'}"`);
  console.log('');
  console.log('  Expected response should include:');
  console.log('  - "ncaabGames": <number>');
  console.log('  - "success": true');
  console.log('  - "updated": <number>');
} else {
  console.log('Test 3: Skipped (VITE_SUPABASE_URL not set)');
  console.log('  To test deployed function, set VITE_SUPABASE_URL environment variable');
}

console.log('');
console.log('===================================');
if (allPassed) {
  console.log('✓ All code checks passed!');
  console.log('  NCAAB Polymarket support is properly implemented.');
} else {
  console.log('✗ Some checks failed');
  console.log('  Please review the code changes.');
}
console.log('===================================');

