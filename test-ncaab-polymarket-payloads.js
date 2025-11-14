#!/usr/bin/env node

/**
 * Test script to fetch and display NCAAB Polymarket data payloads locally
 * This script directly calls Polymarket APIs (no CORS issues in Node.js)
 * 
 * Usage:
 *   node test-ncaab-polymarket-payloads.js
 * 
 * What it does:
 *   1. Fetches sports metadata to find NCAAB tag IDs
 *   2. Fetches NCAAB events from Polymarket
 *   3. Tests matching with database games (if Supabase credentials are set)
 *   4. Fetches price history for a sample market
 *   5. Saves full payload to ncaab-polymarket-payloads.json
 * 
 * Environment variables (optional, for database matching test):
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 * 
 * Output:
 *   - Console output with detailed payload information
 *   - ncaab-polymarket-payloads.json file with full event data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('===================================');
console.log('NCAAB Polymarket Payload Test');
console.log('===================================\n');

// Helper function to fetch from Polymarket API directly
async function fetchPolymarketAPI(endpoint, options = {}) {
  const url = `https://gamma-api.polymarket.com${endpoint}`;
  console.log(`📡 Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-TestScript/1.0',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error fetching ${endpoint}:`, error.message);
    throw error;
  }
}

// Step 1: Get sports metadata to find NCAAB tag ID
async function getSportsMetadata() {
  console.log('\n📊 Step 1: Fetching sports metadata...');
  console.log('─'.repeat(50));
  
  try {
    const sports = await fetchPolymarketAPI('/sports');
    
    console.log(`✅ Found ${sports.length} sports\n`);
    
    // Find NCAAB/CBB
    const ncaabSport = sports.find(s => 
      s.sport?.toLowerCase() === 'ncaab' || 
      s.sport?.toLowerCase() === 'cbb' ||
      s.sport?.toLowerCase() === 'college basketball'
    );
    
    if (ncaabSport) {
      console.log('🏀 NCAAB Sport Found:');
      console.log(JSON.stringify(ncaabSport, null, 2));
      
      // Extract tag IDs
      const tags = ncaabSport.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const primaryTagId = tags.find(t => t !== '1') || tags[0];
      const allTagIds = tags.filter(t => t !== '1'); // Exclude generic tag "1"
      
      console.log(`\n📌 Primary Tag ID: ${primaryTagId}`);
      console.log(`📌 All Tag IDs (excluding generic): ${allTagIds.join(', ')}`);
      console.log(`📌 All Tags: ${tags.join(', ')}`);
      
      return { primaryTagId, allTagIds };
    } else {
      console.log('⚠️ NCAAB sport not found. Available sports:');
      sports.forEach(s => {
        console.log(`  - ${s.sport} (tags: ${s.tags})`);
      });
      return { primaryTagId: null, allTagIds: [] };
    }
  } catch (error) {
    console.error('❌ Failed to get sports metadata:', error);
    return null;
  }
}

// Step 2: Get NCAAB events
async function getNCAABEvents(tagIdOrObject) {
  console.log('\n📊 Step 2: Fetching NCAAB events...');
  console.log('─'.repeat(50));
  
  // Handle both single tagId and object with multiple tagIds
  let tagIds = [];
  if (typeof tagIdOrObject === 'string') {
    tagIds = [tagIdOrObject];
  } else if (tagIdOrObject && tagIdOrObject.allTagIds) {
    tagIds = tagIdOrObject.allTagIds;
  } else if (tagIdOrObject && tagIdOrObject.primaryTagId) {
    tagIds = [tagIdOrObject.primaryTagId];
  }
  
  if (tagIds.length === 0) {
    console.log('❌ No tag IDs provided, skipping events fetch');
    return [];
  }

  try {
    // Try each tag ID to find events
    let allEvents = [];
    
    for (const tagId of tagIds) {
      console.log(`\n🔍 Trying tag ID: ${tagId}`);
      const params = new URLSearchParams({
        tag_id: tagId,
        closed: 'false',
        limit: '100',
        related_tags: 'true',
      });

      const events = await fetchPolymarketAPI(`/events?${params.toString()}`);
      
      // Handle both array and object responses
      const eventsArray = Array.isArray(events) ? events : (events.events || events.data || []);
      
      console.log(`   Found ${eventsArray.length} events with tag ${tagId}`);
      
      // Filter for NCAAB-related events only (check title/slug for basketball keywords)
      if (tagId === '100639') {
        // Tag 100639 seems to be a broader tag, filter for basketball
        const ncaabKeywords = ['basketball', 'ncaab', 'cbb', 'college', 'march madness', 'ncaa'];
        const filtered = eventsArray.filter(event => {
          const title = (event.title || '').toLowerCase();
          const slug = (event.slug || '').toLowerCase();
          return ncaabKeywords.some(keyword => title.includes(keyword) || slug.includes(keyword));
        });
        console.log(`   Filtered to ${filtered.length} NCAAB-related events`);
        if (filtered.length > 0) {
          allEvents = [...allEvents, ...filtered];
        }
      } else {
        // For tag 100149 (primary NCAAB tag), include all events
        if (eventsArray.length > 0) {
          allEvents = [...allEvents, ...eventsArray];
        }
      }
    }
    
    // Remove duplicates based on slug
    const uniqueEvents = [];
    const seenSlugs = new Set();
    for (const event of allEvents) {
      if (event.slug && !seenSlugs.has(event.slug)) {
        seenSlugs.add(event.slug);
        uniqueEvents.push(event);
      } else if (!event.slug) {
        uniqueEvents.push(event); // Include events without slugs
      }
    }
    
    const eventsArray = uniqueEvents;
    console.log(`\n✅ Total unique NCAAB events found: ${eventsArray.length}\n`);
    
    if (eventsArray.length > 0) {
      console.log('📋 Sample Events (first 5):');
      eventsArray.slice(0, 5).forEach((event, idx) => {
        console.log(`\n${idx + 1}. ${event.title || event.slug}`);
        console.log(`   Slug: ${event.slug}`);
        console.log(`   Markets: ${event.markets?.length || 0}`);
        if (event.game_start_time || event.gameStartTime) {
          console.log(`   Game Start: ${event.game_start_time || event.gameStartTime}`);
        }
        
        // Show market details
        if (event.markets && event.markets.length > 0) {
          console.log(`   Market Types:`);
          event.markets.slice(0, 3).forEach(market => {
            console.log(`     - ${market.question || market.slug}`);
            console.log(`       Active: ${market.active}, Closed: ${market.closed}`);
            if (market.tokens) {
              console.log(`       Tokens: ${JSON.stringify(market.tokens)}`);
            }
            if (market.clobTokenIds) {
              console.log(`       CLOB Token IDs: ${JSON.stringify(market.clobTokenIds)}`);
            }
          });
        }
      });
      
      // Save full payload to file
      const fs = await import('fs');
      const outputPath = join(__dirname, 'ncaab-polymarket-payloads.json');
      fs.writeFileSync(outputPath, JSON.stringify(eventsArray, null, 2));
      console.log(`\n💾 Full payload saved to: ${outputPath}`);
    }
    
    return eventsArray;
  } catch (error) {
    console.error('❌ Failed to get NCAAB events:', error);
    return [];
  }
}

// Step 3: Test matching with actual NCAAB games from database
async function testMatchingWithDatabaseGames(events) {
  console.log('\n📊 Step 3: Testing matching with database games...');
  console.log('─'.repeat(50));
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('⚠️ Supabase credentials not found, skipping database matching test');
    console.log('   Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
    return;
  }

  if (events.length === 0) {
    console.log('⚠️ No events to match against');
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Fetch a few NCAAB games
    const { data: games, error } = await supabase
      .from('v_cbb_input_values')
      .select('away_team, home_team, game_date_et')
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching games:', error);
      return;
    }
    
    if (!games || games.length === 0) {
      console.log('⚠️ No games found in database');
      return;
    }
    
    console.log(`\n🔍 Testing matching for ${games.length} games:\n`);
    
    // Simple matching function (similar to polymarketService)
    const parseTeamsFromTitle = (title) => {
      if (!title) return null;
      if (title.includes(' vs. ')) {
        const [away, home] = title.split(' vs. ').map(s => s.trim());
        return { awayTeam: away, homeTeam: home };
      } else if (title.includes(' @ ')) {
        const [away, home] = title.split(' @ ').map(s => s.trim());
        return { awayTeam: away, homeTeam: home };
      }
      return null;
    };
    
    const cleanTeamName = (name) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    games.forEach((game, idx) => {
      console.log(`${idx + 1}. ${game.away_team} @ ${game.home_team}`);
      
      let matched = false;
      for (const event of events) {
        const parsedTeams = parseTeamsFromTitle(event.title);
        if (!parsedTeams) continue;
        
        const eventAway = cleanTeamName(parsedTeams.awayTeam);
        const eventHome = cleanTeamName(parsedTeams.homeTeam);
        const gameAway = cleanTeamName(game.away_team);
        const gameHome = cleanTeamName(game.home_team);
        
        // Check if teams match (either direction)
        const awayMatch = eventAway.includes(gameAway) || gameAway.includes(eventAway);
        const homeMatch = eventHome.includes(gameHome) || gameHome.includes(eventHome);
        
        const awayMatchReversed = eventHome.includes(gameAway) || gameAway.includes(eventHome);
        const homeMatchReversed = eventAway.includes(gameHome) || gameHome.includes(eventAway);
        
        if ((awayMatch && homeMatch) || (awayMatchReversed && homeMatchReversed)) {
          console.log(`   ✅ MATCHED: ${event.title}`);
          console.log(`      Markets: ${event.markets?.length || 0}`);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        console.log(`   ❌ No match found`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in matching test:', error);
  }
}

// Step 4: Get price history for a sample market
async function getSamplePriceHistory(events) {
  console.log('\n📊 Step 4: Fetching price history for sample market...');
  console.log('─'.repeat(50));
  
  if (events.length === 0) {
    console.log('⚠️ No events available for price history test');
    return;
  }
  
  // Find first active market with tokens
  let sampleMarket = null;
  for (const event of events) {
    if (event.markets && event.markets.length > 0) {
      for (const market of event.markets) {
        if (market.active && !market.closed) {
          // Try to extract token ID
          let tokenId = null;
          
          if (market.tokens && Array.isArray(market.tokens)) {
            const yesToken = market.tokens.find(t => (t.outcome || '').toLowerCase() === 'yes');
            tokenId = yesToken?.token_id;
          } else if (market.clobTokenIds) {
            if (Array.isArray(market.clobTokenIds) && market.clobTokenIds.length > 0) {
              tokenId = market.clobTokenIds[0];
            }
          }
          
          if (tokenId) {
            sampleMarket = { event, market, tokenId };
            break;
          }
        }
      }
      if (sampleMarket) break;
    }
  }
  
  if (!sampleMarket) {
    console.log('⚠️ No active market with token ID found');
    return;
  }
  
  console.log(`\n📈 Sample Market:`);
  console.log(`   Event: ${sampleMarket.event.title}`);
  console.log(`   Question: ${sampleMarket.market.question || sampleMarket.market.slug}`);
  console.log(`   Token ID: ${sampleMarket.tokenId}`);
  
  try {
    const params = new URLSearchParams({
      market: sampleMarket.tokenId,
      interval: 'max',
      fidelity: '60',
    });
    
    // prices-history is on clob.polymarket.com, not gamma-api
    const clobUrl = `https://clob.polymarket.com/prices-history?${params.toString()}`;
    console.log(`\n📡 Fetching price history from: ${clobUrl}`);
    
    const response = await fetch(clobUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WagerProof-TestScript/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const priceData = await response.json();
    
    const history = priceData?.history || [];
    console.log(`✅ Found ${history.length} price points`);
    
    if (history.length > 0) {
      console.log(`\n📊 Sample price points (first 5):`);
      history.slice(0, 5).forEach((point, idx) => {
        const date = new Date(point.t * 1000).toISOString();
        const price = (point.p * 100).toFixed(2);
        console.log(`   ${idx + 1}. ${date}: ${price}%`);
      });
      
      const latest = history[history.length - 1];
      console.log(`\n📊 Latest price: ${(latest.p * 100).toFixed(2)}%`);
    }
    
  } catch (error) {
    console.error('❌ Failed to get price history:', error.message);
  }
}

// Main execution
async function main() {
  try {
    // Step 1: Get sports metadata
    const tagData = await getSportsMetadata();
    
    // Step 2: Get NCAAB events
    const events = await getNCAABEvents(tagData);
    
    // Step 3: Test matching
    await testMatchingWithDatabaseGames(events);
    
    // Step 4: Get price history
    await getSamplePriceHistory(events);
    
    console.log('\n===================================');
    console.log('✅ Test Complete!');
    console.log('===================================');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();

