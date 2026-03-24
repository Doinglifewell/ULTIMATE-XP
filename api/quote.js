// Vercel Edge Function — Quote KV sync
// Handles GET and POST for quote data
export const config = { runtime: 'edge' };

const KV_NAMESPACE_ID = '3a3632043656449fb6baa525bc8de78c';
const CF_ACCOUNT_ID   = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN    = process.env.CF_API_TOKEN;

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}`;

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const id  = url.searchParams.get('id') || 'latest';

  // GET — fetch quote
  if (req.method === 'GET') {
    const r = await fetch(`${CF_BASE}/values/${id}`, {
      headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
    });
    if (!r.ok) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    const data = await r.text();
    return new Response(data, { status: 200, headers });
  }

  // POST — save quote
  if (req.method === 'POST') {
    const body = await req.text();
    const parsed = JSON.parse(body);
    const key = parsed.ref ? parsed.ref.replace(/[^a-zA-Z0-9-_]/g, '-') : 'latest';

    // Save with ref as key AND always save as 'latest'
    await Promise.all([
      fetch(`${CF_BASE}/values/${key}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'text/plain' },
        body: body,
      }),
      fetch(`${CF_BASE}/values/latest`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'text/plain' },
        body: body,
      }),
    ]);

    return new Response(JSON.stringify({ ok: true, key }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}
