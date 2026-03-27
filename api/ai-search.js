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

  // Supports both env var spellings + CF gateway key
  const anthropicKey = process.env.Antropic_API || process.env.ANTHROPIC_API_KEY;
  const gatewayKey   = process.env.CF_AI_GATEWAY_KEY;

  if (!anthropicKey && !gatewayKey) {
    return new Response(JSON.stringify({ error: 'No API key configured — add Antropic_API to Vercel env vars' }), { status: 500, headers: corsHeaders });
  }

  // Use CF AI Gateway if gateway key present, else direct Anthropic
  const endpoint = gatewayKey
    ? 'https://gateway.ai.cloudflare.com/v1/0aea812fa2cca191c0468f51f30955c1/default/anthropic/v1/messages'
    : 'https://api.anthropic.com/v1/messages';

  const reqHeaders = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (gatewayKey) reqHeaders['cf-aig-authorization'] = `Bearer ${gatewayKey}`;
  if (anthropicKey) reqHeaders['x-api-key'] = anthropicKey;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: reqHeaders,
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
