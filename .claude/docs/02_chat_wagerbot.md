# WagerBot Chat System

> Last verified: December 2024

## Overview

WagerBot is an AI-powered betting assistant that provides game analysis, predictions, and betting insights. The implementation differs significantly between web and mobile platforms.

---

## Architecture Comparison

| Feature | Web | Mobile |
|---------|-----|--------|
| **UI Library** | ChatKit SDK | Custom React Native |
| **API Backend** | ChatKit → Assistants API | BuildShip → Responses API |
| **State** | Stateful (ChatKit managed) | Stateless (history sent each request) |
| **Storage** | localStorage only | Supabase (cloud) |
| **Images** | Via ChatKit | Full custom support |
| **Sports** | NFL, CFB | NFL, CFB, NBA, NCAAB |
| **Polymarket** | No | Yes |

---

## Web Implementation

### Components
- `/src/pages/WagerBotChat.tsx` - Main chat page
- `/src/components/ChatKitWrapper.tsx` - ChatKit integration
- `/src/utils/chatSession.ts` - Session management

### ChatKit Configuration
```typescript
// index.html loads ChatKit script
<script src="https://cdn.jsdelivr.net/npm/@anthropic-ai/chatkit@latest/dist/index.global.js"></script>

// Package installed
"@openai/chatkit-react": "^1.1.1"
```

### Session Management
```typescript
// chatSession.ts
class ChatSessionManager {
  private sessions: ChatSession[] = [];
  private currentSessionIndex: number = 0;

  async getOrCreateSession(userId: string): Promise<string> {
    // Generate client secret from BuildShip
    const response = await fetch(
      'https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf',
      { method: 'POST', body: JSON.stringify({ userId }) }
    );
    // ...
  }
}
```

### Context Passing (Web)
System context is embedded in **starter prompts** since ChatKit doesn't support system messages directly:
```typescript
starterPrompts={[
  {
    title: "Analyze today's games",
    prompt: `<context>${gameData}</context>\n\nAnalyze today's games`,
  }
]}
```

---

## Mobile Implementation

### Components
- `/wagerproof-mobile/app/(drawer)/(tabs)/chat.tsx` - Chat screen
- `/wagerproof-mobile/components/WagerBotChat.tsx` - Main component (60KB)
- `/wagerproof-mobile/services/gameDataService.ts` - Game context
- `/wagerproof-mobile/services/chatThreadService.ts` - Thread persistence

### API Architecture (Responses API)

**IMPORTANT**: Mobile uses OpenAI **Responses API** (stateless), NOT Assistants API.

```typescript
// Request structure
const requestBody = {
  message: userMessage.content,
  SystemPrompt: gameContext,        // Game data as markdown
  conversationHistory: messages.slice(-20).map(msg => ({
    role: msg.role,
    content: msg.content
  })),
  images: imagesToSend              // Optional
};
```

### Streaming (Mobile)
```typescript
// Uses XMLHttpRequest for streaming
const xhr = new XMLHttpRequest();
xhr.open('POST', chatEndpoint, true);

// iOS: onprogress events
xhr.onprogress = () => {
  const newText = xhr.responseText.substring(parsedLength);
  processNewText(newText);
};

// Android: Polling fallback (50ms intervals)
if (Platform.OS === 'android') {
  pollingInterval = setInterval(() => {
    // Poll responseText manually
  }, 50);
}
```

---

## Chat Thread Storage (Supabase)

### Database Schema
```sql
-- chat_threads table
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  page_context TEXT,
  openai_thread_id TEXT  -- Legacy, not used with Responses API
);

-- chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES chat_threads(id),
  role TEXT NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Service Layer (`chatThreadService.ts`)
```typescript
export const chatThreadService = {
  async createThread(userId: string, title: string, pageContext?: string) {
    return supabase.from('chat_threads').insert({
      user_id: userId,
      title,
      page_context: pageContext
    });
  },

  async saveMessage(threadId: string, role: string, content: string) {
    return supabase.from('chat_messages').insert({
      thread_id: threadId,
      role,
      content
    });
  },

  // AI-generated titles using GPT-3.5-turbo
  async generateTitle(messages: Message[]): Promise<string> {
    // Returns 3-5 word title
  }
};
```

---

## Game Data Service

### Data Sources by Sport

**NFL** (`gameDataService.ts`):
```typescript
// Tables: v_input_values_with_epa, nfl_predictions_epa, nfl_betting_lines, production_weather
const nflData = await fetchNFLGames();
// Returns: teams, predictions (ML/spread/O-U), weather, public splits
```

**CFB**:
```typescript
// Tables: cfb_live_weekly_inputs, cfb_api_predictions
const cfbData = await fetchCFBGames();
```

**NBA**:
```typescript
// Tables: nba_input_values_view, nba_predictions
const nbaData = await fetchNBAGames();
// Returns: adjusted offense/defense/pace, ATS%, Over%
```

**NCAAB**:
```typescript
// Tables: v_cbb_input_values, ncaab_predictions
const ncaabData = await fetchNCAABGames();
// Returns: rankings, conference info, neutral site
```

### Polymarket Integration (Mobile Only)
```typescript
// Fetches prediction market probabilities
const polymarketData = await fetchPolymarketData(games, league);
// Returns: ML%, spread%, total% for each game
// Rate limited to first 10 games per league
```

---

## Mobile-Specific Features

### Image Upload
```typescript
// Pick image
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.8,
  base64: true,
});

// Add to request
requestBody.images = [{ base64: asset.base64, name: fileName }];
```

### Context Indicator
- **Green dot**: Game data available
- **Gray dot**: No game data
- Tap to see data status alert

### Suggested Messages
Quick-tap suggestions on welcome screen:
- "What games look good today?"
- "Analyze the NFL games"
- etc.

### Chat History Drawer
- Right-side drawer with thread history
- Delete threads with confirmation
- Auto-generated AI titles

### Animated Streaming Text
Per-character fade-in animation during AI response streaming.

---

## Key Files

### Web
```
src/
├── pages/WagerBotChat.tsx
├── components/ChatKitWrapper.tsx
└── utils/chatSession.ts
```

### Mobile
```
wagerproof-mobile/
├── app/(drawer)/(tabs)/chat.tsx
├── components/WagerBotChat.tsx          # 60KB main component
├── services/gameDataService.ts          # 41KB context fetching
├── services/chatThreadService.ts        # Thread persistence
└── utils/chatSessionManager.ts          # Session handling
```

---

## Troubleshooting

### No AI Response (Mobile)
1. Check BuildShip endpoint is correct
2. Verify SystemPrompt is being sent
3. Look for quota exceeded errors
4. Check network connectivity

### Missing Game Context
1. Check context indicator (green vs gray)
2. Verify Supabase connections (both clients)
3. Check gameDataService is fetching correctly
4. Review console logs for fetch errors

### Streaming Issues
1. **iOS**: Should work with onprogress
2. **Android**: Ensure polling interval is active
3. Check for network timeouts (15s default)

### Thread Not Saving
1. Verify user is authenticated
2. Check Supabase RLS policies
3. Confirm thread ID is valid UUID
4. Look for Supabase errors in logs

---

## Future Considerations

1. **Web Image Support**: Currently via ChatKit only
2. **Unified API**: Consider moving web to Responses API
3. **Thread ID Usage**: Legacy column still exists but unused
4. **Offline Support**: Mobile could cache conversations
