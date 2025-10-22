# OpenAI Responses API Migration Guide

## Overview

This guide shows how to migrate from the **Assistants API** (with threads) to the **Responses API** to get:
- ✅ Built-in web search
- ✅ Built-in image analysis
- ✅ Simpler conversation management
- ✅ More flexible tool usage

## What's Changing

### Before (Assistants API)
```typescript
// Create/use thread
const thread = await openai.beta.threads.create({
  messages: [{ role: "user", content: prompt }]
});

// Stream with assistant
const stream = openai.beta.threads.runs.stream(threadId, {
  assistant_id: assistantId,
  instructions: systemPrompt,
  tools: [{ type: "file_search" }]
});
```

### After (Responses API)
```typescript
// Send messages directly with context
const stream = await openai.responses.create({
  model: "gpt-5",
  input: conversationHistory,  // Array of messages
  tools: [
    { type: "web_search" },      // ✅ NEW: Built-in web search
    { type: "file_search" }      // ✅ Still available
  ],
  stream: true
});
```

## Key Differences

| Feature | Assistants API | Responses API |
|---------|---------------|---------------|
| **State Management** | Server-side (threads) | Client-side (message array) |
| **Web Search** | ❌ Not available | ✅ Built-in |
| **Image Analysis** | Limited | ✅ Built-in |
| **Conversation History** | Stored by OpenAI | You manage it |
| **System Prompt** | `instructions` param | First message with `role: "system"` |
| **Streaming Format** | Assistant events | Standard chat events |

## Migration Steps

### 1. Update BuildShip Code

Replace your entire BuildShip function with this new implementation:

```typescript
import OpenAI from "openai";
import { Readable } from "stream";

/**
 * WagerBot - Responses API Implementation
 * Supports web search, image analysis, and streaming responses
 */
export default async function wagerBotResponses({
  message,
  conversationHistory,
  SystemPrompt,
}: {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  SystemPrompt?: string;
}, {
  auth,
  req,
  logging,
}: {
  auth: any;
  req: any;
  logging: any;
}) {
  const apiKey = auth.getKey();
  const openai = new OpenAI({ apiKey });

  if (!message) {
    throw new Error("User message is required");
  }

  // Build the messages array
  const messages: any[] = [];

  // 1. Add system prompt (if provided)
  const basePrompt = "You are WagerBot, an expert sports betting analyst specialized in NFL and College Football. You provide insightful analysis, betting predictions, and game insights.";
  const systemContent = SystemPrompt 
    ? `${basePrompt}\n\n${SystemPrompt}\n\nUse this data to provide insightful analysis and answer questions about specific matchups.`
    : basePrompt;

  messages.push({
    role: "system",
    content: systemContent
  });

  // 2. Add conversation history (if any)
  if (conversationHistory && Array.isArray(conversationHistory)) {
    messages.push(...conversationHistory);
  }

  // 3. Add current user message
  messages.push({
    role: "user",
    content: message
  });

  logging.log(`Processing message with ${messages.length} total messages in context`);

  // Create streaming response with tools enabled
  const stream = await openai.responses.create({
    model: "gpt-5",
    input: messages,
    tools: [
      { type: "web_search" },      // ✅ Enable web search
      // { type: "file_search" }    // ✅ Uncomment if using vector stores
    ],
    stream: true,
  });

  // Create a readable stream for BuildShip
  const readable = new Readable();
  readable._read = function() {};

  // Handle the streaming response
  (async () => {
    try {
      let fullContent = '';
      
      for await (const event of stream) {
        // Handle different event types
        if (event.type === 'response.output_text.delta') {
          // Text delta from the response
          const delta = event.delta;
          if (delta) {
            readable.push(delta);
            fullContent += delta;
          }
        }
        else if (event.type === 'response.output_text.done') {
          // Text generation complete
          logging.log(`Response complete: ${fullContent.length} characters`);
        }
        else if (event.type === 'response.done') {
          // Entire response complete
          logging.log('Stream finished');
        }
        // Handle tool calls (web search, etc.)
        else if (event.type === 'response.function_call_arguments.delta') {
          logging.log('Tool being called...');
        }
      }

      // End the stream
      readable.push(null);
    } catch (error) {
      logging.log(`Stream error: ${error.message}`);
      readable.push(null);
    }
  })();

  return readable;
}
```

### 2. Update Mobile App Request

The mobile app needs to send conversation history instead of just `conversationId`.

#### Current Code (lines 344-360 in WagerBotChat.tsx)
```typescript
const requestBody: any = {
  message: messageText,
};

if (gameContext && gameContext.length > 0) {
  requestBody.SystemPrompt = gameContext;
}

if (threadId && threadId.startsWith('thread_')) {
  requestBody.conversationId = threadId;
}
```

#### New Code
```typescript
const requestBody: any = {
  message: messageText,
};

// Include game context
if (gameContext && gameContext.length > 0) {
  requestBody.SystemPrompt = gameContext;
}

// Include conversation history (last 10 messages)
const conversationHistory = messages
  .slice(-10)  // Last 10 messages for context
  .map(msg => ({
    role: msg.role,
    content: msg.content
  }));

if (conversationHistory.length > 0) {
  requestBody.conversationHistory = conversationHistory;
}
```

### 3. Update BuildShip Input Schema

In your BuildShip workflow settings, update the input schema:

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
        "role": { "type": "string" },
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

### 4. Remove Thread ID Management

Since the Responses API is stateless, you don't need thread IDs anymore:

#### Remove from Mobile App
1. Remove `threadId` state management
2. Remove thread ID extraction from stream
3. Simplify to just conversation history

#### Keep in Supabase
- Keep the `chat_threads` and `chat_messages` tables
- Use `thread.id` (Supabase UUID) as the session identifier
- Remove `openai_thread_id` dependency

## Benefits of Migration

### 1. Built-in Web Search
```typescript
// User: "What are today's NFL injury reports?"
// WagerBot will automatically search the web for current information
```

### 2. Image Analysis
```typescript
// In the future, users can send images
const messages = [
  {
    role: "user",
    content: [
      { type: "input_text", text: "Analyze this play" },
      { type: "input_image", image_url: "https://..." }
    ]
  }
];
```

### 3. Simplified State Management
- No thread creation/management
- Conversation history stored locally
- Easier debugging

### 4. More Control
- See exactly what context is sent
- Control history length (10, 20, 50 messages)
- Easier to implement features like "clear context"

## Migration Checklist

### BuildShip Side
- [ ] Update function to use `openai.responses.create()`
- [ ] Add `conversationHistory` parameter
- [ ] Enable `web_search` tool
- [ ] Update input schema
- [ ] Test streaming still works
- [ ] Deploy changes

### Mobile App Side
- [ ] Update request to send `conversationHistory` instead of `conversationId`
- [ ] Remove thread ID extraction logic
- [ ] Keep Supabase storage (using internal thread IDs)
- [ ] Test conversation continuity
- [ ] Verify streaming display

### Testing
- [ ] Send first message (no history)
- [ ] Send follow-up message (with history)
- [ ] Verify context is maintained
- [ ] Test web search (ask about current events)
- [ ] Check conversation persistence in Supabase

## Example Flow

### First Message
```typescript
// Mobile sends:
{
  message: "Tell me about today's NFL games",
  SystemPrompt: "[game data...]",
  conversationHistory: []  // Empty
}

// BuildShip creates:
[
  { role: "system", content: "You are WagerBot... [game data]" },
  { role: "user", content: "Tell me about today's NFL games" }
]
```

### Follow-up Message
```typescript
// Mobile sends:
{
  message: "What about injuries?",
  SystemPrompt: "[game data...]",
  conversationHistory: [
    { role: "user", content: "Tell me about today's NFL games" },
    { role: "assistant", content: "Here are today's matchups..." }
  ]
}

// BuildShip creates:
[
  { role: "system", content: "You are WagerBot... [game data]" },
  { role: "user", content: "Tell me about today's NFL games" },
  { role: "assistant", content: "Here are today's matchups..." },
  { role: "user", content: "What about injuries?" }  // ✅ Web search triggered!
]
```

## Streaming Format Changes

### Assistants API Events
```typescript
event: 'thread.message.delta'
data: { delta: { content: [{ text: { value: "Hello" }}] }}
```

### Responses API Events
```typescript
event: 'response.output_text.delta'
data: { delta: "Hello" }
```

Your current mobile app streaming parser should work with minimal changes since both send text chunks.

## Troubleshooting

### "No web search results"
- Make sure you added `{ type: "web_search" }` to tools array
- Web search is triggered automatically when needed

### "Context too long"
- Limit conversation history to last 10-20 messages
- Responses API has ~128k token context window

### "Streaming not working"
- Verify you're returning the `Readable` stream directly
- Check that you're iterating the stream with `for await`

## Next Steps

After migration is complete, you can explore:

1. **Image analysis**: Allow users to upload game screenshots
2. **File uploads**: Let users upload PDF scouting reports
3. **Real-time data**: Web search for live injury reports, weather, etc.
4. **Better context**: Use file_search with vector stores for historical data

## Questions?

Common questions:

**Q: Do I lose conversation history?**
A: No! It's now stored client-side and in Supabase, giving you more control.

**Q: Is this more expensive?**
A: Similar cost, but you pay per token sent (including history), not per assistant run.

**Q: Can I still use file_search?**
A: Yes! Add `{ type: "file_search", vector_store_ids: ["vs_..."] }` to tools.

**Q: What about function calling?**
A: Still supported! Add functions to the tools array as before.

