# BuildShip Mobile WagerBot Integration ✅

## Overview

Successfully integrated the mobile WagerBot chat with BuildShip's streaming endpoint. The chat now sends messages to the BuildShip workflow and handles streaming responses in real-time.

## BuildShip Configuration

### Workflow Details

- **Endpoint**: `https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae`
- **Method**: POST
- **Workflow ID**: Uses the mobile-specific workflow path

### Input Schema

The BuildShip workflow expects the following inputs in the request body:

```json
{
  "message": "User's message text",
  "conversationId": "optional_conversation_id_for_continuity"
}
```

**Input Fields:**
- `message` (required) - The user's message text
- `conversationId` (optional) - Conversation ID for maintaining context across messages

### Output Schema

The workflow outputs:
- **Response Body** - The AI's response (streamed or JSON)
- **Status Code** - HTTP status code
- **Cache Time** - Response cache time

## Streaming Implementation

### How Streaming Works

The mobile app now supports **real-time streaming responses** from BuildShip:

1. **User sends message** → App displays user bubble
2. **Fetch request sent** → POST to BuildShip endpoint
3. **Stream starts** → Empty assistant message bubble appears
4. **Chunks arrive** → Message bubble updates in real-time
5. **Stream complete** → Final message displayed

### Technical Implementation

#### Request Setup

```typescript
const response = await fetch(chatEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: userMessage.content,
    conversationId: threadId // if exists
  }),
});
```

#### Stream Reading

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  buffer += chunk;
  
  // Update UI in real-time
  setMessages(prev => 
    prev.map(msg => 
      msg.id === assistantMessageId 
        ? { ...msg, content: buffer.trim() } 
        : msg
    )
  );
}
```

### Supported Response Formats

The implementation handles multiple response formats from BuildShip:

#### 1. Plain Text Streaming (Recommended)
```
Hello! I can help you
with that question...
```
- Each chunk updates the message in real-time
- Best for user experience

#### 2. JSON Response (Fallback)
```json
{
  "message": "Complete response here",
  "conversationId": "conv_123"
}
```
- Full response arrives at once
- Used if streaming not available

#### 3. JSON Lines Streaming
```json
{"message": "Hello! I"}
{"message": "Hello! I can"}
{"message": "Hello! I can help"}
```
- Each line is a JSON object
- Extracted and displayed progressively

#### 4. Conversation ID in Stream
```
conversationId:conv_abc123
Response text here...
```
- Conversation ID extracted from stream
- Used for subsequent messages

## Conversation Continuity

### Thread/Conversation Management

**First Message:**
```json
{
  "message": "Tell me about today's games"
  // No conversationId
}
```

**Subsequent Messages:**
```json
{
  "message": "What about the weather?",
  "conversationId": "conv_abc123"  // From previous response
}
```

The app automatically:
1. Stores conversation ID from response
2. Includes it in next request
3. Maintains context across messages
4. Persists in AsyncStorage

### Conversation ID Detection

The app looks for conversation IDs in multiple places:

1. **In stream content**: `conversationId:xxx`
2. **In JSON response**: `{ conversationId: "xxx" }`
3. **In response header**: `x-conversation-id`

## Console Logging

### What to Watch For

The implementation includes comprehensive logging:

```
📤 Sending message to BuildShip...
📦 Request body: { message: "...", hasConversationId: true }
📥 Response received, status: 200
📋 Content-Type: text/plain; charset=utf-8
🌊 Starting to read streaming response...
📦 Chunk received: Hello! I can help...
📦 Chunk received: you with that...
✅ Stream complete
✅ Message received successfully
💬 Final message length: 156
🔗 Conversation ID set from stream: conv_abc123
```

### Error Logging

```
❌ BuildShip error: [error text]
❌ Error reading stream: [error details]
❌ Error parsing JSON: [error details]
❌ Error sending message: [full error]
```

## BuildShip Workflow Requirements

### What Your BuildShip Workflow Should Do

1. **Accept Inputs:**
   - `message` from request body
   - `conversationId` from request body (optional)

2. **Process Message:**
   - Send to OpenAI or your AI provider
   - Include conversation history if conversationId provided
   - Apply game data context from session initialization

3. **Return Response:**
   - **Option A (Recommended)**: Stream the response as plain text
   - **Option B**: Return JSON with `{ message: "...", conversationId: "..." }`

4. **Maintain Context:**
   - Store conversation history (e.g., in Firestore, Redis, or memory)
   - Return same conversationId or generate new one
   - Include game data context in system prompt

### Example BuildShip Flow

```
1. REST API Call (Trigger)
   ↓
2. Get request body
   - Extract: message, conversationId
   ↓
3. Retrieve conversation history (if conversationId exists)
   - From Firestore/database
   ↓
4. Build OpenAI messages array
   - System: "You are WagerBot..." + game context
   - History: previous messages
   - User: current message
   ↓
5. Call OpenAI API
   - Model: gpt-4 or gpt-3.5-turbo
   - Stream: true
   ↓
6. Stream response back to client
   - Format: plain text chunks
   ↓
7. Save conversation history
   - Store in database with conversationId
   ↓
8. Return conversationId
   - In response body or header
```

## Game Context Integration

### Session Initialization

When the chat initializes, game context is passed to BuildShip:

```typescript
const { clientSecret } = await chatSessionManager.getClientSecret(
  userId,
  userEmail,
  gameContext // Full game data as markdown
);
```

This happens at **session creation** (via the separate session endpoint).

### How Context Flows

1. **App fetches game data** → NFL & CFB predictions
2. **Formats as markdown** → Game details, lines, predictions
3. **Sends to session endpoint** → BuildShip stores in session
4. **Chat messages sent** → BuildShip includes context in prompts

**Note**: The game context is **NOT** sent with every message - only during session initialization. This keeps message payloads small and efficient.

## Error Handling

### Network Errors
```typescript
try {
  const response = await fetch(endpoint, ...);
  if (!response.ok) {
    throw new Error(`API failed: ${response.status}`);
  }
} catch (err) {
  // Display error message in chat
  // Show retry option
}
```

### Streaming Errors
```typescript
try {
  while (true) {
    const { done, value } = await reader.read();
    // ... process chunks
  }
} catch (streamError) {
  console.error('Stream error:', streamError);
  // Display partial message + error indicator
}
```

### Response Format Errors
```typescript
// Try JSON first
try {
  const parsed = JSON.parse(line);
  assistantMessageContent = parsed.message;
} catch (jsonError) {
  // Fallback to plain text
  assistantMessageContent = buffer;
}
```

## Testing the Integration

### Test Scenarios

1. **First Message (No Conversation ID)**
   - Send: "Tell me about today's games"
   - Check: Message appears in chat
   - Check: Response streams in real-time
   - Check: Conversation ID extracted

2. **Follow-up Message (With Conversation ID)**
   - Send: "What about the weather?"
   - Check: conversationId included in request
   - Check: Response maintains context

3. **Streaming Display**
   - Send any message
   - Watch: Empty bubble appears
   - Watch: Text appears word-by-word
   - Watch: Final message complete

4. **Error Handling**
   - Turn off network
   - Send message
   - Check: Error message displays
   - Check: Retry option available

### Console Commands for Testing

```javascript
// In React Native debugger console:

// Check stored conversation ID
console.log('Thread ID:', threadId);

// Check messages array
console.log('Messages:', messages);

// Check game context
console.log('Context length:', gameContext.length);
```

## Performance Considerations

### Streaming Benefits
- **Better UX**: Users see responses as they're generated
- **Lower latency**: First words appear immediately
- **Reduced timeout**: Partial responses shown even if stream breaks

### Optimization Tips
1. **Debounce sending**: Prevent duplicate sends
2. **Cancel previous request**: If user sends new message
3. **Buffer management**: Clear old messages from memory
4. **Context compression**: Limit game data to essentials

## Troubleshooting

### Issue: No Streaming, Only Full Response
**Solution**: Check BuildShip workflow returns stream, not JSON

### Issue: Conversation ID Not Persisting
**Solution**: Check console logs for "🔗 Conversation ID set"

### Issue: Empty Responses
**Solution**: Check BuildShip logs, verify workflow is running

### Issue: Slow Responses
**Solution**: Check OpenAI model (use gpt-3.5-turbo for speed)

### Issue: Context Not Working
**Solution**: Verify game context passed during session init

## Security Notes

- ✅ No API keys exposed in mobile app
- ✅ All OpenAI calls happen server-side (BuildShip)
- ✅ User authentication handled by Supabase
- ✅ Conversation IDs are random UUIDs
- ✅ No sensitive data in logs (message content only)

## Future Enhancements

Possible improvements:

1. **Retry Logic**: Auto-retry failed messages
2. **Offline Queue**: Queue messages when offline
3. **Cancel Stream**: Allow user to stop generation
4. **Token Counting**: Display token usage
5. **Export Chat**: Save conversation history
6. **Voice Input**: Speech-to-text integration
7. **Rich Responses**: Support markdown formatting
8. **Typing Indicator**: Show when AI is "thinking"

## Files Modified

- `/wagerproof-mobile/components/WagerBotChat.tsx`
  - Updated endpoint to `https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae`
  - Changed request body to match BuildShip schema (`message`, `conversationId`)
  - Enhanced streaming logic with better error handling
  - Added comprehensive logging for debugging
  - Improved conversation ID detection

## Summary

The mobile WagerBot is now fully integrated with BuildShip's streaming endpoint. Users can:
- ✅ Send messages and get streaming responses
- ✅ Maintain conversation context across messages
- ✅ See responses appear in real-time
- ✅ Access game data through AI assistant
- ✅ Enjoy smooth, app-like chat experience

The implementation is production-ready and includes robust error handling, logging, and fallback mechanisms!

