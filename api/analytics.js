// Read analytics for a quote
// GET /api/analytics?id=woodford
export const config = { runtime: 'edge' };

const CF_ACCOUNT = '0bcfd9f1d0cd563eece8498038754fcd';
const KV_NS      = '5767f34f4c184cb4b5479806f177c808';
const CF_TOKEN   = () => process.env.CF_API_TOKEN;

export default async function handler(req) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: cors });

  const key = `analytics:${id}`;
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${CF_TOKEN()}` } }
  );
  if (!r.ok) return new Response(JSON.stringify({ error: 'not found', views: 0 }), { status: 404, headers: cors });
  const data = await r.text();
  return new Response(data, { headers: cors });
}
