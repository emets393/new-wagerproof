# BuildShip Payload Debug Guide

## Current Payload Structure Being Sent

The mobile app is now sending this exact JSON structure to BuildShip:

### First Message (No Thread ID)
```json
{
  "prompt": "User's message text here"
}
```

### With Game Context
```json
{
  "prompt": "User's message text here",
  "instructions": "GAME DATA:\n\nNFL Games - Week 8, 2024:\n..."
}
```

### Subsequent Messages (With Thread ID)
```json
{
  "prompt": "User's follow-up message",
  "threadId": "thread_abc123...",
  "instructions": "GAME DATA:\n\nNFL Games - Week 8, 2024:\n..."
}
```

## What BuildShip Expects (Based on Your Code)

According to your BuildShip function signature:
```typescript
export default async function assistant({
    assistantId,      // Should be provided in BuildShip workflow config
    threadId,         // ✅ We send this (if available)
    prompt,           // ✅ We send this
    builtInTools,     // Should be provided in BuildShip workflow config
    instructions,     // ✅ We send this (game context)
    streamContentForm,// Should be provided in BuildShip workflow config
}: NodeInputs, ...
```

## Debugging "User Prompt is Undefined" Error

If you're getting "User Prompt is undefined", check these:

### 1. BuildShip Input Configuration
Make sure your BuildShip workflow has `prompt` configured as an input:

**In BuildShip Workflow Editor:**
- Go to your workflow's inputs
- Ensure there's a field named `prompt` (case-sensitive!)
- Type should be: `string`
- Should be marked as required or have a default value

### 2. Check BuildShip REST API Configuration
The BuildShip REST API node should be configured to accept:
```javascript
{
  "prompt": { "type": "string", "required": true },
  "threadId": { "type": "string", "required": false },
  "instructions": { "type": "string", "required": false }
}
```

### 3. Verify the Mobile App is Sending Data
Check the console logs when sending a message. You should see:
```
🎬 Starting sendMessage function
  - Input text: Testing
  - Message content: Testing
  - Message content length: 7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 REQUEST PAYLOAD TO BUILDSHIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full payload: {
  "prompt": "Testing"
}

Payload structure:
  - prompt: "Testing"
  - prompt type: string
  - threadId: NOT_PRESENT
  - instructions: NOT_PRESENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Common Issues & Solutions

### Issue 1: Field Name Mismatch
**Problem**: BuildShip expects `userPrompt` but we're sending `prompt`

**Solution**: Update BuildShip workflow to accept `prompt` instead of `userPrompt`, OR update the mobile code:
```typescript
const requestBody: any = {
  userPrompt: userMessage.content,  // Change if BuildShip expects this name
};
```

### Issue 2: Missing Required Fields
**Problem**: BuildShip requires `assistantId` from the request

**Solution**: Add it to the request body:
```typescript
const requestBody: any = {
  assistantId: 'asst_YOUR_ASSISTANT_ID_HERE',
  prompt: userMessage.content,
};
```

### Issue 3: Wrong Content-Type
**Problem**: BuildShip can't parse JSON body

**Solution**: Verify headers are correct (we're already doing this):
```typescript
headers: {
  'Content-Type': 'application/json',
}
```

### Issue 4: BuildShip Workflow Configuration
**Problem**: The assistant node isn't receiving the prompt parameter

**Solution**: Check the BuildShip workflow:
1. Open your workflow in BuildShip editor
2. Find the "Assistant" node
3. Check the `prompt` input mapping
4. Make sure it's mapped to `request.body.prompt` or similar

## Testing Steps

1. **Test with minimal payload** - Comment out optional fields:
```typescript
const requestBody: any = {
  prompt: userMessage.content,
  // instructions: gameContext,  // Comment this out temporarily
  // threadId: threadId,          // Comment this out temporarily
};
```

2. **Test with hardcoded value** - To rule out content issues:
```typescript
const requestBody: any = {
  prompt: "test message",  // Hardcoded
};
```

3. **Check BuildShip logs** - In BuildShip:
   - Open your workflow
   - Click "Logs" tab
   - Send a test message
   - See what parameters BuildShip actually receives

4. **Use BuildShip's Test Feature**:
   - In BuildShip editor, click "Test"
   - Send this exact payload:
   ```json
   {
     "prompt": "Hello"
   }
   ```
   - See if it works

## What to Check in Your BuildShip Workflow

Share a screenshot or description of:
1. The REST API node configuration (input parameters)
2. The Assistant node configuration (how inputs are mapped)
3. Any middleware or transformation nodes between REST API and Assistant
4. The exact error message from BuildShip logs (not just the mobile app error)

## Expected BuildShip Response

Your BuildShip should return:
- A streaming response (text chunks), OR
- A JSON response with the message

And somewhere it should include the thread ID:
- In response headers: `x-thread-id: thread_abc123...`, OR
- In the response body: `{ threadId: "thread_abc123...", message: "..." }`, OR
- In the stream: `[threadId:thread_abc123...]<message content>`

