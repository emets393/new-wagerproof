#!/usr/bin/env node

/**
 * Test script to debug BuildShip streaming response
 * Run with: node test-buildship-stream.js
 */

const https = require('https');

const BUILDSHIP_URL = 'https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae';

// Test payload
const payload = {
  message: "Hello, test message",
  // conversationId: "thread_test123", // Uncomment to test with existing thread
  // SystemPrompt: "Test context" // Uncomment to test with context
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 BUILDSHIP STREAM TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📤 Sending request to:', BUILDSHIP_URL);
console.log('📦 Payload:', JSON.stringify(payload, null, 2));
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const url = new URL(BUILDSHIP_URL);
const postData = JSON.stringify(payload);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Accept': 'text/event-stream' // Tell server we want SSE
  }
};

const req = https.request(options, (res) => {
  console.log('📥 RESPONSE RECEIVED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Status Code:', res.statusCode);
  console.log('Status Message:', res.statusMessage);
  console.log('\n📋 HEADERS:');
  Object.entries(res.headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check for thread ID in header
  const threadId = res.headers['x-thread-id'];
  if (threadId) {
    console.log('✅ Thread ID from header:', threadId);
  } else {
    console.log('⚠️  No x-thread-id header found');
  }

  const contentType = res.headers['content-type'];
  console.log('📋 Content-Type:', contentType);
  console.log('\n🌊 STREAMING DATA:\n');

  let chunkCount = 0;
  let accumulatedData = '';
  let accumulatedText = '';

  res.on('data', (chunk) => {
    chunkCount++;
    const chunkStr = chunk.toString();
    accumulatedData += chunkStr;

    console.log(`\n📦 CHUNK #${chunkCount} (${chunk.length} bytes)`);
    console.log('─────────────────────────────────────────────────');
    console.log('Raw bytes (first 100):', chunk.slice(0, 100));
    console.log('As string:', chunkStr.substring(0, 200));
    
    // Try to parse as SSE
    if (chunkStr.includes('data: ')) {
      console.log('🔵 Detected SSE format');
      const lines = chunkStr.split('\n');
      lines.forEach((line, idx) => {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.substring(6);
            const eventData = JSON.parse(jsonStr);
            console.log(`  SSE Event #${idx}:`, JSON.stringify(eventData, null, 2));
            
            // Extract text
            if (eventData.delta?.content?.[0]?.text?.value) {
              const text = eventData.delta.content[0].text.value;
              accumulatedText += text;
              console.log(`  ✅ Extracted text: "${text}"`);
            }
            if (eventData.threadId) {
              console.log(`  ✅ Extracted threadId: ${eventData.threadId}`);
            }
          } catch (e) {
            console.log(`  ❌ Failed to parse JSON:`, e.message);
          }
        }
      });
    } else {
      console.log('🔵 Plain text format');
      accumulatedText += chunkStr;
    }
    
    console.log('─────────────────────────────────────────────────');
  });

  res.on('end', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ STREAM COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total chunks received: ${chunkCount}`);
    console.log(`Total data length: ${accumulatedData.length} bytes`);
    console.log(`\n📝 ACCUMULATED TEXT:\n${accumulatedText}`);
    console.log('\n📄 FULL RAW DATA (first 1000 chars):');
    console.log(accumulatedData.substring(0, 1000));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(accumulatedData);
      console.log('🔍 PARSED AS JSON:');
      console.log(JSON.stringify(jsonData, null, 2));
      
      // Check for stream buffer
      if (jsonData.stream?._readableState?.buffer) {
        console.log('\n⚠️  Response contains serialized stream object!');
        console.log('Buffer items:', jsonData.stream._readableState.buffer.length);
        
        jsonData.stream._readableState.buffer.forEach((item, idx) => {
          if (item.type === 'Buffer' && item.data) {
            const text = String.fromCharCode(...item.data);
            console.log(`\nBuffer item #${idx}:`, text.substring(0, 200));
          }
        });
      }
    } catch (e) {
      console.log('ℹ️  Not JSON format (expected for streaming)');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ REQUEST ERROR:', error);
});

// Send the request
req.write(postData);
req.end();

console.log('⏳ Waiting for response...\n');

