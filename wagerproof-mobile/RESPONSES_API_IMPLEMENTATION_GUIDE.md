# Responses API Implementation Guide - Step by Step

## 🎯 What You're Getting

By migrating to the OpenAI Responses API, you'll get:
- ✅ **Built-in Web Search** - Real-time injury reports, weather, breaking news
- ✅ **Image Analysis** - Future capability to analyze game screenshots
- ✅ **Simpler Architecture** - No thread management, stateless API
- ✅ **Better Control** - You manage conversation history
- ✅ **Same Cost or Less** - Pay per token, not per assistant run

## 📋 Implementation Checklist

### Part 1: Update BuildShip (Backend)

#### Step 1: Open Your BuildShip Workflow
1. Go to [BuildShip Dashboard](https://buildship.app)
2. Find your workflow: `wager-bot-mobile-900a291b0aae`
3. Open it for editing

#### Step 2: Update Input Schema
In your REST API trigger, update the input schema to:

```json
{
  "message": {
    "type": "string",
    "required": true,
    "description": "The user's current message"
  },
  "conversationHistory": {
    "type": "array",
    "required": false,
    "description": "Previous messages in the conversation",
    "items": {
      "type": "object",
      "properties": {
        "role": { 
          "type": "string",
          "enum": ["user", "assistant"]
        },
        "content": { "type": "string" }
      }
    }
  },
  "SystemPrompt": {
    "type": "string",
    "required": false,
    "description": "Game data context for analysis"
  }
}
```

**What changed:**
- ❌ Removed: `conversationId` (no more thread IDs)
- ✅ Added: `conversationHistory` (array of messages)
- ✅ Kept: `message` and `SystemPrompt` (unchanged)

#### Step 3: Replace BuildShip Function Code

Replace your entire function code with the new implementation from `buildship-responses-api.ts`:

**Location:** `/Users/chrishabib/Documents/new-wagerproof/wagerproof-mobile/buildship-responses-api.ts`

**Key changes in the new code:**
```typescript
// OLD: Assistants API with threads
const stream = openai.beta.threads.runs.stream(threadId, {
  assistant_id: assistantId,
  instructions: systemPrompt
});

// NEW: Responses API with messages
const stream = await openai.responses.create({
  model: "gpt-5",
  input: messagesArray,
  tools: [{ type: "web_search" }],  // ✅ Web search enabled!
  stream: true
});
```

#### Step 4: Test BuildShip Endpoint

Before deploying, test with this curl command:

```bash
curl -X POST https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are today'\''s NFL injury reports?",
    "conversationHistory": [],
    "SystemPrompt": "Today'\''s games: Bills vs Chiefs..."
  }'
```

**Expected response:**
You should see text streaming back character by character. If web search is working, the response will include current information.

#### Step 5: Deploy BuildShip
1. Click "Deploy" in BuildShip
2. Wait for deployment to complete
3. Note the endpoint URL (should be the same)

### Part 2: Update Mobile App (Already Done! ✅)

The mobile app has already been updated in `WagerBotChat.tsx`. Here's what changed:

#### Changes Made:

**1. Request Payload** (lines 340-378)
```typescript
// OLD: Send thread ID
{
  message: "...",
  conversationId: "thread_abc123..."
}

// NEW: Send conversation history
{
  message: "...",
  conversationHistory: [
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ]
}
```

**2. Streaming Parser** (lines 392-429)
```typescript
// OLD: Parse SSE events, extract thread IDs
if (eventData.threadId) { ... }
if (eventData.delta?.content) { ... }

// NEW: Simple plain text streaming
currentContent += newText;
```

**3. Supabase Storage** (lines 431-507)
```typescript
// OLD: Store OpenAI thread ID
createThread(userId, message, openaiThreadId)

// NEW: No OpenAI thread ID needed
createThread(userId, message, undefined)
```

### Part 3: Testing

#### Test 1: First Message (No History)
1. Open mobile app
2. Send: "Tell me about today's games"
3. **Expected:**
   - ✅ Response streams in real-time
   - ✅ Message saved to Supabase
   - ✅ Thread created with auto-generated title

**Check logs for:**
```
📤 Sending message to BuildShip (Responses API)...
📝 Including conversation history (0 messages)
✅ UI updated in real-time
✅ Created new Supabase thread: [uuid]
```

#### Test 2: Follow-up Message (With History)
1. Send: "What about injuries?"
2. **Expected:**
   - ✅ Context maintained from previous message
   - ✅ WagerBot remembers what games you asked about
   - ✅ Messages saved to same thread

**Check logs for:**
```
📝 Including conversation history (2 messages)
✅ UI updated in real-time
📝 Updating existing thread: [uuid]
```

#### Test 3: Web Search (NEW!)
1. Clear chat (start fresh)
2. Send: "What are the latest NFL injury reports from today?"
3. **Expected:**
   - ✅ WagerBot searches the web
   - ✅ Returns current, real-time information
   - ✅ Mentions today's date and sources

**Signs web search worked:**
- Response includes very recent information (today/yesterday)
- May mention specific dates or sources
- BuildShip logs show: `🔧 Tool call in progress...`

#### Test 4: Context Length
1. Have a conversation with 25+ messages
2. **Expected:**
   - ✅ Only last 20 messages sent to API
   - ✅ Performance stays fast
   - ✅ No context overflow errors

**Check logs for:**
```
📝 Including conversation history (20 messages)
```

#### Test 5: Chat History Persistence
1. Send several messages
2. Close app completely
3. Reopen app
4. Open chat history drawer
5. Select the conversation
6. **Expected:**
   - ✅ All messages restored
   - ✅ Can continue conversation
   - ✅ Context maintained

### Part 4: Verify Everything Works

#### ✅ Checklist:

- [ ] **BuildShip deployed** with new Responses API code
- [ ] **First message works** (creates new thread)
- [ ] **Follow-up works** (maintains context)
- [ ] **Streaming works** (see text appear in real-time)
- [ ] **Web search works** (test with current events question)
- [ ] **Supabase storage works** (messages persist)
- [ ] **Chat history works** (can load old conversations)
- [ ] **Thread titles work** (auto-generated titles appear)

## 🔧 Troubleshooting

### Issue: "No response from BuildShip"

**Check:**
1. BuildShip endpoint URL is correct
2. BuildShip workflow is deployed (not in draft)
3. OpenAI API key is configured in BuildShip secrets
4. Check BuildShip logs for errors

**Fix:**
```bash
# Test endpoint directly
curl -X POST [your-endpoint] \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Issue: "Web search not working"

**Check BuildShip code includes:**
```typescript
tools: [
  { type: "web_search" }  // ✅ This line must be present
]
```

**Test:**
Ask a question that REQUIRES current information:
- "What happened in the NFL yesterday?"
- "What are today's injury reports?"
- "What's the weather for tonight's game?"

### Issue: "Context not maintained"

**Check mobile logs for:**
```
📝 Including conversation history (X messages)
```

If X is 0, the history isn't being sent.

**Fix:**
Ensure `messages` state includes both user and assistant messages:
```typescript
const conversationHistory = messages
  .slice(-20)
  .map(msg => ({
    role: msg.role,
    content: msg.content
  }));
```

### Issue: "Response is cut off"

**Possible causes:**
1. Context too long (>128k tokens)
2. Network timeout
3. BuildShip timeout

**Fix:**
Reduce history length in mobile app:
```typescript
const conversationHistory = messages
  .slice(-10)  // ⬅️ Reduce from 20 to 10
  .map(msg => ({ role: msg.role, content: msg.content }));
```

### Issue: "Streaming is slow or choppy"

**Check:**
1. Network connection quality
2. BuildShip region (closer = faster)
3. Model selection (gpt-4 slower than gpt-3.5)

**Optimization:**
Use `gpt-4-turbo` or `gpt-3.5-turbo` for faster responses:
```typescript
const stream = await openai.responses.create({
  model: "gpt-4-turbo",  // ⬅️ Faster than gpt-4
  // ...
});
```

## 📊 Monitoring & Analytics

### What to Monitor

1. **Response Times**
   - BuildShip logs: Check `Stream complete` timestamps
   - Target: <5 seconds for typical responses

2. **Web Search Usage**
   - BuildShip logs: Count `Tool call in progress` events
   - This indicates web searches being performed

3. **Context Size**
   - Mobile logs: Check `Including conversation history (X messages)`
   - Keep average <15 messages for best performance

4. **Error Rates**
   - BuildShip logs: Monitor for API errors
   - Mobile logs: Check for `FAILED TO SAVE TO SUPABASE`

### Cost Estimation

**Responses API Pricing (approximate):**
- Input tokens: $0.03 per 1K tokens
- Output tokens: $0.06 per 1K tokens
- Web search: Included, no extra cost

**Typical conversation:**
- First message: ~1,000 input tokens, ~500 output tokens = $0.06
- Follow-up (10 messages history): ~2,000 input, ~500 output = $0.09
- Per user per day: ~$1-3 (depending on usage)

## 🚀 Next Steps

After successful migration:

### 1. Enable Image Analysis
Add image upload capability:
```typescript
const messages = [
  {
    role: "user",
    content: [
      { type: "input_text", text: "Analyze this play" },
      { type: "input_image", image_url: imageUri }
    ]
  }
];
```

### 2. Add File Search
For historical data and scouting reports:
```typescript
tools: [
  { type: "web_search" },
  { 
    type: "file_search",
    vector_store_ids: ["vs_abc123"]
  }
]
```

### 3. Optimize Context Management
Smart history pruning:
```typescript
// Keep only important messages
const conversationHistory = messages
  .filter(msg => msg.content.length > 20)  // Skip short messages
  .slice(-15)  // Keep last 15 substantive messages
```

### 4. Add Context Indicators
Show users when web search is active:
```typescript
if (event.type === 'response.function_call_arguments.delta') {
  // Show "🔍 Searching the web..." indicator
}
```

## 📝 Summary of Changes

### What's Different

| Aspect | Before (Assistants API) | After (Responses API) |
|--------|------------------------|----------------------|
| **Thread Management** | OpenAI manages threads | You manage history |
| **State** | Server-side (thread ID) | Client-side (messages array) |
| **Web Search** | ❌ Not available | ✅ Built-in |
| **Complexity** | More complex setup | Simpler, more control |
| **Cost** | Per assistant run | Per token |

### What's the Same

| Aspect | Status |
|--------|--------|
| **Streaming** | ✅ Still works |
| **Supabase Storage** | ✅ Still works |
| **Chat History** | ✅ Still works |
| **Thread Titles** | ✅ Still works |
| **Game Context** | ✅ Still works |
| **UI/UX** | ✅ Unchanged |

## 🎉 You're Done!

Once all tests pass, your WagerBot is now powered by the Responses API with:
- 🔍 Real-time web search
- 📸 Image analysis (ready to enable)
- 🎯 Better control
- 📊 Clearer costs
- 🚀 Same great UX

### Questions?

If you encounter issues:
1. Check BuildShip logs
2. Check mobile console logs
3. Test endpoint with curl
4. Verify OpenAI API key has Responses API access

### Need Help?

Common issues:
- **No streaming**: Check BuildShip return statement (must return stream directly)
- **No web search**: Verify tools array includes `{ type: "web_search" }`
- **Context issues**: Check conversationHistory is being sent correctly
- **Supabase errors**: Verify thread and message tables exist

