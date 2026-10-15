// Vercel Function: forwards the playground's AI requests to OpenRouter.
// The API key stays on the server: set OPENROUTER_API_KEY (and optionally OPENROUTER_MODEL)
// in the Vercel project's environment variables.

const defaultModel = 'nvidia/nemotron-3.5-lightning:free';
const maxMessages = 10;
const maxCharacters = 20000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > maxMessages) {
    return false;
  }
  let total = 0;
  for (const message of messages) {
    if (!['system', 'user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string') {
      return false;
    }
    total += message.content.length;
  }
  return total <= maxCharacters;
}

// Open /api/ai in a browser to check the setup (no secrets are shown).
export function GET() {
  return json({
    configured: !!process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || defaultModel,
  });
}

export async function POST(request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json({ error: 'AI is not configured on this server (missing OPENROUTER_API_KEY).' }, 503);
  }

  const body = await request.json().catch(() => null);
  if (!isValidMessages(body?.messages)) {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Streamed: the playground draws diagrams step by step while the answer arrives.
  const stream = body.stream === true;

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://easydrawer.vercel.app',
        'X-Title': 'EasyDrawer playground',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || defaultModel,
        messages: body.messages,
        temperature: 0.2,
        max_tokens: 4000,
        stream,
      }),
    });
  } catch {
    return json({ error: 'Could not reach the AI service.' }, 502);
  }

  if (stream && response.ok && response.body) {
    // OpenRouter's server-sent events, as they are (the client reads them).
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? response.statusText;
    return json({ error: `AI service error (${response.status}): ${message}` }, 502);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return json({ error: 'The AI returned an empty answer. Try again.' }, 502);
  }
  return json({ content });
}
