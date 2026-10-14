import { AIError, type AIRequestHandler } from './types';

export interface OpenAICompatibleOptions {
  /** Chat completions URL, e.g. `https://openrouter.ai/api/v1/chat/completions`. */
  url: string;
  model: string;
  /**
   * Only on a server, or when `url` is your own proxy: an API key in browser code can be
   * read by anyone.
   */
  apiKey?: string;
  headers?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * An {@link AIRequestHandler} for any OpenAI-compatible chat completions API
 * (OpenAI, OpenRouter, Groq, Ollama, LM Studio…).
 *
 * @example
 * ```ts
 * // On your server:
 * const request = openAICompatibleRequest({
 *   url: 'https://openrouter.ai/api/v1/chat/completions',
 *   model: 'openai/gpt-4o-mini',
 *   apiKey: process.env.OPENROUTER_API_KEY,
 * });
 * ```
 */
export function openAICompatibleRequest (options: OpenAICompatibleOptions): AIRequestHandler {
  return async ({ messages, signal }) => {
    const response = await fetch(options.url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        ...options.headers,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.2,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
    });

    if (!response.ok) {
      throw new AIError(`AI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new AIError('The AI returned an empty answer.');
    }
    return content;
  };
}
