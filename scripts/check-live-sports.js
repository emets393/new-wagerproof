// Script to check what sports are live right now
const SUPABASE_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ";

// ESPN API endpoints for different sports
const ESPN_ENDPOINTS = {
  'NFL': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'NCAAF': 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'NBA': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  'NCAAB': 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  'MLB': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  'NHL': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  'MLS': 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
  'EPL': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
};

async function checkESPNLiveGames(sport, endpoint) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      return { sport, live: 0, total: 0, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const events = data.events || [];
    
    let liveCount = 0;
    const liveGames = [];
    
    for (const event of events) {
      if (event.competitions && event.competitions.length > 0) {
        const competition = event.competitions[0];
        const status = competition.status?.type;
        const state = status?.state;
        
        if (state === 'in' || state === 'live') {
          liveCount++;
          const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
          const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
          
          liveGames.push({
            home: homeTeam?.team?.displayName || 'TBD',
            away: awayTeam?.team?.displayName || 'TBD',
            status: status?.shortDetail || status?.description || 'Live',
            period: competition.status?.period || null,
            clock: competition.status?.displayClock || null
          });
        }
      }
    }
    
    return {
      sport,
      live: liveCount,
      total: events.length,
      games: liveGames
    };
  } catch (error) {
    return { sport, live: 0, total: 0, error: error.message };
  }
}

async function checkDatabaseLiveGames() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/live_scores?is_live=eq.true&select=league,away_team,home_team,away_score,home_score,status,period,time_remaining`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    // Group by league
    const byLeague = {};
    for (const game of data) {
      if (!byLeague[game.league]) {
        byLeague[game.league] = [];
      }
      byLeague[game.league].push(game);
    }
    
    return byLeague;
  } catch (error) {
    return { error: error.message };
  }
}

async function main() {
  console.log('🏈 Checking Live Sports...\n');
  console.log('='.repeat(60));
  
  // Check database first
  console.log('\n📊 Current Database Status:');
  const dbGames = await checkDatabaseLiveGames();
  if (dbGames.error) {
    console.log(`   ❌ Error: ${dbGames.error}`);
  } else {
    const leagues = Object.keys(dbGames);
    if (leagues.length === 0) {
      console.log('   ℹ️  No live games in database');
    } else {
      for (const league of leagues) {
        console.log(`\n   ${league}: ${dbGames[league].length} live game(s)`);
        dbGames[league].forEach(game => {
          console.log(`      • ${game.away_team} @ ${game.home_team} (${game.away_score}-${game.home_score}) ${game.period || ''} ${game.time_remaining || ''}`);
        });
      }
    }
  }
  
  // Check ESPN API for all sports
  console.log('\n\n🌐 Checking ESPN API for Live Games:');
  console.log('='.repeat(60));
  
  const results = await Promise.all(
    Object.entries(ESPN_ENDPOINTS).map(([sport, endpoint]) =>
      checkESPNLiveGames(sport, endpoint)
    )
  );
  
  let hasLiveGames = false;
  for (const result of results) {
    if (result.error) {
      console.log(`\n${result.sport}: ❌ ${result.error}`);
    } else if (result.live > 0) {
      hasLiveGames = true;
      console.log(`\n${result.sport}: ✅ ${result.live} LIVE game(s) out of ${result.total} total`);
      result.games.forEach(game => {
        console.log(`   • ${game.away} @ ${game.home}`);
        console.log(`     ${game.status} ${game.period ? `(${game.period})` : ''} ${game.clock ? `- ${game.clock}` : ''}`);
      });
    } else {
      console.log(`${result.sport}: ⚪ ${result.total} game(s) scheduled, none live`);
    }
  }
  
  if (!hasLiveGames) {
    console.log('\n\nℹ️  No live games found across any sports at this time.');
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);

