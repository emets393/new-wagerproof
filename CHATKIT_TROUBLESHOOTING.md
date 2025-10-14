# ChatKit UI Troubleshooting Guide

## Issue: Missing Message Input UI

If the ChatKit interface is loading but you don't see the message input box, follow these steps:

### 1. Check Browser Console

Open your browser's DevTools (F12 or right-click → Inspect) and check the Console tab for:

#### Expected Log Messages:
```
Calling BuildShip workflow for client secret...
BuildShip response status: 200
BuildShip result received: { hasClientSecret: true }
```

#### Common Errors:

**Error: "No client_secret returned from BuildShip workflow"**
- Your BuildShip workflow is not returning the correct format
- Expected response: `{ "client_secret": "your_secret_here" }`

**Error: "BuildShip workflow failed: 404"**
- The workflow endpoint URL is incorrect
- Verify: `https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf`

**Error: "CORS error"**
- BuildShip workflow needs CORS headers configured
- Add Access-Control-Allow-Origin header in BuildShip

### 2. Verify BuildShip Workflow

Your BuildShip workflow should:

#### Receive:
```json
{
  "userId": "user_uuid_from_supabase",
  "userEmail": "user@example.com",
  "workflowId": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0",
  "version": "1",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Return:
```json
{
  "client_secret": "cs_xxxxxxxxxxxxx"
}
```

**Important:** The key must be exactly `client_secret` (with underscore, not camelCase)

### 3. Check ChatKit Script Loading

#### In browser DevTools → Network tab:
1. Look for request to: `https://cdn.platform.openai.com/deployments/chatkit/chatkit.js`
2. Status should be: `200 OK`
3. If it fails, check your internet connection or CDN availability

#### Verify in Console:
```javascript
// Type this in browser console:
window.ChatKit
// Should return an object or function, not undefined
```

### 4. Verify Configuration

Check that these values match exactly:

```typescript
// In ChatKitWrapper.tsx - should NOT have these in useChatKit:
// ❌ publicKey - should NOT be here
// ❌ workflowId - should NOT be here  
// ❌ version - should NOT be here

// ✅ Should only have:
const { control, error } = useChatKit({
  api: {
    async getClientSecret(existing) {
      // ...
    }
  }
});
```

The public key, workflow ID, and version are configured on the **ChatKit backend/BuildShip side**, not in the React component.

### 5. Check User Authentication

```javascript
// In browser console on the WagerBot Chat page:
console.log(user);
// Should show: { id: "...", email: "...", ... }
// If null or undefined, authentication failed
```

### 6. Inspect ChatKit Container

In DevTools → Elements tab:
1. Find the div with class containing `ChatKit` or `chatkit`
2. Check if it has:
   - Height set (should be `h-full`)
   - Width set (should be `w-full`)
   - Content inside (ChatKit should render iframe or shadow DOM)

### 7. Test BuildShip Workflow Manually

Use curl or Postman to test:

```bash
curl -X POST https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "userEmail": "test@example.com",
    "workflowId": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0",
    "version": "1",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }'
```

Expected response:
```json
{
  "client_secret": "cs_xxxxxxxxxxxxx"
}
```

### 8. Common Solutions

#### Solution 1: Clear Browser Cache
```javascript
// Clear localStorage
localStorage.clear();
// Then refresh the page (Cmd+R or Ctrl+R)
```

#### Solution 2: Check Port Conflicts
If you see "Port 8080 is already in use":
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

#### Solution 3: Reinstall ChatKit Package
```bash
npm uninstall @openai/chatkit-react
npm install @openai/chatkit-react
```

#### Solution 4: Verify index.html Script
Check that `index.html` has:
```html
<script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>
```

### 9. Debug Mode

Add this to see detailed ChatKit state:

```typescript
// In ChatKitWrapper.tsx, add this before the return:
useEffect(() => {
  console.log('ChatKit State:', {
    hasControl: !!control,
    hasError: !!error,
    error: error?.message
  });
}, [control, error]);
```

### 10. Contact Support

If none of the above works, check:

1. **OpenAI Platform Status**: https://status.openai.com
2. **BuildShip Status**: Check BuildShip dashboard
3. **Browser Compatibility**: Try Chrome/Firefox/Safari
4. **Network Issues**: Check firewall/VPN settings

## Quick Diagnostic Checklist

- [ ] Browser console shows no errors
- [ ] BuildShip workflow returns `client_secret`
- [ ] ChatKit script loads (check Network tab)
- [ ] User is authenticated (check `user` object)
- [ ] Session is created (check localStorage)
- [ ] Container has proper height/width
- [ ] No CORS errors in console
- [ ] Port 8080 is available
- [ ] Internet connection is stable

## Still Having Issues?

Create a minimal test case:
1. Sign out and sign back in
2. Clear all localStorage
3. Navigate to WagerBot Chat
4. Open DevTools before the page loads
5. Watch Console tab for errors
6. Copy all error messages
7. Share with development team

## BuildShip Workflow Configuration

Make sure your BuildShip workflow:
1. Is deployed and active
2. Has correct endpoint URL
3. Accepts POST requests
4. Returns JSON with `client_secret`
5. Has CORS configured for your domain
6. Uses the correct OpenAI API configuration

## Expected Behavior

When everything works:
1. Page loads → "Initializing chat..." appears
2. BuildShip called → client_secret retrieved
3. ChatKit initializes → Chat UI appears
4. Input box visible at bottom
5. Can type and send messages
6. AI responses appear in chat

## Minimum Working Example

```typescript
// This is the minimal setup that should work:
const { control } = useChatKit({
  api: {
    async getClientSecret() {
      const res = await fetch('YOUR_BUILDSHIP_URL', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* your data */ })
      });
      const { client_secret } = await res.json();
      return client_secret;
    }
  }
});

return <ChatKit control={control} />;
```

If this doesn't render the input UI, the issue is with BuildShip workflow or ChatKit configuration.

