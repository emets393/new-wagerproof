# BuildShip Instructions Integration - THE RIGHT WAY

## ✅ The Correct Approach

We're now passing the game data context as `instructions` to your BuildShip workflow, which will then pass it to OpenAI as the system message. This is the proper way to do it!

## 🔄 How It Works

### 1. Frontend (ChatKitWrapper)
When the chat initializes, we call BuildShip with instructions:

```javascript
// Build system message with game data
const systemMessage = `You are WagerBot, an expert sports betting analyst...
${systemContext}  // All the game data
Use this data to provide insightful analysis...`;

// Pass it to BuildShip
const result = await chatSessionManager.getClientSecret(user, existing, systemMessage);
```

### 2. BuildShip Workflow
Your BuildShip endpoint (`chatKitSessionGenerator-2fc1c5152ebf`) should:

1. **Receive the payload:**
   ```json
   {
     "userId": "user_123",
     "userEmail": "user@example.com",
     "workflowId": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0",
     "timestamp": "2025-01-26T...",
     "stream": true,
     "instructions": "You are WagerBot... [FULL GAME DATA HERE]"
   }
   ```

2. **Pass instructions to OpenAI ChatKit:**
   - Use the `instructions` field when creating/configuring the agent
   - This becomes the system message in the OpenAI API call

3. **Return the client secret:**
   ```json
   {
     "clientSecret": "cs_...",
     "agentId": "agent_..."
   }
   ```

## 🎯 What You Need to Configure in BuildShip

### Option A: Dynamic Instructions Per Session
If you want each session to have different instructions (recommended):

1. Add an `instructions` input parameter to your workflow
2. Use that parameter when creating the ChatKit session
3. Pass it to the OpenAI agent configuration

### Option B: Append to Existing Instructions
If you have base instructions for WagerBot:

1. Keep your base agent instructions
2. Append the dynamic game data from the `instructions` parameter
3. Combine them into the final system message

## 📊 Console Output to Look For

### When Opening the Chat:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 SENDING INSTRUCTIONS TO BUILDSHIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instructions length: 5400
Instructions preview: You are WagerBot, an expert sports betting analyst. You have access to detailed game data...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 Getting client secret for workflow: wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0

✅ Client secret obtained:
  length: 45
  prefix: cs_1234567890abcdef...
  hasContext: true
  instructionsSent: true
```

## 🔍 Debugging

### 1. Check BuildShip Logs
In your BuildShip dashboard, check the logs for the workflow execution:
- Is the `instructions` field being received?
- What's the length of the instructions?
- Are they being passed to OpenAI?

### 2. Test the API Directly
You can test the BuildShip endpoint directly:

```bash
curl -X POST https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "userEmail": "test@example.com",
    "workflowId": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "stream": true,
    "instructions": "Test instructions with game data..."
  }'
```

### 3. Verify Agent Configuration
Make sure your OpenAI agent in BuildShip:
- Accepts dynamic instructions
- Doesn't have hardcoded instructions that override the parameter
- Is configured to use the `instructions` field

## 📝 Example BuildShip Workflow Structure

```
Input Parameters:
├── userId (string)
├── userEmail (string)
├── workflowId (string)
├── timestamp (string)
├── stream (boolean)
└── instructions (string) ← NEW! This is the game data

Processing:
1. Create or get ChatKit session
2. Configure agent with instructions:
   {
     systemMessage: instructions,
     model: "gpt-4",
     // ... other config
   }
3. Return client secret

Output:
{
  clientSecret: "cs_...",
  agentId: "agent_..."
}
```

## ✅ Benefits of This Approach

1. ✅ **Server-side control** - Instructions are set on the server
2. ✅ **Persistent** - System message stays for the entire session
3. ✅ **Secure** - Context isn't modified client-side
4. ✅ **Reliable** - OpenAI definitely receives the instructions
5. ✅ **Dynamic** - Different pages can have different contexts

## 🧪 Testing

Ask the AI:
```
Can you list all the games you have data for? For each game, tell me the teams, the spread, and which team the model favors.
```

**✅ Success:** AI lists specific games with actual data
**❌ Failure:** AI says it doesn't have that information

## 🚨 Troubleshooting

### If AI still doesn't have the data:

1. **Check BuildShip logs** - Is `instructions` field being received?
2. **Verify agent setup** - Is the agent using the instructions parameter?
3. **Check for override** - Does the agent have hardcoded instructions?
4. **Test simpler instructions** - Try a short test message first
5. **Check token limits** - Is the instructions string too long?

### Common Issues:

❌ **BuildShip not receiving instructions**
→ Check the fetch payload in browser network tab

❌ **Agent ignoring instructions**  
→ Configure agent to use dynamic instructions

❌ **Instructions too long**
→ Reduce to top 15-20 games instead of all games

❌ **Old session still active**
→ Clear sessions and refresh to get new client secret

