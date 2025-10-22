# BuildShip Working Stream Code

Based on the successful streaming example, here's the corrected version:

```typescript
import OpenAI from "openai";

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
}: NodeInputs, {
    auth,
    req,
    logging,
    execute,
    nodes
}: NodeScriptOptions): NodeOutput {
    
    // ✅ KEY: Set response type to text/plain for streaming
    req.type = "text/plain";
    
    const executeToolCall = async (toolCall) => {
        let args;
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (err) {
            logging.log(
                `Couldn't parse function arguments. Received: ${toolCall.function.arguments}`
            );
            throw new Error(
                `Couldn't parse function arguments. Received: ${toolCall.function.arguments}`
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

    // Track accumulated response
    let accRes = {
        message: "",
        done: false,
    };

    const handleStream = (runStream, accRes) => {
        const checkForToolCall = async () => {
            const run = runStream.currentRun();
            if (run?.status !== "requires_action") {
                accRes.done = true;
                return;
            }

            const toolOutputs = await Promise.all(
                run.required_action?.submit_tool_outputs.tool_calls.map(
                    executeToolCall
                ) ?? []
            );

            const newToolStream = openai.beta.threads.runs.submitToolOutputsStream(
                run.thread_id,
                run.id,
                { tool_outputs: toolOutputs }
            );

            handleStream(newToolStream, accRes);
        };

        runStream
            .on("textDelta", (delta, acc) => {
                // Accumulate the message
                accRes.message = accRes.message + delta.value;
                // Write to response stream
                req.write(delta.value);
            })
            .on("end", () => {
                checkForToolCall();
            })
            .on("error", (err) => {
                logging.log(
                    "Stream has errored out:" + JSON.stringify(err)
                );
                accRes.message = accRes.message + `ERROR: ${JSON.stringify(err)}`;
            });
    };

    // Add the user prompt first
    if (!threadId) {
        threadId = (
            await openai.beta.threads.create({
                messages: [{ role: "user", content: prompt }],
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

    // ✅ Write thread ID at the start of stream
    req.write(`[threadId:${threadId}]`);

    handleStream(assistantStream, accRes);

    // Return the thread ID
    return { threadId: threadId };
}
```

## Key Changes

1. **Set response type**: `req.type = "text/plain";`
   - This tells BuildShip to stream the response

2. **Write to response**: `req.write(delta.value);`
   - Each text chunk is written directly to the HTTP response

3. **Include thread ID in stream**: `req.write(\`[threadId:${threadId}]\`);`
   - Mobile app will extract this

4. **Return thread ID**: `return { threadId: threadId };`
   - BuildShip uses this internally

## How It Works

1. BuildShip sees `req.type = "text/plain"` and enables streaming mode
2. As OpenAI sends text chunks, they're written to `req` stream
3. Mobile app receives chunks in real-time
4. Thread ID is embedded in the stream for mobile app to extract

## Mobile App Will Receive

```
[threadId:thread_abc123...]Hello! I'm WagerBot. How can I help you analyze today's games?
```

Streamed in real-time as chunks arrive!

