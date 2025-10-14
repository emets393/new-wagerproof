# Console Logs Guide - What to Look For

## Updated Logging
I've added comprehensive console logging to help debug the ChatKit integration.

## What You Should See in Browser Console

### 1. When Page Loads

```
🔵 ChatKitWrapper rendering { userId: "...", sessionId: "..." }
⏳ Waiting for ChatKit control...
Calling BuildShip workflow for client secret...
BuildShip response status: 200
BuildShip result received: { sessionResponse: { ... } }
Client secret extracted successfully: { length: 87, prefix: "ek_..." }
🔵 ChatKit control state: { hasControl: true, hasError: false }
✅ ChatKit control object: { ... }
🎉 ChatKit ready, rendering component
```

### 2. When You Send a Message

Look for:
- `📨 ChatKit message received:` (if callbacks work)
- `🔄 ChatKit state changed:` (if callbacks work)
- Network requests in Network tab
- Any error messages

### 3. If You See an Error

```
❌ ChatKit error: { ... }
```
Read the error message - it will tell you what's wrong.

## What Each Log Means

### 🔵 Blue Circle
Component lifecycle events (rendering, state changes)

### ✅ Green Check
Success - ChatKit initialized

### ⏳ Hourglass
Waiting for something to complete

### 🎉 Party
Everything is ready!

### 📨 Mail
Message received from AI

### ❌ Red X
Error occurred

### 🔄 Cycle
State change in ChatKit

## What to Do Now

1. **Open your browser** (http://localhost:8080)
2. **Open DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Clear the console** (trash icon or Cmd+K)
5. **Navigate to WagerBot Chat**
6. **Watch the console** - you should see the logs above

## Troubleshooting Based on Logs

### If You See: ⏳ Waiting... (and it never progresses)
**Problem**: `getClientSecret` is failing
**Check**: BuildShip logs for errors

### If You See: ❌ ChatKit error
**Problem**: Error in ChatKit initialization
**Action**: Read the error message - it will tell you what's wrong

### If You See: 🎉 ChatKit ready
**Good**: ChatKit initialized successfully
**Next**: Send a message and watch for responses

### If You See: No console logs at all
**Problem**: Component not rendering or console is filtered
**Actions**:
1. Check Console filter (should be "All levels")
2. Verify you're on WagerBot Chat page
3. Try hard refresh (Cmd+Shift+R)

## Network Tab Check

While in DevTools:
1. Click **Network** tab
2. Send a message
3. Look for:
   - Requests to BuildShip URL
   - Request/Response bodies
   - Status codes (200 = good, 4xx/5xx = error)

## What If Still No Responses?

After seeing the logs, if still no AI responses:

1. **Copy ALL console logs**
2. **Screenshot Network tab** (showing requests after sending message)
3. **Check BuildShip dashboard logs**
4. **Share all three** for further diagnosis

## Expected Timeline

```
0s    → Page loads
      → 🔵 ChatKitWrapper rendering

0.5s  → Calling BuildShip workflow

1-2s  → BuildShip response
      → Client secret extracted
      → ✅ ChatKit control object
      → 🎉 ChatKit ready

User sends message:

0s    → Message appears in UI
      → (Network request to process message)

1-3s  → AI response appears
      → 📨 ChatKit message received
```

## Quick Diagnostic Commands

Type these in browser console:

```javascript
// Check if ChatKit script loaded
console.log('ChatKit available:', typeof window.ChatKit);

// Check localStorage sessions
console.log('Sessions:', localStorage.getItem('wagerbot_chat_sessions'));

// Clear all sessions and start fresh
localStorage.clear();
location.reload();
```

## Still Stuck?

Share a screenshot of:
1. ✅ Full browser console output
2. ✅ Network tab (showing BuildShip requests)
3. ✅ The WagerBot Chat page

This will help identify exactly where the process is failing!

