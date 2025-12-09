# Setup Guide: Fix "Failed to Initialize Chat" Error

## The Problem

The chat is failing to initialize because the Supabase tables haven't been created yet. We need to run the migration SQL to create the database tables.

## Step-by-Step Fix

### Step 1: Check Your Supabase Connection

First, verify your environment variables are set correctly in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-openai-key  # For AI title generation
```

**To find these:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy "Project URL" and "anon public" key

### Step 2: Run the Database Migration

You have two options:

#### Option A: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `wagerproof-mobile/supabase/migrations/create_chat_tables.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

#### Option B: Supabase CLI

```bash
# Install Supabase CLI if you don't have it
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### Step 3: Verify Tables Were Created

In Supabase SQL Editor, run:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('chat_threads', 'chat_messages');
```

You should see both `chat_threads` and `chat_messages` in the results.

### Step 4: Test the Connection

Run this query to make sure everything works:

```sql
-- Try inserting a test thread (replace with your user ID)
INSERT INTO chat_threads (user_id, title) 
VALUES ('test-user', 'Test Thread')
RETURNING *;

-- Clean up test data
DELETE FROM chat_threads WHERE user_id = 'test-user';
```

If this works, your database is ready!

### Step 5: Restart Your App

```bash
# Stop the expo server (Ctrl+C)
# Then restart
cd wagerproof-mobile
npx expo start --clear
```

## Alternative: Temporarily Skip Supabase (Quick Fix)

If you need the app working NOW while you set up Supabase, you can temporarily revert to AsyncStorage:

### Quick Rollback Steps

1. Comment out the Supabase import in `chatSessionManager.ts`:
```typescript
// import { chatThreadService, ... } from '../services/chatThreadService';
```

2. In `chatSessionManager.ts`, change `createNewSession()` back to:
```typescript
async createNewSession(userId: string, pageId?: string): Promise<ChatSession> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newSession: ChatSession = {
    id: sessionId,
    userId: userId,
    pageId: pageId,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    messages: [],
  };
  
  await this.setCurrentSession(newSession.id, pageId);
  return newSession;
}
```

But **this is temporary** - you'll lose chat history features!

## Common Issues & Solutions

### Issue 1: "relation 'chat_threads' does not exist"
**Solution:** Run the migration SQL (Step 2)

### Issue 2: "permission denied for table chat_threads"
**Solution:** The RLS policies need to be set up. Run the migration SQL which includes the policies.

### Issue 3: "Failed to initialize chat" but tables exist
**Check:**
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('chat_threads', 'chat_messages');

-- Should show rowsecurity = true for both

-- Check policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('chat_threads', 'chat_messages');

-- Should show 4 policies for chat_threads, 2 for chat_messages
```

### Issue 4: Environment variables not loaded
**Solution:**
```bash
# Make sure .env file exists in wagerproof-mobile directory
ls -la wagerproof-mobile/.env

# Restart with clear cache
cd wagerproof-mobile
npx expo start --clear
```

### Issue 5: User not authenticated
The app needs the user to be logged in for RLS to work. Check:
```typescript
// In your app, verify user is authenticated
const { user } = useAuth();
console.log('Current user:', user?.id);
```

If user is null, the Supabase queries will fail due to RLS.

## Debugging Commands

Add these console logs to `chatSessionManager.ts` → `createNewSession()`:

```typescript
async createNewSession(userId: string, pageId?: string): Promise<ChatSession> {
  console.log('🔍 Creating new session for user:', userId);
  
  try {
    const thread = await chatThreadService.createThread(userId);
    console.log('✅ Thread created:', thread);
    // ... rest of code
  } catch (error) {
    console.error('❌ Error creating thread:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}
```

Check your console/terminal for these logs to see exactly where it's failing.

## Test Your Setup

After fixing, test the complete flow:

1. Open the app
2. Send a message to WagerBot
3. Check Supabase dashboard:
```sql
-- See your new thread
SELECT * FROM chat_threads ORDER BY created_at DESC LIMIT 5;

-- See your messages
SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 10;
```

4. Open chat history drawer - you should see your thread (might say "New Chat" at first)
5. Wait 2-3 seconds, refresh history - AI-generated title should appear

## Still Not Working?

Share the exact error message you see in the console. Run:

```bash
cd wagerproof-mobile
npx expo start
# Then check the terminal for error messages when you open the chat
```

Look for lines containing:
- "Error creating thread"
- "Error loading chat"
- "Supabase error"
- "Failed to initialize"

Copy those error messages and I can help debug further!

