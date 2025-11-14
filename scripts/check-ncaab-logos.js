/**
 * Script to check NCAAB team logos availability
 * This script queries the ncaab_team_mapping table and v_cbb_input_values
 * to identify teams that are missing logos
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_COLLEGE_FOOTBALL_SUPABASE_URL;
const supabaseKey = process.env.VITE_COLLEGE_FOOTBALL_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNCAABLogos() {
  console.log('🏀 Checking NCAAB team logos...\n');

  try {
    // Fetch all team mappings
    const { data: teamMappings, error: mappingError } = await supabase
      .from('ncaab_team_mapping')
      .select('team_id, team_name, abbreviation, logo_url')
      .order('team_name');

    if (mappingError) {
      console.error('❌ Error fetching team mappings:', mappingError);
      return;
    }

    console.log(`📊 Total team mappings: ${teamMappings.length}\n`);

    // Fetch all unique teams from games
    const { data: games, error: gamesError } = await supabase
      .from('v_cbb_input_values')
      .select('away_team, home_team')
      .limit(1000); // Get a sample of recent games

    if (gamesError) {
      console.error('❌ Error fetching games:', gamesError);
      return;
    }

    // Get unique team names from games
    const teamNamesFromGames = new Set();
    games.forEach(game => {
      if (game.away_team) teamNamesFromGames.add(game.away_team);
      if (game.home_team) teamNamesFromGames.add(game.home_team);
    });

    console.log(`📈 Unique teams in games: ${teamNamesFromGames.size}\n`);

    // Check which teams have logos
    const teamsWithLogos = [];
    const teamsWithoutLogos = [];
    const teamsInGamesButNotInMapping = [];

    teamMappings.forEach(mapping => {
      const hasLogo = mapping.logo_url && 
                      mapping.logo_url !== '/placeholder.svg' && 
                      mapping.logo_url.trim() !== '' &&
                      !mapping.logo_url.includes('placeholder');

      if (hasLogo) {
        teamsWithLogos.push(mapping);
      } else {
        teamsWithoutLogos.push(mapping);
      }
    });

    // Check for teams in games but not in mapping
    teamNamesFromGames.forEach(teamName => {
      const found = teamMappings.find(m => 
        m.team_name === teamName ||
        m.team_name.toLowerCase() === teamName.toLowerCase()
      );
      if (!found) {
        teamsInGamesButNotInMapping.push(teamName);
      }
    });

    // Print summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Teams with logos: ${teamsWithLogos.length}`);
    console.log(`❌ Teams without logos: ${teamsWithoutLogos.length}`);
    console.log(`⚠️  Teams in games but not in mapping: ${teamsInGamesButNotInMapping.length}`);
    console.log('');

    // Print teams without logos
    if (teamsWithoutLogos.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ TEAMS WITHOUT LOGOS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      teamsWithoutLogos.forEach(team => {
        console.log(`  • ${team.team_name} (ID: ${team.team_id}, Abbr: ${team.abbreviation || 'N/A'})`);
      });
      console.log('');
    }

    // Print teams in games but not in mapping
    if (teamsInGamesButNotInMapping.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  TEAMS IN GAMES BUT NOT IN MAPPING:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      teamsInGamesButNotInMapping.forEach(team => {
        console.log(`  • ${team}`);
      });
      console.log('');
    }

    // Check for potential name mismatches
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHECKING FOR POTENTIAL NAME MISMATCHES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const mismatches = [];
    teamNamesFromGames.forEach(gameTeamName => {
      const exactMatch = teamMappings.find(m => m.team_name === gameTeamName);
      if (!exactMatch) {
        const partialMatch = teamMappings.find(m => {
          const lowerGame = gameTeamName.toLowerCase();
          const lowerMapping = m.team_name.toLowerCase();
          return lowerGame.includes(lowerMapping) || lowerMapping.includes(lowerGame);
        });
        if (partialMatch) {
          mismatches.push({
            gameTeam: gameTeamName,
            mappingTeam: partialMatch.team_name,
            hasLogo: partialMatch.logo_url && partialMatch.logo_url !== '/placeholder.svg'
          });
        }
      }
    });

    if (mismatches.length > 0) {
      mismatches.forEach(m => {
        console.log(`  ⚠️  "${m.gameTeam}" might match "${m.mappingTeam}" ${m.hasLogo ? '✅' : '❌'}`);
      });
    } else {
      console.log('  ✅ No obvious mismatches found');
    }

    console.log('\n✅ Logo check complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNCAABLogos();

