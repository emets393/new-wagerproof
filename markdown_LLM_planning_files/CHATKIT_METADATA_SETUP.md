# ChatKit Metadata System Prompt Setup (OFFICIAL WAY)

## ✅ The Official ChatKit Approach

We're now using ChatKit's **metadata** field to pass the system prompt with game data. This is the officially supported method!

## 📦 Request Structure

### Frontend sends:
```json
{
  "workflow": {
    "id": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0"
  },
  "user": "user_123",
  "metadata": {
    "system_prompt": "You are WagerBot... [FULL GAME DATA HERE]",
    "userEmail": "user@example.com",
    "timestamp": "2025-01-26T...",
    "stream": true
  }
}
```

## 🔧 BuildShip Workflow Configuration

### Step 1: Access Metadata in Your Workflow

In your BuildShip ChatKit workflow, you can access the metadata using:
```
{{metadata.system_prompt}}
```

### Step 2: Use It in Your Model Step

When you have a `run_model` or `run_completion` step, configure it like this:

```yaml
- type: run_model
  model: gpt-4
  input:
    messages:
      - role: system
        content: "{{metadata.system_prompt}}"
      - role: user
        content: "{{input.text}}"
```

### Step 3: (Alternative) Use in Tool/Agent Config

If you're using an agent or tool, inject it in the configuration:

```javascript
{
  agent: {
    model: "gpt-4",
    systemMessage: "{{metadata.system_prompt}}",
    // ... other config
  }
}
```

## 📊 Console Output

You'll see this purple banner when the system prompt is sent:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 SENDING SYSTEM PROMPT VIA METADATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
System prompt length: 5400
System prompt preview: You are WagerBot, an expert sports betting analyst...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🎯 Example: Complete BuildShip Workflow

### Input (automatically received from frontend):
- `metadata.system_prompt` - The full system message with game data
- `metadata.userEmail` - User's email
- `metadata.timestamp` - Request timestamp
- `input.text` - User's message

### Processing Steps:

```yaml
steps:
  - id: get_client_secret
    type: create_chatkit_session
    config:
      workflow_id: "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0"
    
  - id: run_conversation
    type: run_model
    model: gpt-4
    input:
      messages:
        - role: system
          content: "{{metadata.system_prompt}}"
        - role: user
          content: "{{input.text}}"
    
  - id: return_response
    type: return
    output:
      clientSecret: "{{get_client_secret.client_secret}}"
      agentId: "{{get_client_secret.agent_id}}"
```

## 🔍 Debugging in BuildShip

### 1. Check Incoming Metadata
In your workflow, add a log step to see the metadata:

```yaml
- id: log_metadata
  type: log
  message: "Received system_prompt: {{metadata.system_prompt}}"
```

### 2. Verify Prompt Length
```yaml
- id: log_length
  type: log
  message: "System prompt length: {{metadata.system_prompt.length}}"
```

### 3. Test with Simple Prompt
To verify it's working, temporarily hardcode a test:

```yaml
- role: system
  content: "{{metadata.system_prompt || 'TEST: Default system message'}}"
```

## 🧪 Testing

### 1. Open Browser Console
Look for the purple banner showing system prompt being sent

### 2. Check Network Tab
- Go to Network tab in DevTools
- Find the request to `chatKitSessionGenerator-2fc1c5152ebf`
- Check the payload - should see `metadata.system_prompt` with all game data

### 3. Test the Chat
Ask: **"Can you list all the games you have data for? Tell me the teams and spreads."**

**✅ Success:** AI lists actual games with real data
**❌ Failure:** AI gives generic response or says no data

## 📋 Complete Request Example

```json
{
  "workflow": {
    "id": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0"
  },
  "user": "user_abc123",
  "metadata": {
    "system_prompt": "You are WagerBot, an expert sports betting analyst. You have access to detailed game data and predictions for the games the user is currently viewing.\n\n## NFL Games Data (16 total games)\n\nGame 1: Buffalo @ Kansas City\n- Date/Time: 1/26/2025 18:30:00\n- Spread: Kansas City -2.5\n- Moneyline: Away +120 / Home -145\n- Over/Under: 48.5\n- Model Predictions:\n  * ML Probability: 58.3%\n  * Spread Cover Prob: 54.2%\n  * O/U Probability: 62.1%\n- Weather: 35°F, Wind: 12 mph\n- Public Splits: Spread: 65% on Chiefs, Total: 58% on Over\n\n[... continues for all games ...]\n\nUse this data to provide insightful analysis, identify value bets, explain model predictions, and answer questions about specific matchups. Be specific and reference the actual data provided when answering questions.",
    "userEmail": "user@example.com",
    "timestamp": "2025-01-26T12:34:56.789Z",
    "stream": true
  }
}
```

## ✅ Benefits

1. **Official Method** - Supported by ChatKit documentation
2. **Persistent** - System prompt stays for entire conversation
3. **Dynamic** - Different per page (NFL vs CFB)
4. **Accessible** - Easy to use in workflow with `{{metadata.system_prompt}}`
5. **Flexible** - Can pass other metadata too

## 🚨 Common Issues

### ❌ Issue: AI doesn't have game data
**Check:**
1. Is `metadata.system_prompt` being received in BuildShip?
2. Is it being used in the model step?
3. Is the prompt getting truncated (too long)?

### ❌ Issue: BuildShip not receiving metadata
**Check:**
1. Network tab - is metadata in the request?
2. BuildShip logs - what's being received?
3. Correct endpoint being called?

### ❌ Issue: Prompt too long
**Solution:**
- Limit to top 15-20 games instead of all
- Reduce detail in each game summary
- Check OpenAI token limits

## 📝 Quick Checklist

- [ ] Frontend sends `metadata.system_prompt` ✅ (already done)
- [ ] BuildShip receives `metadata` object
- [ ] Workflow accesses `{{metadata.system_prompt}}`
- [ ] Model step uses it as system message
- [ ] Test with specific question about game data
- [ ] AI responds with actual game information

## 🎉 You're All Set!

The frontend is now correctly sending the system prompt via metadata. You just need to configure your BuildShip workflow to use `{{metadata.system_prompt}}` in your model step!

