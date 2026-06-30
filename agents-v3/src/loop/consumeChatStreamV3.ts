// consumeChatStreamV3 — streaming Chat Completions consumer for the V3 agentic
// generation loop. Forked from wagerbot-agent/agent.ts:consumeChatStream with
// the critical addition the chat consumer lacks: it CAPTURES the usage chunk.
//
// The provider, when sent `stream_options:{include_usage:true}`, emits a final
// chunk before [DONE] whose `choices` array is empty and which carries
// `usage:{prompt_tokens,completion_tokens}`. The chat parser drops it (it
// `continue`s when there is no `choices[0].delta`). The V3 token ceiling is
// unenforceable without this, so we read it explicitly.
//
// DeepSeek thinking mode streams `reasoning_content` deltas before `content`;
// we accumulate them into `reasoning` for the audit trail AND (V4 contract,
// inverted from R1) the loop passes it back on tool-calling assistant turns.

import type { PendingToolCall, StreamResult, Usage } from "./types";

export async function consumeChatStreamV3(
  body: ReadableStream<Uint8Array>,
): Promise<StreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let textContent = "";
  let reasoning = "";
  let usage: Usage | null = null;
  let finishReason: string | null = null;
  let streamError: string | null = null;
  const toolCallsByIndex: Record<number, PendingToolCall> = {};

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line.startsWith("data:")) continue;

      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;

      let data: any;
      try { data = JSON.parse(dataStr); } catch { continue; }

      if (data?.error) {
        streamError = data.error?.message || JSON.stringify(data.error).slice(0, 200);
        continue;
      }

      // Usage-only final chunk (choices empty/absent) — the whole point of the fork.
      if (data?.usage && typeof data.usage === "object") {
        usage = {
          prompt_tokens: Number(data.usage.prompt_tokens ?? 0),
          completion_tokens: Number(data.usage.completion_tokens ?? 0),
        };
      }

      const choice = data?.choices?.[0];
      if (!choice) continue;
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (!delta) continue;

      if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
        reasoning += delta.reasoning_content;
      }
      if (typeof delta.content === "string" && delta.content) {
        textContent += delta.content;
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === "number" ? tc.index : 0;
          const entry =
            toolCallsByIndex[idx] ??
            (toolCallsByIndex[idx] = { index: idx, id: "", name: "", arguments: "" });
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (typeof tc.function?.arguments === "string") entry.arguments += tc.function.arguments;
        }
      }
    }
  }

  if (streamError) throw new Error(`LLM stream failed: ${streamError}`);

  const toolCalls = Object.values(toolCallsByIndex)
    .filter((c) => c.name)
    .map((c) => ({ ...c, id: c.id || `call_${c.index}` }));

  return {
    textContent: textContent || null,
    reasoning: reasoning || null,
    toolCalls,
    usage,
    finishReason,
  };
}
