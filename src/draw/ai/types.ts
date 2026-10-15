export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  /** `true` when the answer must be a JSON object. */
  json: boolean;
  signal?: AbortSignal;
  /**
   * Given when the answer can be shown while it arrives (e.g. a diagram drawn step by step):
   * a handler that can stream the answer calls it with **all the text so far** each time
   * more arrives. Handlers that can't stream can ignore it.
   */
  onText?: (textSoFar: string) => void;
}

/**
 * Sends a chat request to a language model and returns the text of its answer.
 *
 * EasyDrawer doesn't call any AI service itself: provide a function that calls yours.
 * In a browser, call **your own server**, which adds the API key — never put an API key
 * in client-side code.
 *
 * @example
 * ```ts
 * const request: AIRequestHandler = async ({ messages, signal }) => {
 *   const response = await fetch('/api/ai', {
 *     method: 'POST',
 *     body: JSON.stringify({ messages }),
 *     signal,
 *   });
 *   return (await response.json()).content;
 * };
 * ```
 *
 * To draw diagrams and mind maps step by step while the answer arrives, call
 * `request.onText` with the text so far (see {@link readTextStream}).
 */
export type AIRequestHandler = (request: AIRequest) => Promise<string>;

export interface AISettings {
  request: AIRequestHandler;
}

/** Thrown when the AI isn't configured, fails, or gives an answer that can't be used. */
export class AIError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AIError';
  }
}

/**
 * Reads a streamed answer: either plain text chunks, or the
 * [server-sent events](https://developer.mozilla.org/docs/Web/API/Server-sent_events) of an
 * OpenAI-compatible API (`stream: true`). Calls `onText` with all the text so far as it
 * arrives.
 *
 * @example
 * ```ts
 * const request: AIRequestHandler = async ({ messages, signal, onText }) => {
 *   const response = await fetch('/api/ai', {
 *     method: 'POST',
 *     body: JSON.stringify({ messages, stream: !!onText }),
 *     signal,
 *   });
 *   if (onText && response.body) return readTextStream(response, onText);
 *   return (await response.json()).content;
 * };
 * ```
 *
 * @returns the whole text.
 */
export async function readTextStream (response: Response, onText?: (textSoFar: string) => void): Promise<string> {
  const isEvents = (response.headers.get('Content-Type') ?? '').includes('text/event-stream');
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let text = '';
  let pending = '';
  for (;;) {
    const { done, value } = await reader.read();
    const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
    if (isEvents) {
      // Complete lines only: `data: {...}` events.
      pending += chunk;
      const lines = pending.split('\n');
      pending = done ? '' : lines.pop() ?? '';
      for (const line of lines) {
        const data = line.trim().replace(/^data:\s*/, '');
        if (!line.trim().startsWith('data:') || data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event?.error) throw new AIError(`AI service error: ${event.error.message ?? event.error}`);
          text += event?.choices?.[0]?.delta?.content ?? '';
        } catch (error) {
          if (error instanceof AIError) throw error;
          // Not JSON (e.g. a comment): skip it.
        }
      }
    } else {
      text += chunk;
    }
    if (chunk) onText?.(text);
    if (done) break;
  }
  return text;
}
