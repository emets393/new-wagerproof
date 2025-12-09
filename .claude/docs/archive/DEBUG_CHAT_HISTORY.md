# Debug Chat History Not Saving

## Added Verbose Logging

I've added comprehensive logging to help diagnose the issue. Now when you send a message, check your console for these logs:

### Expected Log Sequence (Success):

```
💾 Starting Supabase save...
  - Current sessionId: null (or UUID if continuing)
  - OpenAI thread ID: thread_abc123
  - User ID: your-user-id
  - Message text length: 25
  - Assistant content length: 150

🆕 Creating new thread in Supabase...
✅ Created new Supabase thread: abc123-def456...

💾 Saving user message...
✅ User message saved

💾 Saving assistant message...
✅ Assistant message saved

🤖 Triggering AI title generation...
✅ All messages saved to Supabase successfully!
```

### If You See an Error:

```
❌❌❌ FAILED TO SAVE TO SUPABASE ❌❌❌
Error type: TypeError
Error message: Cannot read property 'id'...
Full error: { ... }
Stack: ...
```

## Common Issues & Fixes

### 1. User Not Authenticated

**Error:** `Error: No user found` or `RLS policy violation`

**Check:**
```typescript
// In your app, verify user is logged in
const { user } = useAuth();
console.log('Current user:', user);
```

**Fix:** Make sure user is logged in before using chat.

### 2. Supabase Tables Don't Exist

**Error:** `relation "chat_threads" does not exist`

**Fix:** Run the migration SQL in Supabase dashboard:
1. Go to SQL Editor
2. Paste contents of `supabase/migrations/create_chat_tables.sql`
3. Click Run

### 3. RLS Policies Not Working

**Error:** `new row violates row-level security policy`

**Check in Supabase:**
```sql
-- Verify policies exist
SELECT * FROM pg_policies 
WHERE tablename IN ('chat_threads', 'chat_messages');
```

**Fix:** Re-run the migration SQL which includes all policies.

### 4. User ID Mismatch

**Error:** Messages save but don't appear in history

**Check:**
```sql
-- See what user_id is being used
SELECT user_id, COUNT(*) 
FROM chat_threads 
GROUP BY user_id;
```

**Fix:** Make sure `userId` prop matches your auth user ID:
```typescript
<WagerBotChat userId={user.id} ... />
```

### 5. Network/Connection Error

**Error:** `Failed to fetch` or `Network request failed`

**Check:**
- Is your internet working?
- Is Supabase URL correct in `.env`?
- Is Supabase service running?

**Verify connection:**
```typescript
// Test Supabase connection
import { supabase } from './services/supabase';

const testConnection = async () => {
  const { data, error } = await supabase
    .from('chat_threads')
    .select('count')
    .limit(1);
  
  console.log('Connection test:', { data, error });
};
```

## Manual Verification

### Check if Thread Was Created

In Supabase SQL Editor:
```sql
-- Check recent threads
SELECT * FROM chat_threads 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check if Messages Were Saved

```sql
-- Check recent messages
SELECT 
  m.*,
  t.title as thread_title
FROM chat_messages m
JOIN chat_threads t ON t.id = m.thread_id
ORDER BY m.created_at DESC
LIMIT 10;
```

### Check Your User's Threads

```sql
-- Replace with your actual user ID
SELECT * FROM chat_threads 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

## What to Send Me

If it's still not working, send me:

1. **Console logs** after sending a message (the full sequence)
2. **Any red error messages** from console
3. **Supabase query results:**
   ```sql
   SELECT COUNT(*) FROM chat_threads;
   SELECT COUNT(*) FROM chat_messages;
   ```
4. **Your user ID:**
   ```typescript
   console.log('User ID:', user?.id);
   ```

## Quick Test

1. **Clear console**
2. **Send a test message**: "Hello"
3. **Wait for response**
4. **Copy ALL console logs** (especially lines with 💾, ✅, or ❌)
5. **Check Supabase:**
   ```sql
   SELECT * FROM chat_threads 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

This will tell us exactly where it's failing!

