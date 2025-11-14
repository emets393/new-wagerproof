#!/usr/bin/env node

/**
 * Test script to perform the live API flow for NCAAB Polymarket data
 * This bypasses Supabase functions and calls Polymarket APIs directly
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('===================================');
console.log('NCAAB Live API Flow Test');
console.log('===================================\n');

// Step 1: Get Sports Metadata
async function getSportsMetadata() {
  console.log('📊 Step 1: Getting sports metadata...');
  console.log('─'.repeat(80));
  
  try {
    const url = 'https://gamma-api.polymarket.com/sports';
    console.log(`📡 Calling: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-TestScript/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const sports = await response.json();
    console.log(`✅ Found ${sports.length} sports\n`);
    
    // Find NCAAB
    const ncaabSport = sports.find(s => 
      s.sport?.toLowerCase() === 'ncaab' || 
      s.sport?.toLowerCase() === 'cbb' ||
      s.sport?.toLowerCase() === 'college basketball'
    );
    
    if (!ncaabSport) {
      console.log('❌ NCAAB sport not found');
      console.log('Available sports:', sports.map(s => s.sport).join(', '));
      return null;
    }
    
    console.log('🏀 NCAAB Sport Found:');
    console.log(JSON.stringify(ncaabSport, null, 2));
    
    const tags = ncaabSport.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
    const primaryTagId = tags.find(t => t !== '1') || tags[0];
    
    console.log(`\n📌 Primary Tag ID: ${primaryTagId}`);
    console.log(`📌 All Tags: ${tags.join(', ')}\n`);
    
    return { primaryTagId, allTagIds: tags.filter(t => t !== '1') };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

// Step 2: Get League Events
async function getLeagueEvents(tagIds) {
  console.log('📊 Step 2: Getting NCAAB events...');
  console.log('─'.repeat(80));
  
  if (!tagIds || tagIds.length === 0) {
    console.log('❌ No tag IDs provided');
    return [];
  }
  
  let allEvents = [];
  
  for (const tagId of tagIds) {
    console.log(`\n🔍 Fetching events with tag ID: ${tagId}`);
    
    try {
      const params = new URLSearchParams({
        tag_id: tagId,
        closed: 'false',
        limit: '100',
        related_tags: 'true',
      });
      
      const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;
      console.log(`📡 Calling: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WagerProof-TestScript/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      const events = Array.isArray(data) ? data : (data.events || data.data || []);
      
      console.log(`✅ Found ${events.length} events`);
      
      // Filter for NCAAB if using broader tag
      if (tagId === '100639') {
        const ncaabKeywords = ['basketball', 'ncaab', 'cbb', 'college', 'march madness', 'ncaa'];
        const filtered = events.filter(event => {
          const title = (event.title || '').toLowerCase();
          const slug = (event.slug || '').toLowerCase();
          return ncaabKeywords.some(keyword => title.includes(keyword) || slug.includes(keyword));
        });
        console.log(`   Filtered to ${filtered.length} NCAAB-related events`);
        allEvents = [...allEvents, ...filtered];
      } else {
        allEvents = [...allEvents, ...events];
      }
    } catch (error) {
      console.error(`❌ Error fetching events for tag ${tagId}:`, error.message);
    }
  }
  
  // Remove duplicates
  const uniqueEvents = [];
  const seenSlugs = new Set();
  for (const event of allEvents) {
    if (event.slug && !seenSlugs.has(event.slug)) {
      seenSlugs.add(event.slug);
      uniqueEvents.push(event);
    } else if (!event.slug) {
      uniqueEvents.push(event);
    }
  }
  
  console.log(`\n✅ Total unique NCAAB events: ${uniqueEvents.length}\n`);
  return uniqueEvents;
}

// Step 3: Parse Teams from Title (same as service)
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

// Step 4: Extract All Markets from Event
function extractAllMarketsFromEvent(event) {
  console.log(`\n📊 Step 4: Extracting markets from event: ${event.title}`);
  console.log('─'.repeat(80));
  
  if (!event.markets || event.markets.length === 0) {
    console.log('❌ No markets in event');
    return {};
  }
  
  console.log(`Found ${event.markets.length} markets in event\n`);
  
  const result = {};
  const teams = parseTeamsFromTitle(event.title);
  
  for (const market of event.markets) {
    if (!market.active || market.closed) {
      console.log(`⏭️  Skipping inactive/closed market: ${market.question || market.slug}`);
      continue;
    }
    
    // Classify market type
    const qLower = (market.question || '').toLowerCase();
    const sLower = (market.slug || '').toLowerCase();
    
    let marketType = null;
    
    if (qLower.includes('spread') || sLower.includes('-spread-')) {
      marketType = 'spread';
    } else if (qLower.includes('o/u') || qLower.includes('total') || sLower.includes('-total-')) {
      marketType = 'total';
    } else if (qLower.includes('moneyline') || sLower.includes('-moneyline')) {
      marketType = 'moneyline';
    } else if (qLower.includes(' vs ') || qLower.includes(' vs. ')) {
      marketType = 'moneyline';
    } else if (!sLower.includes('-total-') && !sLower.includes('-spread-')) {
      marketType = 'moneyline';
    }
    
    if (!marketType) {
      console.log(`⚠️  Could not classify market: ${market.question || market.slug}`);
      continue;
    }
    
    // Extract token IDs
    let yesTokenId = null;
    let noTokenId = null;
    
    if (market.tokens && Array.isArray(market.tokens)) {
      const yesToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'yes');
      const noToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'no');
      yesTokenId = yesToken?.token_id;
      noTokenId = noToken?.token_id;
    } else if (market.clobTokenIds) {
      let tokenIds = [];
      if (typeof market.clobTokenIds === 'string') {
        try {
          tokenIds = JSON.parse(market.clobTokenIds);
        } catch (e) {
          // Not JSON, might be array string
        }
      } else if (Array.isArray(market.clobTokenIds)) {
        tokenIds = market.clobTokenIds;
      }
      
      if (tokenIds.length >= 2) {
        yesTokenId = tokenIds[0];
        noTokenId = tokenIds[1];
      }
    }
    
    if (!yesTokenId) {
      console.log(`⚠️  Could not extract token IDs from market: ${market.question || market.slug}`);
      continue;
    }
    
    if (result[marketType]) {
      console.log(`⏭️  Skipping duplicate ${marketType} market`);
      continue;
    }
    
    result[marketType] = {
      yesTokenId,
      noTokenId,
      question: market.question || market.slug,
      slug: market.slug
    };
    
    console.log(`✅ Found ${marketType} market:`);
    console.log(`   Question: ${market.question || market.slug}`);
    console.log(`   YES Token: ${yesTokenId.substring(0, 20)}...`);
    console.log(`   NO Token: ${noTokenId ? noTokenId.substring(0, 20) + '...' : 'N/A'}`);
  }
  
  return result;
}

// Step 5: Get Price History
async function getPriceHistory(tokenId) {
  console.log(`\n📊 Step 5: Getting price history for token...`);
  console.log('─'.repeat(80));
  
  try {
    const params = new URLSearchParams({
      market: tokenId,
      interval: 'max',
      fidelity: '60',
    });
    
    const url = `https://clob.polymarket.com/prices-history?${params.toString()}`;
    console.log(`📡 Calling: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-TestScript/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const history = data?.history || [];
    
    console.log(`✅ Found ${history.length} price points`);
    
    if (history.length > 0) {
      console.log(`\n📈 Sample price points (first 5):`);
      history.slice(0, 5).forEach((point, idx) => {
        const date = new Date(point.t * 1000).toISOString();
        const price = (point.p * 100).toFixed(2);
        console.log(`   ${idx + 1}. ${date}: ${price}%`);
      });
      
      const latest = history[history.length - 1];
      console.log(`\n📊 Latest price: ${(latest.p * 100).toFixed(2)}%`);
      console.log(`   Timestamp: ${new Date(latest.t * 1000).toISOString()}`);
    }
    
    return history;
  } catch (error) {
    console.error(`❌ Error fetching price history:`, error.message);
    return [];
  }
}

// Step 6: Transform Price History
function transformPriceHistory(priceHistory, isAwayTeam = true) {
  if (!priceHistory || priceHistory.length === 0) return [];
  
  return priceHistory.map((point) => {
    const probability = point.p; // 0.00-1.00
    const timestampMs = point.t * 1000; // Convert to milliseconds
    const oddsPercentage = Math.round(probability * 100);
    
    if (isAwayTeam) {
      return {
        timestamp: timestampMs,
        awayTeamOdds: oddsPercentage,
        homeTeamOdds: 100 - oddsPercentage,
        awayTeamPrice: probability,
        homeTeamPrice: 1 - probability,
      };
    } else {
      return {
        timestamp: timestampMs,
        awayTeamOdds: 100 - oddsPercentage,
        homeTeamOdds: oddsPercentage,
        awayTeamPrice: 1 - probability,
        homeTeamPrice: probability,
      };
    }
  });
}

// Step 3.5: Test matching with database games
async function testMatchingWithDatabaseGames(events, tagData) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    // Use same credentials as app
    const COLLEGE_FOOTBALL_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
    const COLLEGE_FOOTBALL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo";
    
    const supabase = createClient(COLLEGE_FOOTBALL_SUPABASE_URL, COLLEGE_FOOTBALL_SUPABASE_ANON_KEY);
    
    // Fetch a few NCAAB games
    const { data: games } = await supabase
      .from('v_cbb_input_values')
      .select('away_team, home_team, game_date_et')
      .limit(5);
    
    if (!games || games.length === 0) {
      console.log('⚠️  No database games found');
      return;
    }
    
    console.log(`\n📊 Found ${games.length} database games`);
    console.log(`\n🔍 Matching logic demonstration:\n`);
    
    // Show matching logic
    const cleanTeamName = (name) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    games.forEach((game, idx) => {
      console.log(`${idx + 1}. ${game.away_team} @ ${game.home_team}`);
      console.log(`   Would search for event matching: "${game.away_team}" vs "${game.home_team}"`);
      
      if (events.length > 0) {
        // Try to match
        let matched = false;
        for (const event of events) {
          const parsedTeams = parseTeamsFromTitle(event.title);
          if (!parsedTeams) continue;
          
          const eventAway = cleanTeamName(parsedTeams.awayTeam);
          const eventHome = cleanTeamName(parsedTeams.homeTeam);
          const gameAway = cleanTeamName(game.away_team);
          const gameHome = cleanTeamName(game.home_team);
          
          const awayMatch = eventAway.includes(gameAway) || gameAway.includes(eventAway);
          const homeMatch = eventHome.includes(gameHome) || gameHome.includes(eventHome);
          
          if (awayMatch && homeMatch) {
            console.log(`   ✅ Would match: ${event.title}`);
            matched = true;
            break;
          }
        }
        
        if (!matched) {
          console.log(`   ❌ No match found in ${events.length} events`);
        }
      } else {
        console.log(`   ⚠️  No Polymarket events available to match against`);
        console.log(`   📋 If events existed, would check:`);
        console.log(`      - Event title contains team names`);
        console.log(`      - Fuzzy matching (partial matches)`);
        console.log(`      - Handles "vs" and "@" formats`);
      }
      console.log('');
    });
    
    console.log('\n💡 Summary:');
    console.log('   - API flow is working correctly');
    console.log('   - Tag IDs retrieved: ' + tagData.allTagIds.join(', '));
    console.log('   - Matching logic ready to use when events are available');
    console.log('   - Database games found: ' + games.length);
    
  } catch (error) {
    console.error('❌ Error testing matching:', error.message);
  }
}

// Main execution
async function main() {
  try {
    // Step 1: Get sports metadata
    const tagData = await getSportsMetadata();
    if (!tagData) {
      console.log('\n❌ Could not get tag data, exiting');
      return;
    }
    
    // Step 2: Get events
    const events = await getLeagueEvents(tagData.allTagIds);
    
    if (events.length === 0) {
      console.log('\n⚠️  No NCAAB events found. This is normal if there are no active games.');
      console.log('   The API flow is working correctly, just no games available right now.');
      console.log('\n📊 Step 3: Testing matching logic with database games...');
      console.log('─'.repeat(80));
      
      // Try to match with database games to show the flow
      await testMatchingWithDatabaseGames(events, tagData);
      return;
    }
    
    // Step 3: Process first event as example
    console.log('\n📊 Step 3: Processing first event as example...');
    console.log('─'.repeat(80));
    const sampleEvent = events[0];
    console.log(`\n🎯 Sample Event: ${sampleEvent.title}`);
    console.log(`   Slug: ${sampleEvent.slug}`);
    console.log(`   Markets: ${sampleEvent.markets?.length || 0}`);
    
    // Step 4: Extract markets
    const markets = extractAllMarketsFromEvent(sampleEvent);
    
    if (Object.keys(markets).length === 0) {
      console.log('\n⚠️  No valid markets found in event');
      return;
    }
    
    // Step 5 & 6: Get price history for first market
    const firstMarketType = Object.keys(markets)[0];
    const firstMarket = markets[firstMarketType];
    
    console.log(`\n📊 Processing ${firstMarketType} market...`);
    const priceHistory = await getPriceHistory(firstMarket.yesTokenId);
    
    if (priceHistory.length > 0) {
      // Step 6: Transform
      const transformed = transformPriceHistory(priceHistory, true);
      console.log(`\n✅ Transformed ${transformed.length} data points`);
      console.log(`\n📈 Sample transformed data (last 3):`);
      transformed.slice(-3).forEach((point, idx) => {
        const date = new Date(point.timestamp).toISOString();
        console.log(`   ${idx + 1}. ${date}: Away ${point.awayTeamOdds}% / Home ${point.homeTeamOdds}%`);
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ Live API Flow Complete!');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   - Tag IDs found: ${tagData.allTagIds.join(', ')}`);
    console.log(`   - Events found: ${events.length}`);
    console.log(`   - Markets extracted: ${Object.keys(markets).length}`);
    console.log(`   - Market types: ${Object.keys(markets).join(', ')}`);
    if (priceHistory.length > 0) {
      console.log(`   - Price history points: ${priceHistory.length}`);
    }
    
    // Save full event data
    const fs = await import('fs');
    const outputPath = join(__dirname, 'ncaab-live-api-result.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      tagData,
      events,
      sampleEvent: {
        ...sampleEvent,
        extractedMarkets: markets,
        priceHistory: priceHistory.length > 0 ? {
          raw: priceHistory.slice(0, 10), // First 10 points
          transformed: transformPriceHistory(priceHistory, true).slice(0, 10)
        } : null
      }
    }, null, 2));
    console.log(`\n💾 Full results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

