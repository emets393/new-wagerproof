#!/usr/bin/env node

/**
 * Fetch all college basketball teams from Polymarket using /teams API
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('===================================');
console.log('Fetching CBB Teams from Polymarket');
console.log('===================================\n');

async function fetchAllCBBTeams() {
  try {
    // Try with pagination to get all teams
    let allTeams = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    console.log('📡 Fetching CBB teams with pagination...\n');
    
    while (hasMore) {
      const url = `https://gamma-api.polymarket.com/teams?league=cbb&limit=${limit}&offset=${offset}`;
      console.log(`   Fetching offset ${offset}...`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-TestScript/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const teams = await response.json();
      
      if (teams.length === 0) {
        hasMore = false;
      } else {
        allTeams = [...allTeams, ...teams];
        console.log(`   ✅ Got ${teams.length} teams (total: ${allTeams.length})`);
        
        if (teams.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }
    }
    
    console.log(`\n✅ Found ${allTeams.length} total CBB teams\n`);
    
    // Display first 20 teams
    console.log('📋 Sample teams (first 20):\n');
    allTeams.slice(0, 20).forEach((team, idx) => {
      console.log(`${idx + 1}. ${team.name} (${team.abbreviation})`);
      console.log(`   ID: ${team.id}, League: ${team.league}`);
      if (team.logo) {
        console.log(`   Logo: ${team.logo.substring(0, 60)}...`);
      }
      console.log('');
    });
    
    // Search for Pittsburgh and West Virginia
    console.log('\n' + '='.repeat(80));
    console.log('Searching for Pittsburgh and West Virginia:');
    console.log('='.repeat(80) + '\n');
    
    const searchTerms = ['pitt', 'pittsburgh', 'west virginia', 'wvu', 'panthers', 'mountaineers'];
    
    searchTerms.forEach(term => {
      const matches = allTeams.filter(team => {
        const name = (team.name || '').toLowerCase();
        const abbrev = (team.abbreviation || '').toLowerCase();
        return name.includes(term.toLowerCase()) || abbrev.includes(term.toLowerCase());
      });
      
      if (matches.length > 0) {
        console.log(`🔍 "${term}":`);
        matches.forEach(team => {
          console.log(`   - ${team.name} (${team.abbreviation})`);
          console.log(`     ID: ${team.id}`);
        });
        console.log('');
      }
    });
    
    // Create a mapping of common names to Polymarket names
    console.log('\n' + '='.repeat(80));
    console.log('Team Name Mapping (for matching):');
    console.log('='.repeat(80) + '\n');
    
    // Find teams that might match our database teams
    const ourTeams = ['Pittsburgh', 'West Virginia', 'Purdue', 'Alabama', 'Michigan State'];
    
    ourTeams.forEach(ourTeam => {
      const matches = allTeams.filter(team => {
        const name = (team.name || '').toLowerCase();
        const abbrev = (team.abbreviation || '').toLowerCase();
        const ourTeamLower = ourTeam.toLowerCase();
        
        return name.includes(ourTeamLower) || 
               ourTeamLower.includes(name.split(' ')[0]) ||
               abbrev === ourTeamLower.substring(0, 3);
      });
      
      if (matches.length > 0) {
        console.log(`${ourTeam}:`);
        matches.forEach(team => {
          console.log(`   → ${team.name} (${team.abbreviation})`);
        });
      } else {
        console.log(`${ourTeam}: ❌ No match found`);
      }
    });
    
    // Save all teams to file
    const outputPath = join(__dirname, 'polymarket-cbb-teams.json');
    writeFileSync(outputPath, JSON.stringify(allTeams, null, 2));
    console.log(`\n💾 All ${allTeams.length} teams saved to: ${outputPath}`);
    
    // Create a simplified mapping file
    const mapping = allTeams.map(team => ({
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      league: team.league,
      logo: team.logo
    }));
    
    const mappingPath = join(__dirname, 'polymarket-cbb-teams-mapping.json');
    writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`💾 Team mapping saved to: ${mappingPath}`);
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`Total teams: ${allTeams.length}`);
    console.log(`Teams with logos: ${allTeams.filter(t => t.logo).length}`);
    console.log(`Unique abbreviations: ${new Set(allTeams.map(t => t.abbreviation)).size}`);
    
    return allTeams;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

fetchAllCBBTeams();

