# No AI Responses - Troubleshooting Guide

## Current Status
✅ Client secret obtained successfully
✅ ChatKit UI loads and shows message input
✅ You can send messages
❌ Not receiving AI responses

## Root Cause
The issue is in your **BuildShip workflow configuration**. The workflow is handling session creation but not handling the actual chat message processing.

## ChatKit Workflow Structure

ChatKit requires your BuildShip workflow to handle TWO different operations:

### 1. Session Creation (Working ✅)
- Endpoint called once when chat initializes
- Returns `client_secret`
- This is working for you

### 2. Message Processing (Not Working ❌)
- Endpoint called for each message sent
- Should process the message with OpenAI
- Should return AI response
- This is what's missing

## What Your BuildShip Workflow Needs

Your workflow with ID `wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0` needs to:

### Required Nodes:

1. **Input Node**: Receives chat messages
2. **OpenAI ChatKit Node**: Handles the conversation
3. **AI Model Node**: Processes messages with GPT
4. **Response Node**: Returns AI reply

### Typical BuildShip ChatKit Workflow Setup:

```
[Trigger/Input]
      ↓
[ChatKit Session Handler]
      ↓
[OpenAI Chat Completion]
      ↓
[Format Response]
      ↓
[Return to ChatKit]
```

## Check Your BuildShip Workflow

### Go to BuildShip Dashboard:

1. Find workflow: `wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0`
2. Check if it has:
   - ✅ ChatKit Session Generator node (you have this - it's working)
   - ❓ ChatKit Message Handler node (check if this exists)
   - ❓ OpenAI Chat Completion node (for generating responses)

### What You Might Be Missing:

Your workflow might only have the **session creation** part but not the **message handling** part.

## Two Solutions

### Solution 1: Add Message Handling to Existing Workflow (Recommended)

In your BuildShip workflow, add these nodes:

1. **ChatKit Message Handler Node**
   - Receives messages from ChatKit
   - Extracts message content
   - Passes to AI model

2. **OpenAI Chat Completion Node**
   - Model: `gpt-4` or `gpt-3.5-turbo`
   - System prompt: Configure WagerBot personality
   - Takes user message as input

3. **Response Formatter**
   - Formats AI response for ChatKit
   - Returns in expected format

### Solution 2: Use Separate Workflow for Messages

Create a second workflow specifically for message handling:

1. Keep current workflow for session creation
2. Create new workflow for chat messages
3. Configure ChatKit to use both workflows

## Expected Workflow Behavior

When a user sends a message, BuildShip should:

```
User sends: "Hello"
      ↓
BuildShip receives request
      ↓
Extract message content
      ↓
Call OpenAI API with message
      ↓
Get AI response: "Hi! How can I help you?"
      ↓
Return response to ChatKit
      ↓
User sees AI reply
```

## Debug Steps

### 1. Check BuildShip Logs

In BuildShip dashboard:
- Go to your workflow
- Click "Logs" or "History"
- Send a test message from the chat
- Check if workflow receives the message
- Look for errors in the logs

### 2. Test Workflow Directly

In BuildShip:
- Click "Test" on your workflow
- Send a sample chat message
- See if it returns an AI response

### 3. Check OpenAI Configuration

Verify in BuildShip:
- OpenAI API key is configured
- API key has credits/quota available
- Model name is correct (gpt-4, gpt-3.5-turbo, etc.)

## Expected Request from ChatKit

When you send a message, ChatKit sends something like:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, can you help me?"
    }
  ],
  "session_id": "cksess_...",
  "user_id": "user_uuid"
}
```

## Expected Response to ChatKit

Your workflow should return:

```json
{
  "message": {
    "role": "assistant",
    "content": "Hi! I'd be happy to help you. What would you like to know?"
  }
}
```

## Common BuildShip Configuration Issues

### Issue 1: No Message Handler Node
**Symptom**: Messages send but no response
**Fix**: Add ChatKit message handler node to workflow

### Issue 2: OpenAI API Key Not Set
**Symptom**: Messages send but workflow fails
**Fix**: Configure OpenAI API key in BuildShip settings

### Issue 3: Wrong Model Configuration
**Symptom**: Workflow runs but times out
**Fix**: Check model name is valid (gpt-4, gpt-3.5-turbo, etc.)

### Issue 4: Incorrect Response Format
**Symptom**: Workflow completes but ChatKit doesn't show response
**Fix**: Format response according to ChatKit expectations

## Quick Test

### Test Your Workflow Manually:

1. Go to BuildShip dashboard
2. Find your workflow
3. Click "Test" or "Run"
4. Send this test payload:
   ```json
   {
     "messages": [
       {
         "role": "user",
         "content": "Hello"
       }
     ]
   }
   ```
5. Check if you get a response back

If this test fails, the issue is definitely in the BuildShip workflow configuration.

## Frontend Debugging

Add this to ChatKitWrapper.tsx to see what's happening:

```typescript
const { control, error } = useChatKit({
  api: {
    async getClientSecret(existing) {
      // ... existing code
    },
  },
  onMessage: (message) => {
    console.log('Message received:', message);
  },
  onError: (error) => {
    console.error('ChatKit error:', error);
  },
});
```

Check browser console for:
- Message sending confirmation
- Any error messages
- Response handling

## What to Check in Browser Console

When you send a message, you should see:
1. Message being sent
2. Request to BuildShip (check Network tab)
3. Response from BuildShip
4. AI response rendering in UI

If you see the request but no response, check:
- BuildShip logs for errors
- Network tab for response status
- Response body for errors

## Typical BuildShip ChatKit Setup

Your workflow should look like this:

```
┌─────────────────────────────┐
│  HTTP Trigger               │
│  POST /chatKitSession...    │
└──────────┬──────────────────┘
           │
           ├─── [Session Creation Path]
           │    └─> Return client_secret ✅
           │
           └─── [Message Handling Path]
                ├─> Receive message
                ├─> Call OpenAI
                ├─> Get AI response
                └─> Return to ChatKit ❌ (Missing?)
```

## Next Steps

1. **Go to BuildShip Dashboard**
   - Open your workflow
   - Check if message handling nodes exist
   - Review workflow logs

2. **Add Missing Nodes** (if needed)
   - ChatKit message handler
   - OpenAI chat completion
   - Response formatter

3. **Configure OpenAI**
   - Add API key if missing
   - Set model (gpt-3.5-turbo or gpt-4)
   - Configure system prompt for WagerBot

4. **Test the Workflow**
   - Use BuildShip test feature
   - Send sample message
   - Verify AI response comes back

5. **Deploy Changes**
   - Save workflow
   - Deploy to production
   - Test from your app

## WagerBot System Prompt Suggestion

When configuring the OpenAI node in BuildShip, use this system prompt:

```
You are WagerBot, an AI assistant specialized in sports betting analytics. 
You help users understand betting patterns, analyze games, and make informed 
betting decisions based on data. You have access to information about NFL, 
College Football, NBA, and NCAAB games. Be concise, helpful, and focus on 
data-driven insights. Always remind users to bet responsibly.
```

## Need More Help?

If you've checked all of the above and still having issues:

1. **Share BuildShip Workflow Screenshot**
   - Show the workflow nodes
   - Include any error messages from logs

2. **Check BuildShip Documentation**
   - Look for ChatKit integration guides
   - Review OpenAI node setup

3. **Test Endpoints Separately**
   - Test session creation endpoint
   - Test message handling endpoint
   - Verify both are working

The issue is almost certainly in the BuildShip workflow configuration, not in the frontend code. The frontend is working correctly since you can send messages and get the client secret.

