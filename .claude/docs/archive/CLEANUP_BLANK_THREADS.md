# Clean Up Blank/Old Threads

## What Was Fixed

### 1. No More Blank Threads on Initialization
**Before:** App created a thread immediately when opening chat (creating blank threads)  
**After:** App only creates thread after first message is sent

### 2. Delete Thread Feature Added
**New Features:**
- Red trash icon next to each thread in history
- Confirmation dialog before deleting
- Auto-clears current chat if you delete the active thread
- Refreshes history list after deletion

## Clean Up Existing Blank Threads

Run this SQL in your Supabase dashboard to delete all threads with no messages:

```sql
-- Delete all threads with 0 messages (blank threads)
DELETE FROM chat_threads
WHERE message_count = 0;

-- Check how many you deleted
SELECT COUNT(*) as deleted_count
FROM chat_threads
WHERE message_count = 0;
```

### Optional: Delete Threads With Only 1 Message

If you also want to remove threads where users only sent a message but got no response:

```sql
-- Delete threads with only 1 message
DELETE FROM chat_threads
WHERE message_count = 1;
```

### Optional: Delete All Old Threads for Your User

If you want to start completely fresh:

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID
DELETE FROM chat_threads
WHERE user_id = 'YOUR_USER_ID';
```

## How Thread Creation Works Now

### Old Flow (Creating Blank Threads):
```
1. User opens WagerBot
   ↓
2. App creates thread in Supabase
   ↓
3. Thread has 0 messages
   ↓
4. Shows in history as "New Chat" or thread ID
```

### New Flow (Only After First Message):
```
1. User opens WagerBot
   ↓
2. Shows welcome screen (no thread created)
   ↓
3. User sends first message
   ↓
4. App creates thread in Supabase
   ↓
5. Saves user message
   ↓
6. Gets AI response
   ↓
7. Saves AI response
   ↓
8. Generates AI title (async)
   ↓
9. Thread appears in history with proper title
```

## How to Delete Threads (User Feature)

### In the App:
1. Open chat history drawer (clock icon)
2. Find thread you want to delete
3. Tap the red trash icon on the right
4. Confirm deletion
5. Thread and all messages removed

### Result:
- Thread deleted from Supabase
- All messages deleted (cascade)
- If it was the active chat, app clears and shows welcome screen
- History list refreshes automatically

## Verify Clean Database

After running cleanup SQL, verify with:

```sql
-- Count threads by message count
SELECT 
  message_count,
  COUNT(*) as thread_count
FROM chat_threads
GROUP BY message_count
ORDER BY message_count;

-- Should show:
-- message_count | thread_count
-- 2             | X  (threads with AI response)
-- 3+            | Y  (longer conversations)
-- (no 0 or 1)
```

## AI Title Generation Status

Check which threads have AI-generated titles:

```sql
-- Threads with AI titles
SELECT 
  id,
  title,
  message_count,
  created_at
FROM chat_threads
WHERE title NOT LIKE 'thread_%'  -- Has AI title
  AND title IS NOT NULL
ORDER BY created_at DESC;

-- Threads still waiting for titles
SELECT 
  id,
  title,
  message_count,
  created_at
FROM chat_threads
WHERE (title LIKE 'thread_%' OR title IS NULL)
  AND message_count >= 2
ORDER BY created_at DESC;
```

## Troubleshooting

### Issue: AI Titles Not Generating

**Check OpenAI API Key:**
```bash
# In .env file
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

**Check Console Logs:**
Look for:
- "🤖 Generating AI title for thread:"
- "✅ Generated title:"
- "❌ Error generating title:"

**Manual Title Generation:**
If some threads didn't get titles, you can trigger manually:

```typescript
// In your app console or debugger
await chatThreadService.generateThreadTitle(
  'thread-id-here',
  'User message...',
  'Assistant response...'
);
```

### Issue: Delete Not Working

**Check RLS Policies:**
```sql
-- Verify delete policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'chat_threads' 
  AND policyname = 'Users can delete their own threads';
```

**Check User Authentication:**
Make sure user is logged in when deleting.

## Summary of Changes

**Files Modified:**
- `components/WagerBotChat.tsx`
  - Removed thread creation from `initializeChat()`
  - Thread now created in `sendMessage()` after first message
  - Added `deleteThread()` function with confirmation
  - Added delete button to history drawer UI
  - Added styles for delete button

**Result:**
✅ No more blank threads  
✅ Users can delete unwanted threads  
✅ Confirmation before deletion  
✅ Cleaner chat history  
✅ Better UX

**Next Steps:**
1. Run cleanup SQL to remove existing blank threads
2. Test creating new chat - no thread until first message
3. Test deleting threads - should show confirmation
4. Verify AI titles generate after first exchange

