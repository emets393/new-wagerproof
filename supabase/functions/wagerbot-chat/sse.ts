// SSE writer for the WagerBot chat edge function.
//
// Emits two kinds of events:
//   1. Forwarded OpenAI SSE chunks (passed through as raw text)
//   2. WagerBot-specific events with `event:` prefix "wagerbot.*":
//
//   wagerbot.thread           — { thread_id, created }
//   wagerbot.tool_start       — { id, name, arguments }
//   wagerbot.tool_end         — { id, name, ms, ok, result_summary }
//   wagerbot.follow_ups       — { questions: string[] }
//   wagerbot.message_persisted — { id, role }
//   wagerbot.error            — { message, code }
//   wagerbot.thread_titled    — { thread_id, title }
//
// The mobile client treats unknown event names as no-ops, so adding a
// new event here is forward-compatible.

export interface SSESink {
  /** Forward raw OpenAI SSE text straight to the client. */
  forwardRaw(chunk: string): void;
  /** Emit a WagerBot-specific event. */
  emit(event: string, data: unknown): void;
  /** Close the stream. */
  close(): void;
}

export function createSSEStream(): { sink: SSESink; body: ReadableStream<Uint8Array> } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const body = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    cancel() { closed = true; },
  });

  const sink: SSESink = {
    forwardRaw(chunk) {
      if (closed || !controller) return;
      try { controller.enqueue(encoder.encode(chunk)); } catch { /* downstream gone */ }
    },
    emit(event, data) {
      if (closed || !controller) return;
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      try { controller.enqueue(encoder.encode(payload)); } catch { /* downstream gone */ }
    },
    close() {
      if (closed || !controller) return;
      closed = true;
      try { controller.close(); } catch { /* already closed */ }
    },
  };

  return { sink, body };
}
