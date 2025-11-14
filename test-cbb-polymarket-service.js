#!/usr/bin/env node

/**
 * Test the actual polymarketService CBB_TEAM_MAPPINGS
 * This simulates what the NCAAB page would call
 */

import { readFileSync } from 'fs';

console.log('===================================');
console.log('Testing CBB Team Mappings Service');
console.log('===================================\n');

// Read the actual service file to check if CBB_TEAM_MAPPINGS exists
const servicePath = './src/services/polymarketService.ts';
const serviceContent = readFileSync(servicePath, 'utf8');

// Check if CBB_TEAM_MAPPINGS exists
if (serviceContent.includes('CBB_TEAM_MAPPINGS')) {
  console.log('✅ CBB_TEAM_MAPPINGS found in polymarketService.ts');
} else {
  console.log('❌ CBB_TEAM_MAPPINGS NOT found in polymarketService.ts');
  process.exit(1);
}

// Check if the function uses CBB_TEAM_MAPPINGS for ncaab
const ncaabCheckRegex = /if\s*\(\s*league\s*===\s*['"]ncaab['"]\s*\)\s*{\s*return\s*CBB_TEAM_MAPPINGS\[ourTeamName\]/;
if (ncaabCheckRegex.test(serviceContent)) {
  console.log('✅ mapTeamNameToPolymarket uses CBB_TEAM_MAPPINGS for ncaab');
} else {
  console.log('❌ mapTeamNameToPolymarket does NOT use CBB_TEAM_MAPPINGS for ncaab');
  console.log('   Checking what it does use...');
  
  // Find the ncaab handling
  const ncaabSection = serviceContent.match(/if\s*\(\s*league\s*===\s*['"]ncaab['"]\s*\)\s*{[^}]+}/);
  if (ncaabSection) {
    console.log('   Found NCAAB section:');
    console.log('   ' + ncaabSection[0].split('\n').join('\n   '));
  }
}

// Check some sample teams from CBB_TEAM_MAPPINGS
const sampleTeams = [
  'Pittsburgh',
  'West Virginia', 
  'Purdue',
  'Alabama',
  'Michigan State',
  'Central Michigan',
  'South Alabama'
];

console.log('\n📊 Checking sample team mappings in CBB_TEAM_MAPPINGS:');
sampleTeams.forEach(team => {
  const regex = new RegExp(`['"]${team}['"]:\\s*['"]([^'"]+)['"]`);
  const match = serviceContent.match(regex);
  if (match) {
    console.log(`✅ ${team} → ${match[1]}`);
  } else {
    console.log(`❌ ${team} not found`);
  }
});

// Check if there are any TODO or WIP comments about CBB
console.log('\n🔍 Checking for any CBB-related comments:');
const cbbComments = serviceContent.match(/\/\/.*(?:CBB|NCAAB|basketball).*$/gim);
if (cbbComments) {
  cbbComments.slice(0, 5).forEach(comment => {
    console.log(`   ${comment.trim()}`);
  });
}

console.log('\n✅ Test complete!');

