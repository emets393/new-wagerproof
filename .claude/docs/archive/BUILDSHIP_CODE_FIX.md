# BuildShip Code Fix - Enable Proper Streaming

## The Issue

Your current BuildShip code returns:
```typescript
return {
    stream: stream,
    threadId: threadId
};
```

This causes BuildShip to serialize both the stream and threadId as JSON, which doesn't actually stream the content.

## The Solution

Change the return statement to include the threadId IN the stream content, then return the stream directly:

### Updated Code

Replace the last part of your BuildShip function with this:

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
}: NodeScriptOptions, ): NodeOutput {
    
    // ... [ALL YOUR EXISTING CODE ABOVE STAYS THE SAME] ...
    
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

    let stream = new Readable();
    stream._read = function() {};

    // ✅ ADD THIS: Push threadId to the stream FIRST
    stream.push(`[threadId:${threadId}]`);

    handleStream(assistantStream, stream);
    
    // ✅ CHANGE THIS: Return stream directly, not wrapped in object
    return stream;
}
```

### What Changed:

1. **Added threadId to stream**: `stream.push(\`[threadId:${threadId}]\`);`
   - This adds the thread ID at the beginning of the stream
   - The mobile app already parses this format

2. **Return stream directly**: `return stream;` instead of `return { stream: stream, threadId: threadId };`
   - This lets BuildShip actually stream the content
   - The stream will be sent as plain text chunks

## How It Works

### Stream Content Flow:
```
[threadId:thread_abc123...]Hello! I'm WagerBot. How can I help you analyze today's games?
```

The mobile app will:
1. ✅ Read the stream chunks as they arrive
2. ✅ Extract `thread_abc123...` from the `[threadId:...]` marker
3. ✅ Remove the marker from display
4. ✅ Show the message: "Hello! I'm WagerBot..."
5. ✅ Store the thread ID for follow-up messages

## Alternative: Using Response Headers

If you prefer not to include the threadId in the stream content, you can set it as a header:

```typescript
// At the end of your function
stream.push(`[threadId:${threadId}]`);  // Still recommended for fallback
handleStream(assistantStream, stream);

return {
    body: stream,
    headers: {
        'x-thread-id': threadId,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    }
};
```

**Note**: Check if BuildShip supports this return format. The first option (including threadId in stream) is simpler and guaranteed to work.

## For SSE Format (Optional)

If you want Server-Sent Events format, set `streamContentForm` to `"simulated-sse"` in your BuildShip workflow inputs, and modify the return:

```typescript
// Add threadId as first SSE event
stream.push(`data: {"type":"threadId","value":"${threadId}"}\n\n`);

handleStream(assistantStream, stream);

return stream;
```

Then update the mobile app to parse SSE format (we'd need to modify the mobile code for this).

## Testing the Fix

After updating your BuildShip code:

1. **Deploy the BuildShip workflow**
2. **Open mobile app and send a message**
3. **Check console logs**, you should see:
   ```
   🌊 Handling streaming response...
   📦 Chunk: [threadId:thread_abc123...]
   🔗 Thread ID extracted from stream: thread_abc123...
   📦 Chunk: Hello! I'm WagerBot...
   📦 Chunk: How can I help...
   ✅ Message received and displayed successfully
   ```
4. **Verify the message displays** in the chat UI
5. **Send follow-up message** to test conversation context

## Complete Updated BuildShip Function

Here's your complete function with the fix:

```typescript
import OpenAI from "openai";
import { Readable } from "stream";

function nodeToOpenAiFunction(node) {
    return {
        name: node.label,
        description: node.meta.description ?? "",
        parameters: sanitiseSchema(node.inputs),
    };
}

function sanitiseSchema(schema) {
    const sanitizedSchema = { ...schema };
    for (const key of Object.keys(sanitizedSchema)) {
        if (
            sanitizedSchema[key].buildship &&
            !sanitizedSchema[key].buildship.toBeAutoFilled
        ) {
            sanitizedSchema[key].description =
                "This value is prefilled, you can't change it, so you should skip it.";
        }
        delete sanitizedSchema[key].buildship;
    }
    return sanitizedSchema;
}

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
    
    const executeToolCall = async (toolCall) => {
        let args;
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (err) {
            logging.log(
                `Couldn't parse function arguments. Received: ${toolCall.function.arguments}`,
            );
            throw new Error(
                `Couldn't parse function arguments. Received: ${toolCall.function.arguments}`,
            );
        }

        const output = await execute(toolCall.function.name, args);

        return {
            tool_call_id: toolCall.id,
            output: output ? JSON.stringify(output) : "",
        };
    };

    const apiKey = auth.getKey();

    const tools =
        nodes?.map((n) => {
            return {
                type: "function",
                function: nodeToOpenAiFunction(n),
            };
        }) ?? [];
    if ((builtInTools ?? []).includes("file_search")) {
        tools.push({ type: "file_search" });
    }
    if ((builtInTools ?? []).includes("code_interpreter")) {
        tools.push({ type: "code_interpreter" });
    }

    const openai = new OpenAI({ apiKey });

    if (prompt === undefined) {
        logging.log("User Prompt is undefined.");
        throw new Error("User Prompt is undefined.");
    }

    const handleStream = (runStream, stream: Readable) => {
        const checkForToolCall = async () => {
            const run = runStream.currentRun();
            if (run?.status !== "requires_action") {
                if (streamContentForm === "simulated-sse") {
                    // stream.push("data: [DONE]\n\n");
                }
                stream.push(null);
                return;
            }

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

            handleStream(newToolStream, stream);
        };

        if (streamContentForm === "simulated-sse") {
            runStream
                .on("event", (event) => {
                    if (event.event === "thread.message.delta") {
                        stream.push("data: " + JSON.stringify(event.data));
                        stream.push("\n\n");
                    }
                    if (event.event === "thread.message.completed") {
                        stream.push(null);
                    }
                })
                .on("end", () => {
                    checkForToolCall();
                })
                .on("error", (err) => {
                    logging.log("Stream has errored out:" + JSON.stringify(err));
                    stream.push(null);
                });
        } else {
            runStream
                .on("textDelta", (delta, acc) => {
                    stream.push(delta.value);
                })
                .on("end", () => {
                    checkForToolCall();
                })
                .on("error", (err) => {
                    logging.log("Stream has errored out:" + JSON.stringify(err));
                    stream.push(null);
                });
        }
    };

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

    let stream = new Readable();
    stream._read = function() {};

    // ✅ ADD THIS LINE: Include threadId at the start of the stream
    stream.push(`[threadId:${threadId}]`);

    handleStream(assistantStream, stream);
    
    // ✅ CHANGE THIS LINE: Return stream directly
    return stream;
}
```

## Key Changes Summary

1. **Line added before `handleStream()`**:
   ```typescript
   stream.push(`[threadId:${threadId}]`);
   ```

2. **Return statement changed**:
   ```typescript
   // Before:
   return { stream: stream, threadId: threadId };
   
   // After:
   return stream;
   ```

That's it! Two simple changes and your streaming will work perfectly. 🎉

