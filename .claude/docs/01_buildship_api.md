# BuildShip & API Integration

> Last verified: December 2024

## Overview

WagerProof uses BuildShip as a serverless backend for AI chat functionality. The implementation differs significantly between web and mobile platforms.

---

## Architecture

### Web Platform
- Uses **ChatKit SDK** (`@openai/chatkit-react`)
- BuildShip generates ChatKit client secrets
- Streaming handled by ChatKit internally

### Mobile Platform
- **Custom implementation** using XMLHttpRequest
- Uses **OpenAI Responses API** (stateless, NOT Assistants API)
- Platform-specific streaming handling (iOS vs Android)

---

## BuildShip Endpoints

| Endpoint | Purpose |
|----------|---------|
| `https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf` | Generate ChatKit client secrets |
| `https://xna68l.buildship.run/wager-bot-mobile-900a291b0aae` | Mobile chat endpoint |
| `https://xna68l.buildship.run/discord-editor-pick-post` | Discord notifications |

---

## Mobile Chat Implementation

### Request Schema
```typescript
interface ChatRequest {
  message: string;                    // User message
  SystemPrompt?: string;              // Game context (markdown formatted)
  conversationHistory?: Array<{       // Last 20 messages for context
    role: 'user' | 'assistant';
    content: string;
  }>;
  images?: Array<{                    // Optional image attachments
    base64: string;
    name: string;
  }>;
}
```

**Note**: The mobile app uses a **stateless** Responses API approach. Conversation history is sent with each request (last 20 messages).

### Streaming Implementation

**iOS** (`WagerBotChat.tsx:662-750`):
```typescript
xhr.onprogress = () => {
  const newText = xhr.responseText.substring(parsedLength);
  parsedLength = xhr.responseText.length;
  processNewText(newText, 'iOS Progress');
};
```

**Android** (requires polling fallback):
```typescript
// onprogress doesn't fire reliably on Android
pollingInterval = setInterval(() => {
  if (xhr.readyState >= 2 && xhr.readyState < 4) {
    const newText = xhr.responseText.substring(parsedLength);
    parsedLength = xhr.responseText.length;
    processNewText(newText, 'Android Polling');
  }
}, 50); // Poll every 50ms
```

### Response Format
- Plain text stream (NOT JSON)
- Thread ID no longer embedded (Responses API is stateless)

---

## Web Chat Implementation

### ChatKit Setup (`index.html`)
```html
<script src="https://cdn.jsdelivr.net/npm/@anthropic-ai/chatkit@latest/dist/index.global.js"></script>
```

### Session Management (`src/utils/chatSession.ts`)
```typescript
// Fetch client secret from BuildShip
const response = await fetch(
  'https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf',
  { method: 'POST', body: JSON.stringify({ userId }) }
);

// Handle multiple response formats
const data = await response.json();
const clientSecret = data.client_secret ||
                     data.sessionResponse?.session?.clientSecret;
```

### Context Passing
- System context embedded in **starter prompts** via `<context>...</context>` tags
- ChatKit doesn't support system messages directly

---

## Image Upload (Mobile Only)

### Implementation (`WagerBotChat.tsx:501-528`)
```typescript
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: false,
  quality: 0.8,
  base64: true,
});

// Send with request
requestBody.images = [{
  base64: asset.base64,
  name: fileName,
}];
```

### BuildShip Processing
```typescript
// Converts to OpenAI multi-modal format
userContent.push({
  type: "image_url",
  image_url: {
    url: `data:${mediaType};base64,${image.base64}`
  }
});
```

---

## API Optimization (The Odds API)

### Three-Layer Defense (`src/services/theOddsApi.ts`)

**Layer 1: Cache** (5-minute TTL)
```typescript
const cached = getCachedOdds(sportKey);
if (cached) return cached;
```

**Layer 2: Request Deduplication**
```typescript
const existingRequest = activeRequests.get(requestKey);
if (existingRequest) return existingRequest;
```

**Layer 3: Database Storage** (`SportsbookButtons.tsx`)
```typescript
// Check for existing betslip links before API call
if (existingLinks && Object.keys(existingLinks).length > 0) {
  return existingLinks; // Use stored links
}
```

### Results
- 95-99% reduction in API calls
- Zero API calls after initial fetch for editor picks

---

## Game Context Service

### Data Fetching (`gameDataService.ts`)
Fetches and formats game data for AI context:
- NFL: EPA predictions, betting lines, weather
- CFB: Weekly inputs, predictions
- NBA: Adjusted stats, predictions
- NCAAB: Input values, predictions

### Polymarket Integration
- Fetches real money prediction market data
- Shows moneyline, spread, total probabilities
- Rate-limited to 10 games per league

---

## Key Files

### Web
- `/src/pages/WagerBotChat.tsx` - Chat page
- `/src/components/ChatKitWrapper.tsx` - ChatKit integration
- `/src/utils/chatSession.ts` - Session management
- `/src/services/theOddsApi.ts` - Odds API with caching

### Mobile
- `/wagerproof-mobile/components/WagerBotChat.tsx` - Chat component (60KB)
- `/wagerproof-mobile/services/gameDataService.ts` - Game context (41KB)
- `/wagerproof-mobile/utils/chatSessionManager.ts` - Session handling

---

## Common Issues

### Mobile Streaming Not Working
1. Check platform (iOS vs Android)
2. Android requires 50ms polling fallback
3. Verify endpoint URL is correct

### No AI Response
1. Check BuildShip workflow is deployed
2. Verify SystemPrompt is being sent
3. Check for quota exceeded errors (`OUT_OF_USAGE_CREDITS`)

### Missing Game Context
1. Verify gameDataService is fetching data
2. Check Supabase connection (both clients)
3. Look for green/gray context indicator in mobile

---

## Platform Differences Summary

| Feature | Web | Mobile |
|---------|-----|--------|
| SDK | ChatKit | Custom XMLHttpRequest |
| API | ChatKit managed | Responses API (stateless) |
| Conversation State | ChatKit handles | 20-message sliding window |
| Image Upload | Not implemented | Full support |
| Platform Handling | Browser | iOS onprogress / Android polling |
