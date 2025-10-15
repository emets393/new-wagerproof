# Agent ID Extraction Update

## What Changed

I've updated the code to extract and use the `agentId` from your BuildShip response if it's included.

## Changes Made

### 1. Updated `chatSession.ts`

**Changed return type:**
```typescript
// Before
async getClientSecret(user: User): Promise<string>

// After  
async getClientSecret(user: User): Promise<{ clientSecret: string; agentId?: string }>
```

**Now extracts both:**
- `clientSecret` (required for session)
- `agentId` (if present in response)

**Logs agent ID:**
```typescript
console.log('Client secret extracted successfully:', { 
  length: clientSecret.length,
  prefix: clientSecret.substring(0, 15) + '...',
  hasAgentId: !!agentId,  // Shows if agent ID was found
  agentId: agentId        // Shows the actual agent ID
});
```

### 2. Updated `ChatKitWrapper.tsx`

**Now uses agent ID dynamically:**
```typescript
const [extractedAgentId, setExtractedAgentId] = useState<string | undefined>();

const { control, error } = useChatKit({
  ...(extractedAgentId ? { agentId: extractedAgentId } : {}),  // ← Adds agentId if found
  api: {
    async getClientSecret(existing) {
      const result = await chatSessionManager.getClientSecret(user, existing);
      
      // Store agent ID if found
      if (result.agentId && !extractedAgentId) {
        console.log('🎯 Agent ID extracted from response:', result.agentId);
        setExtractedAgentId(result.agentId);
      }
      
      return result.clientSecret;
    }
  }
});
```

## What to Look For

### Console Logs

When you open WagerBot Chat, watch for:

```
🔵 ChatKitWrapper rendering { ... }
⏳ Waiting for ChatKit control...
Calling BuildShip workflow for client secret...
BuildShip response status: 200
BuildShip result received: { sessionResponse: { ... } }
Client secret extracted successfully: { 
  length: 87, 
  prefix: "ek_...",
  hasAgentId: true/false,  // ← Check this!
  agentId: "agent_xxx"     // ← Check this!
}
```

**If hasAgentId: true**
You'll also see:
```
🎯 Agent ID extracted from response: agent_xxx
```

**If hasAgentId: false**
The agent ID is NOT in your BuildShip response, and you need to:
1. Add it to your BuildShip workflow configuration
2. Or hardcode it in the frontend (if you know it)

## Three Scenarios

### Scenario 1: Agent ID in Response ✅
If your BuildShip returns an `agentId` field:
- Code will extract it automatically
- ChatKit will use it
- AI responses should work

### Scenario 2: No Agent ID in Response ❌
If BuildShip doesn't return `agentId`:
- Console will show `hasAgentId: false`
- You need to add it to BuildShip workflow
- Or hardcode it (see below)

### Scenario 3: Hardcode Agent ID (If Needed)

If you know your agent ID but BuildShip doesn't return it:

```typescript
// In ChatKitWrapper.tsx
const { control, error } = useChatKit({
  agentId: 'agent_YOUR_ID_HERE',  // ← Hardcode it
  api: {
    // ... rest of code
  }
});
```

## Testing Steps

1. **Open browser** and go to WagerBot Chat
2. **Open console** (F12)
3. **Watch for logs** especially:
   - `hasAgentId: true` or `false`
   - `agentId: ...` (if present)
   - `🎯 Agent ID extracted...` (if found)

4. **Send a test message**
5. **Check if you get AI response**

## If Still No Responses

### Case A: Agent ID Found (`hasAgentId: true`)
- Agent ID is being used
- Issue is likely in BuildShip workflow configuration
- Check BuildShip logs for message processing

### Case B: No Agent ID (`hasAgentId: false`)
- Need to add agent ID to BuildShip
- OR hardcode it if you know it
- Check OpenAI ChatKit dashboard for your agent ID

## Where to Find Agent ID

1. **OpenAI Platform**
   - Go to ChatKit dashboard
   - Find your agent/assistant
   - Copy the agent ID (starts with `agent_`)

2. **BuildShip Dashboard**
   - Go to your workflow
   - Check ChatKit node configuration
   - Look for agent ID setting

3. **BuildShip Response**
   - Check if it's in the response already
   - Console log will show it

## Expected Behavior

**With agent ID:**
```
User: "Hello"
  ↓
ChatKit knows which agent to use
  ↓
Agent processes message
  ↓
User sees: "Hi! How can I help you?"
```

**Without agent ID:**
```
User: "Hello"
  ↓
ChatKit doesn't know which agent to use
  ↓
No response ❌
```

## Next Steps

1. Check console for `hasAgentId: true/false`
2. If `false`, find your agent ID
3. Either:
   - Add it to BuildShip response, OR
   - Hardcode it in ChatKitWrapper
4. Test again

The code is now ready to use the agent ID if BuildShip provides it! 🚀

