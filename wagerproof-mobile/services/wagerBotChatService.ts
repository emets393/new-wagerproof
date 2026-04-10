// WagerBot Chat Service — SSE streaming client for the wagerbot-chat edge function.
// Replaces the old BuildShip/chatSessionManager approach.
//
// The edge function streams two kinds of events:
//   1. Forwarded OpenAI SSE chunks (raw `data:` lines with delta JSON)
//   2. Custom `event: wagerbot.*` events for tool execution, thread info, etc.
//
// This service parses the combined stream and yields typed events that the
// chat UI consumes to build ContentBlock-based messages.

// expo-fetch provides ReadableStream support that React Native's built-in fetch lacks
import { fetch as expoFetch } from 'expo/fetch';
import { supabase } from './supabase';
import type {
  WagerBotSSEEvent,
  WagerBotThreadEvent,
  WagerBotToolStartEvent,
  WagerBotToolEndEvent,
  WagerBotFollowUpsEvent,
  WagerBotErrorEvent,
  WagerBotThreadTitledEvent,
  ChatMessage,
  ContentBlock,
} from '../types/chatTypes';

const SUPABASE_URL = 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/wagerbot-chat`;

/**
 * Send a message and stream the response as typed SSE events.
 * Uses a callback pattern instead of AsyncGenerator for React Native compatibility.
 */
export async function sendMessage(params: {
  userMessage: string;
  threadId?: string | null;
  onEvent: (event: WagerBotSSEEvent) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}): Promise<{ abort: () => void }> {
  const { userMessage, threadId, onEvent, onError, onComplete } = params;

  // Get auth token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    onError(new Error('Not authenticated'));
    return { abort: () => {} };
  }

  const abortController = new AbortController();

  (async () => {
    try {
      const response = await expoFetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_message: userMessage,
          thread_id: threadId || undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Chat request failed (${response.status}): ${errorText.slice(0, 200)}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventName = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let lineEnd: number;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);

          // Named event header
          if (line.startsWith('event: ')) {
            currentEventName = line.slice(7).trim();
            continue;
          }

          // Data line
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (currentEventName) {
              // Custom wagerbot.* event
              parseCustomEvent(currentEventName, data, onEvent);
              currentEventName = '';
            } else {
              // Raw OpenAI SSE chunk
              parseOpenAIChunk(data, onEvent);
            }
            continue;
          }

          // Blank line resets event name
          if (line.trim() === '') {
            currentEventName = '';
          }
        }
      }

      onEvent({ type: 'done' });
      onComplete();
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      onError(error instanceof Error ? error : new Error(String(error)));
      onComplete();
    }
  })();

  return { abort: () => abortController.abort() };
}

/** Parse a custom wagerbot.* SSE event. */
function parseCustomEvent(eventName: string, data: string, onEvent: (e: WagerBotSSEEvent) => void) {
  try {
    const parsed = JSON.parse(data);

    switch (eventName) {
      case 'wagerbot.thread':
        onEvent({ type: 'thread', data: parsed as WagerBotThreadEvent });
        break;
      case 'wagerbot.tool_start':
        onEvent({ type: 'tool_start', data: parsed as WagerBotToolStartEvent });
        break;
      case 'wagerbot.tool_end':
        onEvent({ type: 'tool_end', data: parsed as WagerBotToolEndEvent });
        break;
      case 'wagerbot.follow_ups':
        onEvent({ type: 'follow_ups', data: parsed as WagerBotFollowUpsEvent });
        break;
      case 'wagerbot.message_persisted':
        onEvent({ type: 'message_persisted', data: parsed });
        break;
      case 'wagerbot.thread_titled':
        onEvent({ type: 'thread_titled', data: parsed as WagerBotThreadTitledEvent });
        break;
      case 'wagerbot.error':
        onEvent({ type: 'error', data: parsed as WagerBotErrorEvent });
        break;
      case 'wagerbot.thinking_delta':
        onEvent({ type: 'thinking_delta', data: { text: parsed.text } });
        break;
      case 'wagerbot.thinking_done':
        onEvent({ type: 'thinking_done', data: { summary: parsed.summary } });
        break;
    }
  } catch {
    // Malformed JSON in custom event — skip
  }
}

/** Parse a raw OpenAI SSE chunk and extract content deltas. */
function parseOpenAIChunk(data: string, onEvent: (e: WagerBotSSEEvent) => void) {
  if (data === '[DONE]') {
    return;
  }

  try {
    const parsed = JSON.parse(data);
    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return;

    // Content text delta
    if (delta.content) {
      onEvent({ type: 'content_delta', data: { text: delta.content } });
    }

    // Tool call deltas are handled via wagerbot.tool_start/tool_end events
    // so we don't need to parse them from the raw OpenAI stream
  } catch {
    // Malformed JSON — skip
  }
}

/**
 * Load a thread's message history from Supabase.
 * Converts stored messages to ContentBlock-based ChatMessage format.
 */
export async function loadThread(threadId: string): Promise<ChatMessage[]> {
  const { data: msgs, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, blocks, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error || !msgs) return [];

  const messages: ChatMessage[] = [];

  for (const msg of msgs) {
    // Skip tool-result messages (they're internal to the agent loop)
    if (msg.role === 'tool') continue;

    const blocks: ContentBlock[] = [];

    if (msg.blocks) {
      // New block-based format
      const parsed = typeof msg.blocks === 'string' ? JSON.parse(msg.blocks) : msg.blocks;
      for (const block of parsed) {
        if (block.type === 'text' && block.text) {
          blocks.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          blocks.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            arguments: block.arguments || '{}',
            status: { state: 'done', ms: 0, ok: true, summary: '' },
          });
        }
        // tool_result blocks are internal — don't display
      }
    } else if (msg.content) {
      // Legacy plain-text format
      blocks.push({ type: 'text', text: msg.content });
    }

    if (blocks.length === 0) continue;

    messages.push({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      blocks,
      timestamp: msg.created_at,
    });
  }

  return messages;
}
