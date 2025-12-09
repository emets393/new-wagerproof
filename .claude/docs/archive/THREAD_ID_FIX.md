# Thread ID & UI Fix - WagerBot Mobile Chat

## Issues Fixed

### 1. API Error - Invalid Thread ID
The mobile WagerBot chat was sending an invalid thread_id ('1234') to the BuildShip API, causing a 400 error:
```
400 Invalid 'thread_id': '1234'. Expected an ID that begins with 'thread'.
```

**Root Cause**: The mobile app was using incorrect parameter names when calling the BuildShip API:
- Sending `conversationId` instead of `threadId`
- Sending `message` instead of `prompt`
- Sending `SystemPrompt` instead of `instructions`

### 2. Visual Issue - Stretched Message Bubbles
User message bubbles were displaying extremely tall/stretched, making the text unreadable.

**Root Cause**: The `messageText` style had `flex: 1` which caused text elements to expand and fill all available vertical space.

## Changes Made

### 1. Updated Request Parameters in `WagerBotChat.tsx`
Changed the request body to match BuildShip's expected parameters (assistantId is handled server-side):

**Before:**
```typescript
const requestBody: any = {
  message: userMessage.content,
};

if (gameContext && gameContext.length > 0) {
  requestBody.SystemPrompt = gameContext;
}

if (threadId && threadId.startsWith('thread_')) {
  requestBody.conversationId = threadId;
}
```

**After:**
```typescript
const requestBody: any = {
  prompt: userMessage.content,  // Changed: message → prompt
};

if (gameContext && gameContext.length > 0) {
  requestBody.instructions = gameContext;  // Changed: SystemPrompt → instructions
}

if (threadId && threadId.startsWith('thread_')) {
  requestBody.threadId = threadId;  // Changed: conversationId → threadId
}
```

**Note**: `assistantId` and `builtInTools` are not sent from the client - they are configured server-side in the BuildShip workflow.

### 2. Fixed Message Bubble Styling
Changed the `messageText` style to prevent vertical stretching:

**Before:**
```typescript
messageText: {
  fontSize: 15,
  lineHeight: 22,
  flex: 1,  // ❌ This caused stretching
}
```

**After:**
```typescript
messageText: {
  fontSize: 15,
  lineHeight: 22,
  flexShrink: 1,  // ✅ This allows wrapping without stretching
}
```

### 3. Improved Thread ID Validation
- Only sends `threadId` if it's a valid OpenAI thread ID (starts with 'thread_')
- Skips sending invalid or null thread IDs
- Logs appropriate messages for debugging

### 4. Updated Response Parsing
Updated the code to look for thread IDs in multiple formats:
- `threadId` (primary)
- `thread_id` (snake_case)
- `conversationId` (fallback for compatibility)
- Response headers: `x-thread-id`, `thread-id`, `threadid`

## How It Works Now

### First Message (No Thread ID)
1. Mobile app sends: `{ prompt: "Hello", instructions: "..." }`
2. BuildShip creates a new OpenAI thread
3. BuildShip returns: `{ stream: ..., threadId: "thread_abc123..." }`
4. Mobile app extracts and stores the thread ID

### Subsequent Messages (With Thread ID)
1. Mobile app sends: `{ prompt: "Follow up", threadId: "thread_abc123...", instructions: "..." }`
2. BuildShip uses the existing thread
3. Conversation context is maintained

## Testing
To test the fix:
1. Open the mobile app
2. Navigate to the Chat tab
3. Send a message to WagerBot
4. Check the console logs for:
   - ✅ "No thread ID - BuildShip will create a new thread" (first message)
   - ✅ "Thread ID extracted from stream: thread_..." (after response)
   - ✅ "Including existing thread ID: thread_..." (second message onwards)

## BuildShip Endpoint Requirements
The BuildShip workflow at `https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae` should:

1. **Accept these parameters from the client:**
   - `prompt` (string, required): The user's message
   - `threadId` (string, optional): OpenAI thread ID for continuing conversations
   - `instructions` (string, optional): System prompt / game context

2. **Server-side configuration (not sent from client):**
   - `assistantId` (string): OpenAI assistant ID (configured in BuildShip workflow)
   - `builtInTools` (array): Tools available to the assistant (configured in BuildShip workflow)

3. **Return the thread ID:**
   - Include `threadId` in response headers (recommended):
     ```javascript
     return {
       stream: stream,
       headers: {
         'x-thread-id': threadId
       }
     };
     ```
   - OR include in the stream content:
     ```javascript
     stream.push(`[threadId:${threadId}]`);
     ```

3. **Handle thread creation:**
   - If `threadId` is not provided or undefined, create a new thread
   - If `threadId` is provided and valid (starts with 'thread_'), use it
   - Never accept or process invalid thread IDs

## Next Steps
If the issue persists:
1. Check BuildShip logs to see what parameters it's receiving
2. Verify the BuildShip workflow is returning the threadId properly
3. Check mobile app console logs for thread ID extraction messages
4. Ensure the assistant_id in BuildShip is valid and active

## Related Files
- `/wagerproof-mobile/components/WagerBotChat.tsx` - Main chat component
- `/wagerproof-mobile/utils/chatSessionManager.ts` - Session management (not changed)
- `/wagerproof-mobile/app/(tabs)/chat.tsx` - Chat screen wrapper (not changed)

