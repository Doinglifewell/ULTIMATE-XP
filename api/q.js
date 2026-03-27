// Short link redirect + creation
// GET  /api/q?s=woodford       → redirect to stored URL
// POST /api/q {slug, url}      → save short link, return short URL

export const config = { runtime: 'edge' };

const CF_ACCOUNT = '0bcfd9f1d0cd563eece8498038754fcd';
const KV_NS      = '5767f34f4c184cb4b5479806f177c808';
const SHORT_BASE = 'https://quotes.byronbaysilentdisco.com/q/';

const CF_TOKEN   = () => process.env.CF_API_TOKEN || process.env.AI_Gateway_XP;

async function kvGet(key) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${CF_TOKEN()}` } }
  );
  if (!r.ok) return null;
  return r.text();
}

async function kvSet(key, value) {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' }, body: value }
  );
}

// Generate a slug from event name: "Woodford Folk Festival" → "woodford"
function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().split(/\s+/)[0]  // first significant word
    .slice(0, 20);
}

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const url = new URL(req.url);

  // GET /api/q?s=woodford — redirect
  if (req.method === 'GET') {
    const slug = url.searchParams.get('s');
    if (!slug) return new Response('Missing slug', { status: 400 });
    const dest = await kvGet(slug);
    if (!dest) return new Response('Link not found', { status: 404 });
    return Response.redirect(dest, 302);
  }

  // POST /api/q — create short link
  if (req.method === 'POST') {
    const { slug: customSlug, url: destUrl, name } = await req.json().catch(() => ({}));
    if (!destUrl) return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const slug = customSlug || (name ? makeSlug(name) : Math.random().toString(36).slice(2, 7));

    // Check if slug exists, add suffix if taken
    let finalSlug = slug;
    const existing = await kvGet(slug);
    if (existing && existing !== destUrl) {
      finalSlug = slug + '-' + Math.random().toString(36).slice(2, 5);
    }

    await kvSet(finalSlug, destUrl);

    const shortUrl = SHORT_BASE + finalSlug;
    return new Response(JSON.stringify({ slug: finalSlug, shortUrl, url: destUrl }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
