// V3 agentic generation — shared wire types. Self-contained (copied patterns
// from wagerbot-agent/agent.ts; imports nothing from wagerbot-agent so the live
// chat loop is never coupled to generation).

/** OpenAI/DeepSeek Chat Completions message shapes. */
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  // reasoning_content: DeepSeek V4 thinking mode REQUIRES the CoT of every
  // tool-calling assistant turn to be passed back on subsequent requests
  // (api-docs.deepseek.com/guides/thinking_mode). Omit for OpenAI.
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[]; reasoning_content?: string }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Token usage from the stream's final usage chunk (requires
 *  stream_options:{include_usage:true} — see consumeChatStreamV3). */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface PendingToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

/** Result of consuming one streamed turn. Unlike the chat loop's consumer,
 *  this captures `usage` so the LoopGovernor's token ceiling is enforceable. */
export interface StreamResult {
  textContent: string | null;
  /** DeepSeek thinking-mode chain-of-thought. Stored to audit; for V4 models
   *  it must ALSO be passed back on tool-calling turns (see ChatMessage). */
  reasoning: string | null;
  toolCalls: PendingToolCall[];
  usage: Usage | null;
  /** finish_reason of the last choice (e.g. "tool_calls" | "stop" | "length"). */
  finishReason: string | null;
}

/** JSON-schema tool definition passed to the model. */
export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}
