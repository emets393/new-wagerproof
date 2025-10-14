# ChatKit Debug Steps - Missing UI

## Immediate Steps to Debug Missing Message Input

### Step 1: Open Browser Console
1. Navigate to WagerBot Chat page
2. Press F12 (or Cmd+Option+I on Mac)
3. Go to Console tab
4. Look for these messages:

```
✅ Good signs:
- "Calling BuildShip workflow for client secret..."
- "BuildShip response status: 200"
- "BuildShip result received: { hasClientSecret: true }"

❌ Bad signs:
- "Error getting client secret"
- "BuildShip workflow failed"
- "No client_secret returned"
```

### Step 2: Check Network Tab
1. Stay in DevTools
2. Click "Network" tab
3. Click "Fetch/XHR" filter
4. Look for request to BuildShip URL
5. Click on it and check:
   - **Status**: Should be 200
   - **Response**: Should have `client_secret` field

### Step 3: Inspect ChatKit Element
1. In DevTools, click "Elements" tab
2. Find the div with the chat interface
3. Look for ChatKit-related classes or iframe
4. Check if the container has content inside

### Step 4: Verify BuildShip Response

Your BuildShip workflow MUST return exactly this format:

```json
{
  "client_secret": "cs_live_xxxxxxxxxxxxxxxx"
}
```

NOT:
```json
{
  "clientSecret": "...",  ❌ Wrong - camelCase
  "secret": "...",        ❌ Wrong - missing "client_"
  "token": "..."          ❌ Wrong - wrong field name
}
```

### Step 5: Test BuildShip Directly

Run this in terminal:

```bash
curl -X POST https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","userEmail":"test@test.com","workflowId":"wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0","version":"1","timestamp":"2024-01-01T00:00:00Z"}'
```

You should see:
```json
{"client_secret":"cs_..."}
```

## Common Issues & Fixes

### Issue 1: ChatKit Shows But No Input Box

**Cause**: Client secret not valid or BuildShip workflow not properly configured

**Fix**:
1. Check BuildShip dashboard - is workflow deployed?
2. Verify workflow returns `client_secret` field
3. Ensure OpenAI ChatKit is properly configured in BuildShip

### Issue 2: "Initializing chat..." Never Goes Away

**Cause**: `getClientSecret` function failing or BuildShip not responding

**Fix**:
1. Check browser console for errors
2. Verify BuildShip URL is correct
3. Check network tab for failed requests
4. Ensure CORS is configured on BuildShip

### Issue 3: White/Blank Screen

**Cause**: ChatKit script not loading or error in initialization

**Fix**:
1. Check Network tab for `chatkit.js` load
2. Verify script tag in `index.html`:
   ```html
   <script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>
   ```
3. Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Issue 4: Error Message Displayed

**Cause**: Error from useChatKit hook

**Fix**:
1. Read the error message in the UI
2. Check browser console for details
3. Verify all configuration values are correct

## What the UI Should Look Like

When working correctly, you should see:

```
┌─────────────────────────────────────┐
│  WagerBot Chat                      │
├─────────────────────────────────────┤
│                                     │
│  [Chat messages appear here]        │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  Type a message...           [Send] │ ← THIS SHOULD BE VISIBLE
└─────────────────────────────────────┘
```

## Testing BuildShip Workflow

### Required BuildShip Workflow Setup:

1. **Input Node**: Should accept:
   ```javascript
   {
     userId: string
     userEmail: string
     workflowId: string
     version: string
     timestamp: string
   }
   ```

2. **ChatKit Session Generator Node**: 
   - Use OpenAI ChatKit integration
   - Configure with your OpenAI API key
   - Set workflow ID: `wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0`
   - Set version: `1`

3. **Output Node**: Must return:
   ```javascript
   {
     client_secret: sessionToken // from ChatKit node
   }
   ```

### Verify BuildShip Configuration:

1. Go to BuildShip dashboard
2. Find your workflow
3. Check "Deploy" status - should be green
4. Click "Test" and send sample data
5. Verify response has `client_secret`

## Debug Mode Code

Add this temporarily to ChatKitWrapper.tsx for more logging:

```typescript
export function ChatKitWrapper({ user, sessionId, theme = 'dark' }: ChatKitWrapperProps) {
  console.log('=== ChatKitWrapper Render ===');
  console.log('User:', { id: user.id, email: user.email });
  console.log('SessionId:', sessionId);
  console.log('Theme:', theme);

  const { control, error } = useChatKit({
    api: {
      async getClientSecret(existing) {
        console.log('=== getClientSecret called ===');
        console.log('Existing secret:', existing ? 'yes' : 'no');
        
        try {
          const clientSecret = await chatSessionManager.getClientSecret(user, existing);
          console.log('=== Client secret obtained ===');
          console.log('Length:', clientSecret.length);
          console.log('Starts with:', clientSecret.substring(0, 10) + '...');
          return clientSecret;
        } catch (error) {
          console.error('=== getClientSecret ERROR ===', error);
          throw error;
        }
      },
    },
  });

  console.log('=== ChatKit Hook State ===');
  console.log('Has control:', !!control);
  console.log('Has error:', !!error);
  if (error) console.error('Error details:', error);

  // rest of component...
}
```

## Expected Console Output

When everything is working, you should see:

```
=== ChatKitWrapper Render ===
User: { id: "abc123", email: "user@example.com" }
SessionId: "session_1234567890_xyz"
Theme: "dark"

=== getClientSecret called ===
Existing secret: no
Calling BuildShip workflow for client secret...
BuildShip response status: 200
BuildShip result received: { hasClientSecret: true }
=== Client secret obtained ===
Length: 87
Starts with: cs_live_...

=== ChatKit Hook State ===
Has control: true
Has error: false
```

## Next Steps

1. Run the app with `npm run dev`
2. Navigate to WagerBot Chat
3. Open browser console BEFORE the page loads
4. Watch for the log messages above
5. Screenshot any errors
6. Share error messages with the team

## Need More Help?

If you've tried all the above and still see issues:

1. **Screenshot**:
   - The WagerBot Chat page
   - Browser console (all messages)
   - Network tab (BuildShip request/response)

2. **Collect Info**:
   - Browser name and version
   - Operating system
   - Error messages (full text)
   - BuildShip workflow status

3. **Share**:
   - All screenshots
   - Error messages
   - What you've already tried

## Critical Checklist

Before asking for help, verify:

- [ ] BuildShip workflow is deployed (green status)
- [ ] BuildShip returns `{ "client_secret": "..." }`
- [ ] Script tag is in index.html
- [ ] User is authenticated (can see other pages)
- [ ] Browser console shows no errors
- [ ] Network tab shows BuildShip request succeeds
- [ ] Tried hard refresh (Cmd+Shift+R)
- [ ] Tried different browser
- [ ] Cleared localStorage
- [ ] Port 8080 is not in use

If ALL of the above are checked and it still doesn't work, there may be an issue with the ChatKit service itself or the public key configuration.

