# BuildShip Image Upload Setup Guide 📸

## Overview

The updated BuildShip script now supports image uploads from the mobile WagerBot chat. Users can send images (bet slips, game screenshots, etc.) along with their messages for analysis.

## What Changed

### 1. **Function Parameters**

Added `images` parameter to the function signature:

```typescript
export default async function wagerBotResponses(
  { message, conversationHistory, SystemPrompt, images, model },
  { auth, req, logging }
)
```

### 2. **Image Processing**

The script now converts base64 images to multi-modal OpenAI format:

```typescript
// Images array from mobile app
{
  base64: "iVBORw0KGgoAAAANSUhEUgAAAAE...",
  name: "image_1729689001234.jpg"
}

// Converted to OpenAI format
{
  type: "image_url",
  image_url: {
    url: "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAE..."
  }
}
```

### 3. **User Message Construction**

The script builds multi-modal content with both text and images:

```typescript
const userContent = [];

// Add text if present
if (message && message.trim().length > 0) {
  userContent.push({ type: "text", text: message });
}

// Add images if present
if (images && Array.isArray(images) && images.length > 0) {
  for (const image of images) {
    if (image.base64) {
      const mediaType = image.name?.toLowerCase().includes('.png') 
        ? 'image/png' 
        : 'image/jpeg';
      
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mediaType};base64,${image.base64}` }
      });
    }
  }
}

// Message sent to OpenAI with mixed content
messages.push({
  role: "user",
  content: userContent.length === 1 && userContent[0].type === "text"
    ? userContent[0].text  // Single text item
    : userContent          // Multi-modal array
});
```

### 4. **Model Selection**

Updated to use `gpt-4o` instead of `gpt-5`:
- `gpt-4o` supports vision (image analysis)
- `gpt-5` may not be available yet
- `gpt-4o` has web search capability enabled

```typescript
const responseStream = await openai.responses.create({
  model: model || "gpt-4o",  // Supports vision + web search
  input: messages,
  tools: [{ type: "web_search" }],
  stream: true,
});
```

### 5. **Logging**

Added image logging for debugging:

```typescript
logging.log(`  - Images: ${images ? images.length : 0}`);
logging.log(`  📸 Added image: ${image.name}`);
```

## BuildShip Configuration

### Step 1: Update Input Schema

In your BuildShip workflow's REST API trigger, add the `images` field:

```json
{
  "message": {
    "type": "string",
    "required": true,
    "description": "The user's current message"
  },
  "conversationHistory": {
    "type": "array",
    "required": false,
    "description": "Array of previous messages for context",
    "items": {
      "type": "object",
      "properties": {
        "role": { "type": "string", "enum": ["user", "assistant"] },
        "content": { "type": "string" }
      }
    }
  },
  "SystemPrompt": {
    "type": "string",
    "required": false,
    "description": "Game data and context for analysis"
  },
  "images": {
    "type": "array",
    "required": false,
    "description": "Array of base64 encoded images",
    "items": {
      "type": "object",
      "properties": {
        "base64": { "type": "string", "description": "Base64 encoded image data" },
        "name": { "type": "string", "description": "Image filename" }
      }
    }
  },
  "model": {
    "type": "string",
    "required": false,
    "default": "gpt-4o",
    "description": "OpenAI model to use (gpt-4o recommended for vision)"
  }
}
```

### Step 2: Update Function Code

Replace your BuildShip script node with the code from `buildship-responses-api.ts`.

### Step 3: Verify Model Access

Ensure you have access to `gpt-4o`:
- ✅ `gpt-4o` - Recommended (vision + web search)
- ⚠️ `gpt-5` - May not be available
- ✅ `gpt-4-turbo` - Alternative with vision support

## How It Works End-to-End

### Mobile App Flow

```
User selects image
    ↓
expo-image-picker converts to base64
    ↓
Image stored in component state
    ↓
User sends message
    ↓
Mobile app sends to BuildShip:
{
  "message": "Analyze this bet slip",
  "images": [{ "base64": "...", "name": "image.jpg" }],
  "conversationHistory": [...],
  "SystemPrompt": "..."
}
```

### BuildShip Processing

```
BuildShip receives request
    ↓
Script extracts images array
    ↓
Converts base64 to data URLs
    ↓
Creates multi-modal message content
    ↓
Sends to OpenAI Responses API
    ↓
OpenAI analyzes image + text
    ↓
Returns streaming response
    ↓
BuildShip pipes to mobile app
```

### OpenAI API Format

```json
{
  "model": "gpt-4o",
  "input": [
    {
      "role": "system",
      "content": "You are WagerBot..."
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Analyze this bet slip" },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAE..."
          }
        }
      ]
    }
  ],
  "tools": [{ "type": "web_search" }],
  "stream": true
}
```

## Testing the Integration

### 1. **Mobile App Test**

```
1. Open mobile WagerBot chat
2. Tap image-plus button
3. Select an image from photo library
4. Add a message (optional): "Analyze this"
5. Tap send
6. Check mobile console for logs
```

### 2. **BuildShip Logs**

You should see:

```
📨 Processing WagerBot request
  - Message length: 18 chars
  - History messages: 2
  - System prompt: 2450 chars
  - Images: 1
  📸 Added image: image_1729689001234.jpg
🚀 Calling OpenAI Responses API...
🔧 Tool call in progress (web search)...
✅ Tool call complete
✅ Text complete: 1250 characters
🏁 Response stream finished
```

### 3. **Expected Response**

WagerBot should analyze the image (if it's a bet slip) and provide:
- Bet slip components (teams, lines, odds)
- EV analysis
- Risk assessment
- Recommendations

## Supported Image Types

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **WebP** (.webp) - if Base64 encoded
- **GIF** (.gif) - if Base64 encoded

Media type is auto-detected from filename:
```typescript
const mediaType = image.name?.toLowerCase().includes('.png') 
  ? 'image/png' 
  : 'image/jpeg';  // Default for anything else
```

## Image Size Considerations

### Recommended Limits

- **Per image:** < 20MB (base64 encoded)
- **Base64 overhead:** ~33% larger than binary
- **Total payload:** Consider mobile network speed

### Optimization in Mobile App

Images are already optimized:
```typescript
const result = await ImagePicker.launchImageLibraryAsync({
  quality: 0.8,  // 80% quality compression
  base64: true,  // Auto-compressed
});
```

## Error Handling

### Mobile App (WagerBotChat.tsx)

```typescript
if (!result.canceled && result.assets.length > 0) {
  const asset = result.assets[0];
  if (asset.base64) {
    setSelectedImages([...selectedImages, { uri, base64, name }]);
  }
} catch (error) {
  Alert.alert('Error', 'Failed to pick image');
}
```

### BuildShip Script

```typescript
if (images && Array.isArray(images) && images.length > 0) {
  for (const image of images) {
    if (image.base64) {
      // Process image...
    }
  }
}
```

## Troubleshooting

### Issue: Images not being sent

**Check mobile app logs:**
```
📸 Attached images: 1
📸 Including 1 image(s)
```

**Check request payload:**
```
- images: 1 images
```

### Issue: BuildShip receiving empty images

**Verify input schema includes `images` field**

**Check mobile app base64 conversion:**
```typescript
quality: 0.8,
base64: true,  // Must be enabled
```

### Issue: OpenAI API error

**Check model availability:**
- Use `gpt-4o` (recommended)
- Fallback to `gpt-4-turbo`

**Check API key permissions:**
- Ensure key has vision API access
- Verify in OpenAI dashboard

### Issue: Image not being analyzed

**Check OpenAI logs for vision errors**

**Verify image format:**
- Valid base64 string
- Correct data URL format
- Supported image type

## Performance Notes

- **Base64 transmission:** ~33% payload overhead (inherent to base64)
- **Image processing:** 2-5 seconds per image (OpenAI)
- **Total latency:** Network + BuildShip + OpenAI = typically 5-10 seconds

## Security Considerations

- ✅ Images only stored in memory (not persisted)
- ✅ Base64 encoding is safe for JSON transport
- ✅ OpenAI API handles image securely
- ✅ No server-side storage needed

## Future Enhancements

1. **Image compression** - Further reduce base64 payload
2. **Multiple images** - Support bulk image analysis
3. **Image storage** - Option to save analyzed images
4. **Bet slip OCR** - Extract text from images automatically
5. **Image annotations** - User markup before sending

## References

- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Multi-modal Content](https://platform.openai.com/docs/guides/vision/what-can-gpt-4v-do)
