#!/usr/bin/env node

/**
 * Quick check if Polymarket has NCAAB events right now
 */

console.log('Checking Polymarket for NCAAB events...\n');

async function checkNCAABEvents() {
  try {
    // Step 1: Get sports metadata
    const sportsUrl = 'https://gamma-api.polymarket.com/sports';
    const sportsResp = await fetch(sportsUrl);
    const sports = await sportsResp.json();
    
    const ncaab = sports.find(s => 
      s.sport?.toLowerCase() === 'ncaab' || 
      s.sport?.toLowerCase() === 'cbb'
    );
    
    if (!ncaab) {
      console.log('❌ NCAAB sport not found in Polymarket');
      return;
    }
    
    console.log('✅ NCAAB sport found');
    console.log(`   Tags: ${ncaab.tags}\n`);
    
    // Step 2: Get events
    const tagIds = ncaab.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
    
    for (const tagId of tagIds) {
      console.log(`📊 Checking tag ${tagId}...`);
      const eventsUrl = `https://gamma-api.polymarket.com/events?tag_id=${tagId}&closed=false&limit=20&related_tags=true`;
      const eventsResp = await fetch(eventsUrl);
      const data = await eventsResp.json();
      const events = Array.isArray(data) ? data : (data.events || data.data || []);
      
      console.log(`   Found ${events.length} events`);
      
      if (events.length > 0) {
        console.log('   Sample events:');
        events.slice(0, 5).forEach((event, idx) => {
          console.log(`     ${idx + 1}. ${event.title}`);
        });
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkNCAABEvents();

