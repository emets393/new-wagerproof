# BuildShip Stream Collection Fix

## Problem
BuildShip is serializing the stream object to JSON instead of piping it, resulting in:
```json
{
  "_readableState": {...},
  "_read": "function(){}",
  "_events": {}
}
```

## Solution
Collect the stream content into a string first, then return the complete message.

## Updated BuildShip Code

Replace the end of your function with this:

```typescript
export default async function assistant({
    assistantId,
    threadId,
    prompt,
    builtInTools,
    instructions,
    streamContentForm,
}: NodeInputs, {
    auth,
    req,
    logging,
    execute,
    nodes
}: NodeScriptOptions): NodeOutput {
    
    // ... [ALL YOUR EXISTING CODE ABOVE STAYS THE SAME] ...
    
    const openai = new OpenAI({ apiKey });

    if (prompt === undefined) {
        logging.log("User Prompt is undefined.");
        throw new Error("User Prompt is undefined.");
    }

    // Add the user prompt first
    if (!threadId) {
        threadId = (
            await openai.beta.threads.create({
                messages: [{
                    role: "user",
                    content: prompt
                }],
            })
        ).id;
    } else {
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: prompt,
        });
    }

    const assistantStream = openai.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId,
        instructions,
        tools,
    });

    // Collect the stream content
    let messageContent = '';
    let isComplete = false;

    return new Promise((resolve, reject) => {
        const handleToolCalls = async (run) => {
            if (run?.status === "requires_action") {
                const toolOutputs = await Promise.all(
                    run.required_action?.submit_tool_outputs.tool_calls.map(
                        executeToolCall,
                    ) ?? [],
                );

                const newToolStream = openai.beta.threads.runs.submitToolOutputsStream(
                    run.thread_id,
                    run.id,
                    { tool_outputs: toolOutputs },
                );

                // Handle tool call stream
                newToolStream
                    .on("textDelta", (delta) => {
                        messageContent += delta.value;
                    })
                    .on("end", async () => {
                        const newRun = newToolStream.currentRun();
                        await handleToolCalls(newRun);
                    })
                    .on("error", (err) => {
                        logging.log("Tool stream error:" + JSON.stringify(err));
                        reject(err);
                    });
            } else {
                // Stream is complete
                isComplete = true;
                resolve({
                    message: messageContent,
                    threadId: threadId
                });
            }
        };

        assistantStream
            .on("textDelta", (delta) => {
                messageContent += delta.value;
            })
            .on("end", async () => {
                try {
                    const run = assistantStream.currentRun();
                    await handleToolCalls(run);
                } catch (err) {
                    logging.log("Error handling tool calls:" + JSON.stringify(err));
                    reject(err);
                }
            })
            .on("error", (err) => {
                logging.log("Stream error:" + JSON.stringify(err));
                reject(err);
            });
    });
}
```

## What This Does

1. **Collects all text chunks** from the OpenAI stream
2. **Handles tool calls** if the assistant needs to use tools
3. **Waits for completion** before returning
4. **Returns JSON** with the complete message and thread ID:
   ```json
   {
     "message": "Complete assistant response here",
     "threadId": "thread_abc123..."
   }
   ```

## Trade-off

**Before (Attempted)**: Real-time streaming ❌ (BuildShip doesn't support)  
**After**: Complete message at once ✅ (Works with BuildShip)

The user will see a "thinking..." indicator, then the complete response appears. No real-time typing effect, but it works reliably.

## Mobile App Compatibility

The mobile app already handles this format! It looks for:
- `result.message` ✅
- `result.threadId` ✅

So no mobile app changes needed.

