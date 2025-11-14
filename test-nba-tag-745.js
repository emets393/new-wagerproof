// Test NBA using tag_id 745
const BASE_URL = 'https://gamma-api.polymarket.com';

function parseTeamsFromTitle(title) {
  if (!title) return null;
  if (title.includes(' vs. ')) {
    const [away, home] = title.split(' vs. ').map(s => s.trim());
    if (away && home) return { awayTeam: away, homeTeam: home };
  } else if (title.includes(' @ ')) {
    const [away, home] = title.split(' @ ').map(s => s.trim());
    if (away && home) return { awayTeam: away, homeTeam: home };
  }
  return null;
}

async function testNBATag745() {
  console.log('\n' + '='.repeat(70));
  console.log('🏀 TESTING NBA WITH tag_id=745');
  console.log('='.repeat(70) + '\n');
  
  const tagId = '745';
  const url = `${BASE_URL}/events?tag_id=${tagId}&closed=false&limit=100`;
  
  console.log(`📡 API Call:`);
  console.log(`   ${url}\n`);
  
  try {
    const response = await fetch(url);
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      console.log(`❌ Error: HTTP ${response.status}`);
      const errorText = await response.text();
      console.log(`   Response: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    
    // Extract events
    let allEvents = [];
    if (Array.isArray(data)) {
      allEvents = data;
    } else if (data.events && Array.isArray(data.events)) {
      allEvents = data.events;
    } else if (data.data && Array.isArray(data.data)) {
      allEvents = data.data;
    }
    
    console.log(`✅ Fetched ${allEvents.length} total events\n`);
    
    // Show sample of what we got
    if (allEvents.length > 0) {
      console.log('📋 Sample Events (First 10):');
      console.log('─'.repeat(70));
      allEvents.slice(0, 10).forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.title || event.question || 'No title'}`);
        console.log(`   Slug: ${event.slug || 'N/A'}`);
        console.log(`   Closed: ${event.closed ? 'Yes' : 'No'}`);
        console.log(`   Active: ${event.active ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
    // Filter for games only (vs/@ pattern)
    console.log('🔍 Filtering for games (vs/@ pattern)...\n');
    const games = allEvents.filter(event => {
      const title = event.title || event.question || '';
      return parseTeamsFromTitle(title) !== null;
    });
    
    console.log(`📊 Results:`);
    console.log(`   Total Events: ${allEvents.length}`);
    console.log(`   Games Found: ${games.length}`);
    console.log(`   Filtered Out: ${allEvents.length - games.length}\n`);
    
    if (games.length === 0) {
      console.log('ℹ️  No active NBA games found');
      console.log('   This could mean:');
      console.log('   - No games scheduled right now');
      console.log('   - It\'s off-season');
      console.log('   - Games haven\'t been posted yet\n');
      return;
    }
    
    // Display games
    console.log('='.repeat(70));
    console.log(`🏀 NBA GAMES (${games.length} active)`);
    console.log('='.repeat(70) + '\n');
    
    games.slice(0, 20).forEach((game, idx) => {
      const teams = parseTeamsFromTitle(game.title);
      
      console.log(`Game ${idx + 1}: ${game.title}`);
      console.log('─'.repeat(70));
      
      if (teams) {
        console.log(`   Away: ${teams.awayTeam}`);
        console.log(`   Home: ${teams.homeTeam}`);
      }
      
      console.log(`   Slug: ${game.slug || 'N/A'}`);
      console.log(`   Date: ${game.eventDate || game.startDate || 'N/A'}`);
      console.log(`   Status: ${game.closed ? '🔴 Closed' : '🟢 Active'}`);
      
      if (game.markets && game.markets.length > 0) {
        console.log(`   Markets: ${game.markets.length}`);
        const market = game.markets[0];
        if (market.clobTokenIds) {
          try {
            const tokenIds = Array.isArray(market.clobTokenIds) 
              ? market.clobTokenIds 
              : JSON.parse(market.clobTokenIds);
            console.log(`   Token IDs: ${tokenIds.length} tokens`);
          } catch (e) {
            // Skip
          }
        }
      }
      
      console.log('');
    });
    
    if (games.length > 20) {
      console.log(`... and ${games.length - 20} more games`);
    }
    
    console.log('='.repeat(70));
    console.log('✅ Summary: Found ' + games.length + ' active NBA games');
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testNBATag745().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

