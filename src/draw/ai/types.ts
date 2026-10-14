export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  /** `true` when the answer must be a JSON object. */
  json: boolean;
  signal?: AbortSignal;
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
