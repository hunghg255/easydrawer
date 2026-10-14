import { AIError } from './types';

/**
 * Reads the JSON object in a model's answer. Models often wrap JSON in Markdown code fences
 * or add a sentence before or after it.
 */
export default function parseAIJSON (text: string): any {
  const withoutFences = text.replace(/```(?:json)?/gi, '');
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AIError('The AI answer does not contain JSON.');
  }

  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch (error) {
    throw new AIError('The AI answer contains invalid JSON.', error);
  }
}
