const https = require('https');

const chatEndpoint = 'https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae';

const requestBody = {
  message: "Hello, what's the weather like?",
  conversationHistory: [],
};

console.log('🚀 Testing WagerBot streaming endpoint...');
console.log('📤 Sending request to:', chatEndpoint);
console.log('📦 Payload:', JSON.stringify(requestBody, null, 2));
console.log('');

const url = new URL(chatEndpoint);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  console.log('📥 Response status:', res.statusCode);
  console.log('📥 Response headers:', JSON.stringify(res.headers, null, 2));
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 STREAMING DATA:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let totalBytes = 0;
  let chunkCount = 0;
  let fullContent = '';
  
  res.on('data', (chunk) => {
    chunkCount++;
    const text = chunk.toString();
    totalBytes += chunk.length;
    fullContent += text;
    
    console.log(`\n[Chunk #${chunkCount}] ${chunk.length} bytes:`);
    console.log(`  "${text.replace(/\n/g, '\\n')}"`);
  });
  
  res.on('end', () => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Total chunks: ${chunkCount}`);
    console.log(`  Total bytes: ${totalBytes}`);
    console.log(`  Content length: ${fullContent.length} chars`);
    console.log('');
    console.log('📄 FULL RESPONSE:');
    console.log(fullContent);
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(JSON.stringify(requestBody));
req.end();
