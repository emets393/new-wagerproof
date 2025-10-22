# BuildShip Final Working Solution

Since `req` is undefined, we'll collect the stream content and return it as a complete message.

## Complete Working Code

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
    streamContentForm,
}: NodeInputs, {
    auth,
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

    // Collect the complete message
    let messageContent = '';

    return new Promise((resolve, reject) => {
        const handleToolCalls = async (run) => {
            if (run?.status === "requires_action") {
                try {
                    const toolOutputs = await Promise.all(
                        run.required_action?.submit_tool_outputs.tool_calls.map(
                            executeToolCall
                        ) ?? []
                    );

                    const toolStream = openai.beta.threads.runs.submitToolOutputsStream(
                        run.thread_id,
                        run.id,
                        { tool_outputs: toolOutputs }
                    );

                    toolStream
                        .on("textDelta", (delta) => {
                            messageContent += delta.value;
                        })
                        .on("end", async () => {
                            await handleToolCalls(toolStream.currentRun());
                        })
                        .on("error", (err) => {
                            logging.log("Tool stream error:" + JSON.stringify(err));
                            reject(err);
                        });
                } catch (err) {
                    logging.log("Tool call error:" + JSON.stringify(err));
                    reject(err);
                }
            } else {
                // Stream complete - return the result
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
                    await handleToolCalls(assistantStream.currentRun());
                } catch (err) {
                    logging.log("End handler error:" + JSON.stringify(err));
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

This returns:
```json
{
  "message": "Complete assistant response",
  "threadId": "thread_abc123..."
}
```

The mobile app already handles this format perfectly!

