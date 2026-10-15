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

/**
 * Reads the JSON object in an answer that is still arriving (see `AIRequest.onText`): the
 * complete values so far. Objects inside the main one are left out until they're complete
 * (e.g. a node of a diagram without its label yet); the open arrays and the main object are
 * closed.
 *
 * @returns `null` if there is no object yet.
 */
export function parsePartialAIJSON (text: string): any {
  const withoutFences = text.replace(/```(?:json)?/gi, '');
  const start = withoutFences.indexOf('{');
  if (start === -1) return null;
  const json = withoutFences.slice(start);

  // The end of the last complete part, and the objects/arrays open there.
  let safeEnd = 0;
  let safeStack = '';
  let stack = '';
  let inString = false;
  const markSafe = (end: number) => {
    // Not inside an unfinished object (other than the main one).
    if (stack.includes('}', 1)) return;
    safeEnd = end;
    safeStack = stack;
  };
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      stack += char === '{' ? '}' : ']';
      markSafe(i + 1);
    } else if (char === '}' || char === ']') {
      stack = stack.slice(0, -1);
      markSafe(i + 1);
      if (stack === '') break;
    } else if (char === ',') {
      markSafe(i);
    }
  }

  try {
    return JSON.parse(json.slice(0, safeEnd) + [...safeStack].reverse().join(''));
  } catch {
    return null;
  }
}
