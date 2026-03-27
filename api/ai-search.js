export const config = { runtime: 'edge' };

const CORS = { 'Content-Type': 'application/json' };
const ALLOWED_ORIGINS = [
  'https://xp.byronbaysilentdisco.com',
  'https://quotes.byronbaysilentdisco.com',
  'https://ultimate-xp.vercel.app',
];

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.includes('vercel.app') || origin.includes('localhost');
  const corsHeaders = {
    ...CORS,
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { eventName } = await req.json().catch(() => ({}));
  if (!eventName) return new Response(JSON.stringify({ error: 'eventName required' }), { status: 400, headers: corsHeaders });

  const CF_ACCOUNT_ID  = '0bcfd9f1d0cd563eece8498038754fcd';
  const CF_GATEWAY_ID  = process.env.CF_AI_GATEWAY_ID;
  const CF_GATEWAY_KEY = process.env.CF_AI_GATEWAY_KEY;
  const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

  let endpoint, headers;

  if (CF_GATEWAY_ID && CF_GATEWAY_KEY) {
    // Route through Cloudflare AI Gateway
    endpoint = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_GATEWAY_ID}/anthropic/v1/messages`;
    headers = {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${CF_GATEWAY_KEY}`,
      'anthropic-version': '2023-06-01',
    };
  } else if (ANTHROPIC_KEY) {
    // Direct Anthropic fallback
    endpoint = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    };
  } else {
    return new Response(JSON.stringify({ error: 'No AI credentials configured. Add CF_AI_GATEWAY_ID + CF_AI_GATEWAY_KEY or ANTHROPIC_API_KEY to Vercel env vars.' }), { status: 500, headers: corsHeaders });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: `You are a festival/event research assistant. Return ONLY a valid JSON object (no markdown, no backticks, no explanation) with these exact fields:
{
  "name": "Official full event name",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD",
  "location": "Venue name, City, State",
  "type": "Music Festival|Folk / Cultural Festival|Food & Wine Festival|Corporate Event|New Year's Eve|Private Festival|Other",
  "contact": "Festival Director name if known, or empty string",
  "summary": "One sentence describing the event",
  "confidence": "high|medium|low"
}
Return ONLY the JSON object.`,
        messages: [{ role: 'user', content: `Find details for this event: ${eventName}` }]
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
