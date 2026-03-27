export const config = { runtime: 'edge' };

const KV_NS  = '65fe935637a5483fa57237ba8eee3ce6';
const CORS   = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' };

async function kvGet(key, token, accountId) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`,
    { headers:{ Authorization:`Bearer ${token}` } }
  );
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

async function kvSet(key, value, token, accountId) {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`,
    { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'text/plain' }, body: JSON.stringify(value) }
  );
}

const defaultChannel = () => ({
  requests: [],
  history:  [],
  maxPerDevice: 3,
  blockedGenres: [],
  allowExplicit: true,
  nextId: 1,
});

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' } });
  }

  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const CF_API_TOKEN  = process.env.CF_API_TOKEN;
  const url = new URL(req.url);
  const ch  = url.searchParams.get('ch') || 'green'; // green | red | blue
  const key = `udj:channel:${ch}`;

  // ── GET queue ──
  if (req.method === 'GET') {
    const data = (await kvGet(key, CF_API_TOKEN, CF_ACCOUNT_ID)) || defaultChannel();
    return new Response(JSON.stringify(data), { headers: CORS });
  }

  // ── POST new request (from guest) ──
  if (req.method === 'POST') {
    const body = await req.json();
    const data = (await kvGet(key, CF_API_TOKEN, CF_ACCOUNT_ID)) || defaultChannel();

    // Enforce per-device limit
    const deviceRequests = data.requests.filter(r => r.deviceId === body.deviceId && r.status === 'pending').length;
    if (deviceRequests >= data.maxPerDevice) {
      return new Response(JSON.stringify({ error: 'limit_reached', max: data.maxPerDevice }), { status: 429, headers: CORS });
    }

    // Genre filter
    if (body.genre && data.blockedGenres?.includes(body.genre)) {
      return new Response(JSON.stringify({ error: 'genre_blocked' }), { status: 403, headers: CORS });
    }

    // Explicit filter
    if (!data.allowExplicit && body.explicit) {
      return new Response(JSON.stringify({ error: 'explicit_blocked' }), { status: 403, headers: CORS });
    }

    const request = {
      id:       data.nextId,
      name:     body.name,
      artist:   body.artist,
      album:    body.album || '',
      artwork:  body.artwork || null,
      genre:    body.genre || '',
      explicit: body.explicit || false,
      deviceId: body.deviceId,
      ts:       new Date().toISOString(),
      status:   'pending',
    };

    data.requests = [...data.requests, request];
    data.nextId   = data.nextId + 1;
    await kvSet(key, data, CF_API_TOKEN, CF_ACCOUNT_ID);

    return new Response(JSON.stringify({ ok:true, id:request.id }), { headers: CORS });
  }

  // ── PATCH update status (from DJ) ──
  if (req.method === 'PATCH') {
    const body = await req.json();
    const data = (await kvGet(key, CF_API_TOKEN, CF_ACCOUNT_ID)) || defaultChannel();
    const { id, status, settings } = body;

    if (settings) {
      // Update channel settings
      Object.assign(data, settings);
    } else {
      // Update request status
      data.requests = data.requests.map(r => r.id === id ? { ...r, status } : r);

      // If marked as played, add to history
      if (status === 'played') {
        const req = data.requests.find(r => r.id === id);
        if (req) {
          const ex = data.history.find(h => h.name === req.name && h.artist === req.artist);
          data.history = ex
            ? data.history.map(h => h.name === req.name && h.artist === req.artist
                ? { ...h, playCount: h.playCount + 1, lastPlayed: new Date().toISOString() } : h)
            : [{ name:req.name, artist:req.artist, album:req.album||'', artwork:req.artwork||null,
                 playCount:1, lastPlayed:new Date().toISOString() }, ...data.history];
        }
      }
    }

    await kvSet(key, data, CF_API_TOKEN, CF_ACCOUNT_ID);
    return new Response(JSON.stringify({ ok:true }), { headers: CORS });
  }

  // ── DELETE clear queue ──
  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    const data = (await kvGet(key, CF_API_TOKEN, CF_ACCOUNT_ID)) || defaultChannel();
    if (body.clearHistory) data.history = [];
    else data.requests = [];
    await kvSet(key, data, CF_API_TOKEN, CF_ACCOUNT_ID);
    return new Response(JSON.stringify({ ok:true }), { headers: CORS });
  }

  return new Response('Not found', { status: 404 });
}
