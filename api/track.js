export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { sid, event, page, data } = body;

    if (!sid || !event) {
      return new Response(JSON.stringify({ error: 'sid and event required' }), { status: 400 });
    }

    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
    const CF_API_TOKEN  = process.env.CF_API_TOKEN;
    const KV_NAMESPACE  = '00fe1083681a48cdb722d6cee2500f61'; // ue-funnel-tracking

    const ts  = Date.now();
    const key = `funnel:${sid}:${ts}:${event}`;
    const val = JSON.stringify({
      sid, event, page,
      ts, ts_iso: new Date(ts).toISOString(),
      data: data || {},
      ua: req.headers.get('user-agent') || '',
      ref: req.headers.get('referer') || '',
    });

    if (CF_ACCOUNT_ID && CF_API_TOKEN) {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE}/values/${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: val,
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, key }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
