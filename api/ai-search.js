export const config = { runtime: 'edge' };

const CORS = { 'Content-Type': 'application/json' };

// Only allow requests from our own domains
const ALLOWED_ORIGINS = [
  'https://xp.byronbaysilentdisco.com',
  'https://quotes.byronbaysilentdisco.com',
  'https://ultimate-xp.vercel.app',
];

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  // CORS — only allow our domains (plus localhost for dev)
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost') || origin.includes('vercel.app');
  const corsHeaders = {
    ...CORS,
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Internal key check — must match INTERNAL_API_KEY env var
  const internalKey = req.headers.get('x-internal-key');
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (expectedKey && internalKey !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const { eventName } = await req.json();
  if (!eventName) {
    return new Response(JSON.stringify({ error: 'eventName required' }), { status: 400, headers: corsHeaders });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: corsHeaders });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'interleaved-thinking-2025-05-14'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: `You are a festival/event research assistant. Search the web and return ONLY a valid JSON object (no markdown, no explanation) with these exact fields:
{
  "name": "Official full event name",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD",
  "location": "Venue name, City, State",
  "type": "Music Festival|Folk / Cultural Festival|Food & Wine Festival|Corporate Event|New Year's Eve|Private Festival|Other",
  "contact": "Festival Director name if found, or empty string",
  "summary": "One sentence describing the event for internal notes",
  "confidence": "high|medium|low"
}
Return ONLY the JSON object, nothing else.`,
      messages: [{ role: 'user', content: `Find details for this event: ${eventName}` }]
    })
  });

  const data = await response.json();

  return new Response(JSON.stringify(data), { headers: corsHeaders });
}
