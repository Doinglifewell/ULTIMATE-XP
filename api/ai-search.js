export const config = { runtime: 'edge' };

const CORS = { 'Content-Type': 'application/json' };
const ALLOWED_ORIGINS = [
  'https://xp.byronbaysilentdisco.com',
  'https://quotes.byronbaysilentdisco.com',
  'https://ultimate-xp.vercel.app',
];

const CF_ACCOUNT   = '0aea812fa2cca191c0468f51f30955c1';
const CF_GATEWAY   = 'default';
const GATEWAY_URL  = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT}/${CF_GATEWAY}/anthropic/v1/messages`;
const DIRECT_URL   = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are a festival/event research assistant. Return ONLY a valid JSON object (no markdown, no backticks, no explanation) with these exact fields:
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
Return ONLY the JSON object.`;

async function callAnthropic(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

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

  const gatewayKey  = process.env.CF_AI_GATEWAY_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!gatewayKey && !anthropicKey) {
    return new Response(JSON.stringify({ error: 'No AI credentials configured' }), { status: 500, headers: corsHeaders });
  }

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Find details for this event: ${eventName}` }]
  };

  // Try CF AI Gateway first, fall back to direct Anthropic
  let data;
  let source = 'gateway';

  if (gatewayKey) {
    try {
      data = await callAnthropic(GATEWAY_URL, {
        'Content-Type': 'application/json',
        'cf-aig-authorization': `Bearer ${gatewayKey}`,
        'anthropic-version': '2023-06-01',
      }, body);
    } catch (e) {
      console.warn(`Gateway failed (${e.message}), falling back to Anthropic direct`);
      source = 'fallback';
      if (!anthropicKey) {
        return new Response(JSON.stringify({ error: `Gateway failed and no ANTHROPIC_API_KEY fallback: ${e.message}` }), { status: 502, headers: corsHeaders });
      }
    }
  }

  // Fallback to direct Anthropic if gateway failed or not configured
  if (!data && anthropicKey) {
    try {
      data = await callAnthropic(DIRECT_URL, {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      }, body);
      source = 'direct';
    } catch (e) {
      return new Response(JSON.stringify({ error: `All AI providers failed: ${e.message}` }), { status: 502, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ ...data, _source: source }), { headers: corsHeaders });
}
