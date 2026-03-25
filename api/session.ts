/**
 * Vercel Serverless Function: POST /api/session
 *
 * This replaces the local Express route in `server.ts` for production deployments on Vercel.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY env var' }));
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        instructions: `You are a professional tattoo consultant.
CRITICAL: You have visual eyes. You will receive screenshots of the user's camera every 500ms.
Use these images to see the user's skin, existing tattoos, or the area they want to get tattooed.
Comment on what you see! If they show you their arm, say "I see your arm".
If they show you a drawing, comment on the drawing.
Be encouraging, artistic, and professional.
If the user asks for a sample or a design, use the 'generate_tattoo_design' tool.
Do not mention that you are receiving screenshots unless asked. Just act like you can see them live.`,
        modalities: ['text', 'audio'],
        tools: [
          {
            type: 'function',
            name: 'generate_tattoo_design',
            description: 'Generates a high-quality tattoo design based on a descriptive prompt.',
            parameters: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'A detailed description of the tattoo design to generate.',
                },
              },
              required: ['prompt'],
            },
          },
        ],
        tool_choice: 'auto',
      }),
    });

    const data = await response.json();
    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (error: any) {
    // Avoid leaking secrets; send a generic message.
    console.error('Error creating session:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to create session' }));
  }
}