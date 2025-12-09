# BuildShip SSE Streaming Fix

## Problem
BuildShip is returning `Content-Type: application/json` instead of `Content-Type: text/event-stream`, causing the stream to be buffered and returned as JSON.

## Solution Options

### Option 1: Set Content-Type in "Set Response Header" Node (RECOMMENDED)

In your BuildShip workflow, add a second header to your "Set Response Header" node:

**Header 1 (existing):**
- Header Key: `x-thread-id`
- Header Value: `Thread ID`
- Expose Header: `True`

**Header 2 (ADD THIS):**
- Header Key: `Content-Type`
- Header Value: `text/event-stream`
- Expose Header: `False`

### Option 2: Return Stream with Headers Object

Modify the return statement in your BuildShip function:

```typescript
// At the end of your function
return {
  stream: stream,
  threadId: threadId,
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
};
```

### Option 3: Use req.type (If req is available)

If `req` object is available in your BuildShip node:

```typescript
// At the beginning of your function
if (req && req.type !== undefined) {
  req.type = "text/event-stream";
}
```

## Why This Matters

**With `application/json`:**
- BuildShip buffers entire response
- Returns complete stream as serialized JSON object
- No real-time streaming

**With `text/event-stream`:**
- BuildShip streams chunks in real-time
- Each SSE event sent as it's generated
- Mobile app receives data progressively

## After Fixing

Run the test script to verify:
```bash
node wagerproof-mobile/test-buildship-stream.js
```

You should see:
```
Content-Type: text/event-stream
🌊 STREAMING DATA:

📦 CHUNK #1
data: {"threadId":"thread_..."}

📦 CHUNK #2
data: {"delta":{"content":[{"text":{"value":"Hello"}}]}}

📦 CHUNK #3
data: {"delta":{"content":[{"text":{"value":"!"}}]}}
```

NOT:
```
Content-Type: application/json
{"stream":{"_readableState":{"buffer":[...]}}}
```

