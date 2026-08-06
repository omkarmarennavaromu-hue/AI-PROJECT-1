/**
 * Vercel Serverless API Route for Omkar AI
 * Securely acts as a backend proxy to OpenRouter API without leaking keys to the client browser.
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error: OPENROUTER_API_KEY is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { model, messages, temperature, max_tokens } = body;

    // Secure upstream request to OpenRouter endpoints
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://omkar-ai.vercel.app',
        'X-Title': 'Omkar AI Assistant'
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-5-nano',
        messages: messages || [],
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: max_tokens || 1024,
        stream: true
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      return new Response(JSON.stringify({ error: `OpenRouter error: ${openRouterResponse.status} - ${errorText}` }), {
        status: openRouterResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transform OpenRouter Server-Sent Events (SSE) stream back to plain chunks for the client
    const reader = openRouterResponse.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep uncompleted line in buffer

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') {
                controller.close();
                return;
              }

              if (trimmed.startsWith('data:')) {
                try {
                  const json = JSON.parse(trimmed.substring(5).trim());
                  const textChunk = json.choices?.[0]?.delta?.content;
                  if (textChunk) {
                    controller.enqueue(encoder.encode(textChunk));
                  }
                } catch (err) {
                  // Ignore parse glitches on stream chunk intervals
                }
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error processing request.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
