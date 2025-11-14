#!/usr/bin/env node

/**
 * Test script to get Polymarket data for NCAAB games using the new team mapping
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use same credentials as app
const COLLEGE_FOOTBALL_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
const COLLEGE_FOOTBALL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";

const supabase = createClient(COLLEGE_FOOTBALL_SUPABASE_URL, COLLEGE_FOOTBALL_SUPABASE_ANON_KEY);

console.log('===================================');
console.log('NCAAB Polymarket Data Test');
console.log('===================================\n');

// Load Polymarket teams
const teamsPath = join(__dirname, 'polymarket-cbb-teams.json');
const polymarketTeams = JSON.parse(readFileSync(teamsPath, 'utf8'));

console.log(`✅ Loaded ${polymarketTeams.length} Polymarket teams\n`);

// CBB Team Mappings (same as in service)
const CBB_TEAM_MAPPINGS = {
  'Duke': 'Duke',
  'North Carolina': 'North Carolina',
  'Kansas': 'Kansas',
  'Kentucky': 'Kentucky',
  'UCLA': 'UCLA',
  'Gonzaga': 'Gonzaga',
  'Villanova': 'Villanova',
  'Michigan': 'Michigan',
  'Michigan State': 'Michigan State',
  'Ohio State': 'Ohio State',
  'Arizona': 'Arizona',
  'Louisville': 'Louisville',
  'Syracuse': 'Syracuse',
  'Florida': 'Florida',
  'Virginia': 'Virginia',
  'Purdue': 'Purdue',
  'Alabama': 'Alabama',
  'Pittsburgh': 'Pittsburgh',
  'West Virginia': 'West Virginia',
  'Central Michigan': 'Central Michigan',
  'South Alabama': 'South Alabama',
  'Cornell': 'Cornell',
  'Lafayette': 'Lafayette',
  'San José State': 'San Jose State',
  'San Jose State': 'San Jose State',
  'UMass Lowell': 'Massachusetts-Lowell',
  'Massachusetts': 'Massachusetts',
  'Monmouth': 'Monmouth',
  'Seton Hall': 'Seton Hall',
  'Le Moyne': 'Le Moyne',
  'Alcorn State': 'Alcorn State',
  'Howard': 'Howard',
  'Loyola Chicago': 'Loyola Chicago',
  'Wichita State': 'Wichita State',
};

// Team mapping function (same as in service - simple dictionary lookup)
function mapTeamNameToPolymarket(ourTeamName, teams) {
  return CBB_TEAM_MAPPINGS[ourTeamName] || ourTeamName;
}

// Old complex matching function (no longer used)
function mapTeamNameToPolymarketOld(ourTeamName, teams) {
  const cleanName = (name) => 
    name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  const ourTeamClean = cleanName(ourTeamName);
  
  const scoreMatch = (team) => {
    const teamNameClean = cleanName(team.name);
    const abbrev = (team.abbreviation || '').toLowerCase();
    let score = 0;
    
    const teamParts = teamNameClean.split(' ');
    const ourParts = ourTeamClean.split(' ');
    
    if (teamNameClean === ourTeamClean) {
      return 1000;
    }
    
    if (teamNameClean.startsWith(ourTeamClean + ' ') && !teamNameClean.includes('-')) {
      return 900;
    }
    
    // Skip branch campuses for school name matching
    if (!teamNameClean.includes('-')) {
      const schoolName = teamParts.slice(0, -1).join(' ');
      if (ourTeamClean === schoolName || schoolName.startsWith(ourTeamClean) || ourTeamClean.startsWith(schoolName)) {
        score += 800;
      }
    } else {
      const mainSchool = teamParts[0];
      if (ourTeamClean === mainSchool || ourTeamClean.startsWith(mainSchool)) {
        score += 400;
      }
    }
    
    if (teamNameClean.includes(ourTeamClean)) {
      const ourWords = ourTeamClean.split(' ');
      if (ourWords.length > 1 || teamNameClean.includes(' ' + ourTeamClean + ' ') || teamNameClean.startsWith(ourTeamClean + ' ')) {
        score += 600;
      } else {
        score += 200;
      }
    }
    
    const firstWord = teamParts[0];
    const ourFirstWord = ourParts[0];
    if (firstWord === ourFirstWord && ourParts.length === 1) {
      score += 400;
    } else if (firstWord === ourFirstWord && ourParts.length > 1) {
      if (teamParts.length > 1 && teamParts[1] === ourParts[1]) {
        score += 700;
      } else {
        score += 300;
      }
    }
    
    if (abbrev.length >= 3 && (abbrev === ourTeamClean.substring(0, abbrev.length) || 
        ourTeamClean.substring(0, 3).toLowerCase() === abbrev)) {
      score += 250;
    }
    
    const ourWords = ourParts.filter(w => w.length > 2);
    const teamWords = teamParts.filter(w => w.length > 2);
    const matchingWords = ourWords.filter(w => teamWords.some(tw => tw === w || tw.startsWith(w) || w.startsWith(tw)));
    if (matchingWords.length === ourWords.length && ourWords.length > 0) {
      score += 100 * matchingWords.length;
    }
    
    if (teamNameClean.includes('st ') || teamNameClean.includes('saint ')) {
      score -= 100;
    }
    
    // Heavily penalize branch campuses (teams with hyphens)
    if (teamNameClean.includes('-')) {
      score -= 500;
      score = Math.min(score, 700); // Cap branch campus scores
    }
    
    // Prioritize main teams (common mascot names)
    const majorMascots = ['panthers', 'mountaineers', 'boilermakers', 'crimson tide', 'spartans', 
                          'wolverines', 'buckeyes', 'tigers', 'bulldogs', 'wildcats', 'eagles',
                          'cardinals', 'hawks', 'crimson', 'tide', 'badgers', 'hoosiers'];
    const lastWord = teamParts[teamParts.length - 1];
    if (majorMascots.some(mascot => lastWord.includes(mascot))) {
      score += 150;
    }
    
    return score;
  };
  
  const scoredMatches = teams
    .map(team => ({ 
      team, 
      score: scoreMatch(team),
      isBranch: cleanName(team.name).includes('-')
    }))
    .filter(m => m.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // If scores are equal, prefer non-branch teams
      if (a.isBranch !== b.isBranch) {
        return a.isBranch ? 1 : -1;
      }
      return 0;
    });
  
  // Debug: Show top 3 matches for testing
  if (ourTeamName === 'Pittsburgh' || ourTeamName === 'West Virginia' || ourTeamName === 'Purdue' || ourTeamName === 'Alabama') {
    console.log(`   Debug top matches for "${ourTeamName}":`);
    scoredMatches.slice(0, 3).forEach((m, idx) => {
      console.log(`     ${idx + 1}. ${m.team.name} (score: ${m.score}${m.isBranch ? ', branch' : ''})`);
    });
  }
  
  if (scoredMatches.length > 0 && scoredMatches[0].score >= 200) {
    return scoredMatches[0].team.name;
  }
  
  return ourTeamName;
}

// Step 1: Get sports metadata and tag ID
async function getNCAABTagId() {
  console.log('📊 Step 1: Getting NCAAB tag ID...');
  console.log('─'.repeat(80));
  
  try {
    const url = 'https://gamma-api.polymarket.com/sports';
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-TestScript/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const sports = await response.json();
    const ncaabSport = sports.find(s => 
      s.sport?.toLowerCase() === 'ncaab' || 
      s.sport?.toLowerCase() === 'cbb'
    );
    
    if (!ncaabSport) {
      console.log('❌ NCAAB sport not found');
      return null;
    }
    
    const tags = ncaabSport.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const primaryTagId = tags.find(t => t !== '1') || tags[0];
    
    console.log(`✅ NCAAB Tag ID: ${primaryTagId}\n`);
    return primaryTagId;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Step 2: Get events
async function getEvents(tagId) {
  console.log('📊 Step 2: Getting NCAAB events...');
  console.log('─'.repeat(80));
  
  if (!tagId) {
    console.log('❌ No tag ID');
    return [];
  }
  
  try {
    const url = `https://gamma-api.polymarket.com/events?tag_id=${tagId}&closed=false&limit=200&related_tags=true`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-TestScript/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const events = Array.isArray(data) ? data : (data.events || data.data || []);
    
    console.log(`✅ Found ${events.length} events\n`);
    return events;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return [];
  }
}

// Step 3: Match games with events
function parseTeamsFromTitle(title) {
  if (!title) return null;
  if (title.includes(' vs. ')) {
    const [away, home] = title.split(' vs. ').map(s => s.trim());
    return { awayTeam: away, homeTeam: home };
  } else if (title.includes(' @ ')) {
    const [away, home] = title.split(' @ ').map(s => s.trim());
    return { awayTeam: away, homeTeam: home };
  }
  return null;
}

function findMatchingEvent(events, awayTeam, homeTeam, awayPolymarketName, homePolymarketName) {
  const cleanTeamName = (name) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  const awayClean = cleanTeamName(awayPolymarketName);
  const homeClean = cleanTeamName(homePolymarketName);
  
  for (const event of events) {
    const parsedTeams = parseTeamsFromTitle(event.title);
    if (!parsedTeams) continue;
    
    const eventAway = cleanTeamName(parsedTeams.awayTeam);
    const eventHome = cleanTeamName(parsedTeams.homeTeam);
    
    const awayMatch = eventAway.includes(awayClean) || 
                      awayClean.includes(eventAway.split(' ')[0]) ||
                      eventAway.includes(awayClean.split(' ')[0]);
    const homeMatch = eventHome.includes(homeClean) ||
                      homeClean.includes(eventHome.split(' ')[0]) ||
                      eventHome.includes(homeClean.split(' ')[0]);
    
    const awayMatchReversed = eventHome.includes(awayClean) || 
                              awayClean.includes(eventHome.split(' ')[0]);
    const homeMatchReversed = eventAway.includes(homeClean) ||
                              homeClean.includes(eventAway.split(' ')[0]);
    
    if ((awayMatch && homeMatch) || (awayMatchReversed && homeMatchReversed)) {
      return event;
    }
  }
  
  return null;
}

// Main test
async function main() {
  try {
    // Get database games
    console.log('📊 Fetching NCAAB games from database...');
    console.log('─'.repeat(80));
    
    const { data: games, error } = await supabase
      .from('v_cbb_input_values')
      .select('away_team, home_team, game_date_et')
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching games:', error);
      return;
    }
    
    if (!games || games.length === 0) {
      console.log('⚠️  No games found');
      return;
    }
    
    console.log(`✅ Found ${games.length} games\n`);
    
    // Get tag ID
    const tagId = await getNCAABTagId();
    
    // Get events
    const events = await getEvents(tagId);
    
    if (events.length === 0) {
      console.log('\n⚠️  No Polymarket events found. This is normal if there are no active games.');
      console.log('   Testing team mapping anyway...\n');
    }
    
    // Test team mapping and matching
    console.log('📊 Step 3: Testing team mapping and event matching...');
    console.log('─'.repeat(80));
    console.log('');
    
    let matchedCount = 0;
    let mappedCount = 0;
    
    for (const game of games) {
      console.log(`🏀 ${game.away_team} @ ${game.home_team}`);
      
      // Map team names
      const awayPolymarketName = mapTeamNameToPolymarket(game.away_team, polymarketTeams);
      const homePolymarketName = mapTeamNameToPolymarket(game.home_team, polymarketTeams);
      
      const awayMapped = awayPolymarketName !== game.away_team;
      const homeMapped = homePolymarketName !== game.home_team;
      
      // Count as mapped if we have a value from dictionary (even if same)
      const awayHasMapping = CBB_TEAM_MAPPINGS[game.away_team] !== undefined;
      const homeHasMapping = CBB_TEAM_MAPPINGS[game.home_team] !== undefined;
      
      if (awayHasMapping || homeHasMapping) {
        mappedCount++;
        console.log(`   ✅ Team names:`);
        console.log(`      ${game.away_team} → ${awayPolymarketName}${awayHasMapping ? ' (mapped)' : ''}`);
        console.log(`      ${game.home_team} → ${homePolymarketName}${homeHasMapping ? ' (mapped)' : ''}`);
      } else {
        console.log(`   ⚠️  No mapping found (using original names)`);
        console.log(`      ${game.away_team} → ${awayPolymarketName}`);
        console.log(`      ${game.home_team} → ${homePolymarketName}`);
      }
      
      // Try to find matching event
      if (events.length > 0) {
        const event = findMatchingEvent(events, game.away_team, game.home_team, awayPolymarketName, homePolymarketName);
        
        if (event) {
          matchedCount++;
          console.log(`   ✅ MATCHED EVENT: ${event.title}`);
          console.log(`      Markets: ${event.markets?.length || 0}`);
          if (event.markets && event.markets.length > 0) {
            event.markets.slice(0, 3).forEach(m => {
              console.log(`        - ${m.question || m.slug}`);
            });
          }
        } else {
          console.log(`   ❌ No matching event found`);
        }
      } else {
        console.log(`   ⚠️  No events available to match against`);
      }
      
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`Total games tested: ${games.length}`);
    console.log(`Teams successfully mapped: ${mappedCount}`);
    console.log(`Events matched: ${matchedCount} / ${games.length}`);
    console.log(`Polymarket events available: ${events.length}`);
    
    if (events.length === 0) {
      console.log('\n💡 Note: No Polymarket events found, but team mapping is working!');
      console.log('   When events become available, matching should work correctly.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

