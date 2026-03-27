const SUPABASE_URL = 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ';

// Step 1: Sign in
const email = process.env.SUPABASE_EMAIL;
const pw = process.env.SUPABASE_PASSWORD;
if (!email || !pw) { console.error('Set SUPABASE_EMAIL and SUPABASE_PASSWORD'); process.exit(1); }

console.log('Signing in...');
const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
  body: JSON.stringify({ email, password: pw }),
});
if (!signIn.ok) { console.error('Sign-in failed:', await signIn.text()); process.exit(1); }
const { access_token } = await signIn.json();
console.log('Signed in.');

// Step 2: Call edge function
console.log('Calling get-gemini-key edge function...');
const res = await fetch(`${SUPABASE_URL}/functions/v1/get-gemini-key`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'apikey': ANON_KEY,
    'Content-Type': 'application/json',
  },
});
const body = await res.text();
console.log(`Status: ${res.status}`);
console.log(`Response: ${body}`);

try {
  const data = JSON.parse(body);
  if (data.key) {
    console.log(`Key starts with: ${data.key.substring(0, 10)}...`);
    console.log(`Key length: ${data.key.length}`);
    console.log(`Looks like Google key: ${data.key.startsWith('AIza')}`);
  }
} catch {}
