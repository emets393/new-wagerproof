# WagerBot Mobile - Complete Fix Summary

## Issues Identified and Fixed

### 1. ❌ Wrong Request Parameter Names
**Problem**: We were sending `prompt`, `threadId`, and `instructions` but BuildShip expects `message`, `conversationId`, and `SystemPrompt`.

**Evidence from BuildShip**:
```
REST API Call Inputs:
  - message --- Testing
  - conversationId --- 1234
```

### 2. ❌ Invalid Thread ID Format
**Problem**: Sending `conversationId: "1234"` which is not a valid OpenAI thread ID.
**Error**: `400 Invalid 'thread_id': '1234'. Expected an ID that begins with 'thread'.`

### 3. ❌ Stretched Message Bubbles
**Problem**: User message bubbles were extremely tall due to `flex: 1` in the text style.

## ✅ Complete Solution

### Fixed Request Payload Structure

**Before (WRONG):**
```typescript
{
  prompt: "message",
  threadId: "1234",
  instructions: "game data"
}
```

**After (CORRECT):**
```typescript
{
  message: "message",                    // ✅ Changed from "prompt"
  conversationId: "thread_abc123...",    // ✅ Changed from "threadId", only sent if valid
  SystemPrompt: "game data"              // ✅ Changed from "instructions"
}
```

### Thread ID Validation

Now we **only** send `conversationId` when:
1. We have a thread ID stored
2. AND it starts with `"thread_"` (valid OpenAI format)

This prevents sending invalid IDs like `"1234"`.

**Code logic:**
```typescript
if (threadId && threadId.startsWith('thread_')) {
  requestBody.conversationId = threadId;  // ✅ Send valid thread ID
} else if (threadId) {
  console.log('⚠️ Skipping invalid thread ID:', threadId);  // ⚠️ Skip invalid
} else {
  console.log('ℹ️ No thread ID - BuildShip will create new thread');  // ℹ️ First message
}
```

### Message Bubble Fix

Changed text style from `flex: 1` to `flexShrink: 1` to prevent vertical stretching.

## How It Works Now

### First Message Flow
1. User types "Hello"
2. Mobile sends:
   ```json
   {
     "message": "Hello"
   }
   ```
3. BuildShip creates a new OpenAI thread
4. BuildShip returns response with `threadId: "thread_abc123..."`
5. Mobile extracts and stores thread ID
6. Console shows: `"🔗 Thread ID extracted: thread_abc123..."`

### Follow-up Message Flow
1. User types "What's the score?"
2. Mobile sends:
   ```json
   {
     "message": "What's the score?",
     "conversationId": "thread_abc123..."
   }
   ```
3. BuildShip uses existing thread (conversation context maintained)
4. Console shows: `"🔗 Including existing thread ID: thread_abc123..."`

### With Game Context
1. Mobile sends:
   ```json
   {
     "message": "Analyze this game",
     "conversationId": "thread_abc123...",
     "SystemPrompt": "GAME DATA:\n\nNFL Games - Week 8, 2024:\n[full game data]"
   }
   ```
2. WagerBot has access to all game data for analysis

## BuildShip Workflow Mapping

### REST API → Assistant Node Mapping
Your BuildShip workflow maps:
- `message` (REST input) → `userRequest` (Assistant input)
- `conversationId` (REST input) → `threadId` (Assistant internal)
- `SystemPrompt` (REST input) → `systemPrompt` (Assistant input)

Server-side configuration (not sent from mobile):
- `assistantId`: Configured in BuildShip
- `builtInTools`: Configured in BuildShip
- `temperature`: 0.7
- `model`: gpt-5 (if available, otherwise gpt-4)
- `streamContentForm`: text

## Testing the Fix

### 1. Run the Mobile App
```bash
cd wagerproof-mobile
npm start
# or
npx expo start
```

### 2. Open Chat Tab
Navigate to the Chat tab in the app

### 3. Send First Message
Type anything (e.g., "Hello") and send

### 4. Check Console Logs
You should see:
```
🎬 Starting sendMessage function
  - Input text: Hello
  - Message content: Hello
  - Message content length: 5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 REQUEST PAYLOAD TO BUILDSHIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full payload: {
  "message": "Hello"
}

Payload structure:
  - message: "Hello"
  - message type: string
  - conversationId: NOT_PRESENT
  - SystemPrompt: NOT_PRESENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️ No thread ID - BuildShip will create a new thread
🌐 Sending to: https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae
📥 Response status: 200
🌊 Handling streaming response...
🔗 Thread ID extracted from stream: thread_abc123...
✅ Message received and displayed successfully
```

### 5. Send Follow-up Message
Type another message and send

### 6. Verify Thread ID is Sent
Console should show:
```
🔗 Including existing thread ID: thread_abc123...

Payload structure:
  - message: "Follow up message"
  - message type: string
  - conversationId: thread_abc123...
  - SystemPrompt: (12345 chars)  ← If game context is available
```

## Expected Behavior

✅ **First message**: Creates new thread, no errors  
✅ **Follow-up messages**: Uses existing thread, maintains context  
✅ **Message bubbles**: Display correctly, no stretching  
✅ **Game context**: Included automatically when available  
✅ **Streaming**: Shows message streaming in real-time  
✅ **Error handling**: Clear error messages if something fails  

## BuildShip Response Requirements

For the mobile app to extract the thread ID, BuildShip should return it in one of these ways:

### Option 1: In Response Headers (Recommended)
```javascript
return {
  stream: stream,
  headers: {
    'x-thread-id': threadId,
    'Content-Type': 'text/plain'
  }
};
```

### Option 2: In Stream Content
Add this to your BuildShip workflow before streaming:
```javascript
stream.push(`[threadId:${threadId}]`);
// Then stream the actual message
```

### Option 3: In JSON Response
If not streaming:
```javascript
return {
  message: "Assistant response",
  threadId: threadId
};
```

The mobile app will look for the thread ID in all these places.

## Files Modified

1. `/wagerproof-mobile/components/WagerBotChat.tsx`
   - Changed request parameters: `prompt` → `message`, `threadId` → `conversationId`, `instructions` → `SystemPrompt`
   - Added thread ID validation (only send if starts with "thread_")
   - Fixed message bubble styling (`flex: 1` → `flexShrink: 1`)
   - Enhanced logging for debugging
   - Updated response parsing to handle multiple thread ID formats

## Troubleshooting

### If you still get errors:

1. **Check BuildShip logs** to see what it's receiving
2. **Verify BuildShip configuration** matches the expected inputs:
   - `message` (string)
   - `conversationId` (string, optional)
   - `SystemPrompt` (string, optional)
3. **Look for console logs** in the mobile app showing the exact payload
4. **Verify thread ID** is being extracted and stored correctly

### Common Issues

**"User Prompt is undefined"**
- BuildShip expects `message` not `prompt` ✅ Fixed

**"Invalid thread_id: '1234'"**
- Only send valid thread IDs starting with "thread_" ✅ Fixed

**"Conversation context lost"**
- Thread ID is now properly sent in follow-up messages ✅ Fixed

**"Message bubbles stretched"**
- Text style fixed from `flex: 1` to `flexShrink: 1` ✅ Fixed

## Success Indicators

✅ No 400 errors  
✅ Messages display correctly  
✅ Conversation context is maintained  
✅ Thread ID appears in logs  
✅ Follow-up messages include conversationId  
✅ Game context is included when available  

## Next Steps

1. Test the app
2. Send a few messages
3. Verify conversation context works
4. Check that thread IDs are being stored and reused
5. Confirm BuildShip is receiving correct parameters

