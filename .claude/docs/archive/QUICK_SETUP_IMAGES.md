# Quick Setup: Image Upload for Mobile WagerBot ⚡

## 3 Simple Steps

### Step 1: Copy New BuildShip Code ✅

1. Go to your BuildShip workflow: `wager-bot-mobile-900a291b0aae`
2. Open your Script node that contains the WagerBot function
3. Replace the entire code with the updated code from:
   - File: `wagerproof-mobile/buildship-responses-api.ts`
   - (The full code was provided in the user query)

### Step 2: Update BuildShip Input Schema ✅

In BuildShip, find your REST API trigger and update the input schema to include:

```json
"images": {
  "type": "array",
  "required": false,
  "description": "Array of base64 encoded images",
  "items": {
    "type": "object",
    "properties": {
      "base64": { "type": "string" },
      "name": { "type": "string" }
    }
  }
}
```

### Step 3: Verify Model Selection ✅

In your OpenAI node, ensure model is set to:
- **`gpt-4o`** (recommended - has vision + web search)
- OR: `gpt-4-turbo` (alternative with vision)

---

## What's Already Done in Mobile App ✅

✅ Image picker installed (`expo-image-picker`)
✅ Image UI with preview thumbnails
✅ Base64 encoding of images  
✅ Sending images in request body to BuildShip

**No changes needed in mobile app!**

---

## Testing

### Test on Mobile

1. Open WagerBot chat
2. Tap **image-plus** button
3. Select an image from photo library
4. Optionally add a message
5. Tap **send**
6. WagerBot should analyze the image

### Check BuildShip Logs

You should see:
```
📨 Processing WagerBot request
  - Images: 1
  📸 Added image: image_1729689001234.jpg
🚀 Calling OpenAI Responses API...
```

---

## How It Works (High Level)

```
Mobile App                BuildShip              OpenAI
───────────────────────────────────────────────────────
User picks image   →
Converts to base64 →
Sends JSON with      →  Receives images
images array            Converts to data URLs  →  Analyzes
                        Sends to OpenAI          with vision
                        Streams response    ←  Returns analysis
                    ←  Text to mobile      
Shows in chat   ←
```

---

## Image Format

**Mobile app sends:**
```json
{
  "message": "Analyze this bet slip",
  "images": [
    {
      "base64": "iVBORw0KGgoAAAANSUhEUg...",
      "name": "image_1729689001234.jpg"
    }
  ]
}
```

**BuildShip converts to OpenAI format:**
```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Images not sending | Check mobile logs for "📸 Including X image(s)" |
| BuildShip not receiving images | Verify input schema includes `images` field |
| OpenAI error | Use `gpt-4o` instead of `gpt-5` |
| Image not analyzed | Ensure base64 is valid and image file is supported |

---

## Files Updated

| File | Change |
|------|--------|
| `wagerproof-mobile/buildship-responses-api.ts` | ✅ Added image processing |
| `wagerproof-mobile/components/WagerBotChat.tsx` | ✅ Already done |
| `wagerproof-mobile/package.json` | ✅ Already done |

---

## Next: Deploy & Test

1. **Save** changes in BuildShip
2. **Deploy** the workflow
3. **Test** on mobile device
4. **Monitor** BuildShip logs
5. **Celebrate** 🎉

---

**Questions?** Check `BUILDSHIP_IMAGE_UPLOAD_SETUP.md` for detailed docs.
