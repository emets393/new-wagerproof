# Debug: Only One Thread Being Saved

## What I Added

I've added extensive logging to track the `sessionId` state and thread creation. This will help us see if `sessionId` is being reused when it shouldn't be.

## Test This Flow

### Test 1: Create First Thread

1. **Open chat** - Check console:
   ```
   📝 Session ID changed: NULL
      🆕 Session ID null - will create new thread on next message
   ```

2. **Send message "Test 1"** - Check console:
   ```
   💾 Starting Supabase save...
     - Current sessionId: null
     - sessionId falsy? true
   🔍 No sessionId found - will CREATE NEW THREAD
   🆕 Creating new thread in Supabase...
   ✅ Created new Supabase thread: abc-123-def-456
   
   📝 Session ID changed: abc-123-def-456
      ✅ Session ID set - will update existing thread
   ```

3. **Send message "Test 2"** - Check console:
   ```
   💾 Starting Supabase save...
     - Current sessionId: abc-123-def-456
     - sessionId falsy? false
   🔍 SessionId EXISTS - will UPDATE EXISTING THREAD
   📝 Updating existing thread: abc-123-def-456
   ```

### Test 2: Clear Chat and Create New Thread

1. **Click clear/trash icon** - Check console:
   ```
   🧹 Clearing chat...
     - Old sessionId: abc-123-def-456
     - Old threadId: thread_xyz
   
   📝 Session ID changed: NULL
      🆕 Session ID null - will create new thread on next message
   
   ✅ Chat cleared - ready for new conversation
   ```

2. **Send message "Test 3"** - Check console:
   ```
   💾 Starting Supabase save...
     - Current sessionId: null
     - sessionId falsy? true
   🔍 No sessionId found - will CREATE NEW THREAD
   🆕 Creating new thread in Supabase...
   ✅ Created new Supabase thread: ghi-789-jkl-012  ← NEW THREAD!
   ```

### Test 3: Switch Between Threads

1. **Open history** - Should see both threads
2. **Tap first thread** - Check console:
   ```
   📝 Session ID changed: abc-123-def-456
      ✅ Session ID set - will update existing thread
   ✅ Switched to chat: abc-123-def-456 with 2 messages
   ```

3. **Send message** - Should update that thread:
   ```
   🔍 SessionId EXISTS - will UPDATE EXISTING THREAD
   📝 Updating existing thread: abc-123-def-456
   ```

## What to Look For

### ❌ Problem: sessionId Not Resetting

If you see this after clicking clear:
```
💾 Starting Supabase save...
  - Current sessionId: abc-123-def-456  ← Still has old ID!
  - sessionId falsy? false
🔍 SessionId EXISTS - will UPDATE EXISTING THREAD  ← Wrong! Should be new!
```

**This means:** `sessionId` state isn't being reset properly.

### ❌ Problem: sessionId Never Set

If you see this for every message:
```
💾 Starting Supabase save...
  - Current sessionId: null
🔍 No sessionId found - will CREATE NEW THREAD
```

**This means:** `setSessionId()` isn't working or state isn't persisting.

### ✅ Correct Behavior

For a new conversation:
- `sessionId` starts as `null`
- After first message, `sessionId` is set to new thread ID
- Subsequent messages update that thread
- Clear chat resets `sessionId` to `null`
- Next message creates a new thread

## Quick Check

Run this in Supabase SQL Editor after each test:

```sql
-- See all your threads
SELECT 
  id,
  title,
  message_count,
  created_at
FROM chat_threads 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

You should see:
- Multiple threads with different IDs
- Each with their own messages
- Created at different times

## If Still Only One Thread

The issue is that `sessionId` is not being reset when you:
1. Click clear chat
2. Start a new conversation

Share the console logs from:
1. Clicking clear
2. Sending next message

Look specifically for:
```
🧹 Clearing chat...
📝 Session ID changed: NULL  ← Should show this
💾 Starting Supabase save...
  - Current sessionId: null  ← Should be null for new thread
```

If sessionId is NOT null after clearing, that's the bug!

