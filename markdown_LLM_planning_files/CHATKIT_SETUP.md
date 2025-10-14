# ChatKit Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Access WagerBot Chat
- Navigate to http://localhost:5173
- Sign in to your account
- Click "WagerBot Chat" in the sidebar

## Configuration

### ChatKit Public Key
```
domain_pk_68eda4f6aae88190a085a42d55c561bd046412d1fd5478d5
```

### Workflow Details
- **Workflow ID**: `wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0`
- **Version**: `1`
- **BuildShip Endpoint**: `https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf`

## BuildShip Workflow Expected Response

Your BuildShip workflow should return:
```json
{
  "client_secret": "your_client_secret_here"
}
```

The workflow receives:
```json
{
  "userId": "user_id_from_supabase",
  "userEmail": "user@example.com",
  "workflowId": "wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0",
  "version": "1",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Architecture

```
User Opens Chat Page
        ↓
Create/Load Local Session (localStorage)
        ↓
ChatKit Requests Client Secret
        ↓
POST to BuildShip Workflow
        ↓
Receive client_secret
        ↓
ChatKit Initializes
        ↓
User Chats with AI
```

## Local Storage Structure

### Sessions Storage
Key: `wagerbot_chat_sessions`
```json
[
  {
    "id": "session_1234567890_abc123",
    "userId": "user_uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActive": "2024-01-01T00:10:00.000Z",
    "messages": []
  }
]
```

### Current Session
Key: `wagerbot_current_session`
```
"session_1234567890_abc123"
```

## Troubleshooting

### ChatKit Not Loading
1. Check browser console for errors
2. Verify ChatKit script loaded: `<script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>`
3. Check network tab for script loading

### BuildShip Workflow Errors
1. Verify endpoint URL is correct
2. Check workflow is deployed and active
3. Verify workflow returns `client_secret` in response
4. Check browser network tab for API calls

### Authentication Issues
1. Ensure user is signed in
2. Check AuthContext is providing user data
3. Verify user.id and user.email are available

### Session Not Persisting
1. Check browser localStorage is enabled
2. Verify localStorage isn't full
3. Check browser console for storage errors

## Development Tips

### Testing New Sessions
```javascript
// Clear all sessions in browser console
localStorage.removeItem('wagerbot_chat_sessions');
localStorage.removeItem('wagerbot_current_session');
```

### Debug Mode
Open browser DevTools and check:
- Console for error messages
- Network tab for API calls
- Application > Local Storage for session data

### Theme Testing
The chat automatically adapts to your app's theme (light/dark mode). Toggle theme using the theme switcher in the app.

## Production Deployment

### Build for Production
```bash
npm run build
```

### Deploy Checklist
- ✅ BuildShip workflow is in production
- ✅ Workflow endpoint is accessible
- ✅ Public key is correctly configured
- ✅ ChatKit script loads from CDN
- ✅ CORS is configured if needed
- ✅ Error handling is in place

## API Reference

### chatSessionManager Methods

#### `getUserSessions(userId: string): ChatSession[]`
Get all sessions for a specific user.

#### `getCurrentSession(userId: string): ChatSession | null`
Get the currently active session.

#### `createNewSession(user: User): Promise<ChatSession>`
Create a new chat session.

#### `getClientSecret(user: User, existingSecret?: string): Promise<string>`
Fetch client secret from BuildShip workflow.

#### `saveSession(session: ChatSession): void`
Save session to localStorage.

#### `setCurrentSession(sessionId: string): void`
Set the active session.

#### `deleteSession(sessionId: string): void`
Delete a session.

#### `clearUserSessions(userId: string): void`
Clear all sessions for a user.

## Support

For issues or questions:
1. Check this documentation
2. Review browser console errors
3. Verify BuildShip workflow status
4. Test with a fresh browser session

## Updates

When updating ChatKit:
1. Check for new versions of `@openai/chatkit-react`
2. Review ChatKit documentation for breaking changes
3. Test in development before deploying
4. Update this documentation with new features

