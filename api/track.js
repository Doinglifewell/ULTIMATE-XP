// Analytics tracking endpoint
// POST /api/track { event, quoteId, data }
// Events: 'view_p1', 'view_p2', 'slider', 'date_select', 'pdf_download', 'share'

export const config = { runtime: 'edge' };

const CF_ACCOUNT = '0bcfd9f1d0cd563eece8498038754fcd';
const KV_NS      = '5767f34f4c184cb4b5479806f177c808'; // reuse ue-short-links KV
const CF_TOKEN   = () => process.env.CF_API_TOKEN || process.env.BBSD_CF_TOKEN;

const KV_URL = (key) =>
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`;

async function kvGet(key) {
  const r = await fetch(KV_URL(key), { headers: { Authorization: `Bearer ${CF_TOKEN()}` } });
  if (!r.ok) return null;
  try { return JSON.parse(await r.text()); } catch { return null; }
}

async function kvSet(key, value) {
  const r = await fetch(KV_URL(key), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
    body: JSON.stringify(value)
  });
  if (!r.ok) {
    const body = await r.text().catch(()=>'');
    console.error(`KV write failed ${r.status} for key "${key}": ${body.slice(0,200)}`);
    return false;
  }
  return true;
}

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { event, quoteId, data } = await req.json().catch(() => ({}));
  if (!event || !quoteId) return new Response(JSON.stringify({ error: 'event and quoteId required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

  const key = `analytics:${quoteId}`;
  const now = Date.now();

  // Load existing analytics or init
  let a = await kvGet(key) || {
    quoteId, views: 0, p2views: 0, shares: 0, downloads: 0,
    sessions: [], datesSelected: {}, priceClicks: {},
    hsReadings: [], lastSeen: null, createdAt: now
  };

  if(!CF_TOKEN()) {
    console.error('CF_API_TOKEN not set — KV writes will fail');
  }

  switch(event) {
    case 'view_p1':
      a.views = (a.views || 0) + 1;
      a.lastSeen = now;
      a.sessions = [...(a.sessions || []).slice(-19), { ts: now, hs: data?.hs || 0 }];
      break;
    case 'view_p2':
      a.p2views = (a.p2views || 0) + 1;
      a.lastSeen = now;
      break;
    case 'slider':
      if (data?.hs) {
        a.hsReadings = [...(a.hsReadings || []).slice(-49), { ts: now, hs: data.hs }];
        // Update session last HS
        if (a.sessions?.length) a.sessions[a.sessions.length - 1].hs = data.hs;
        // Recalc avg HS
        const readings = a.hsReadings || [];
        a.avgHS = readings.length ? Math.round(readings.reduce((s, r) => s + r.hs, 0) / readings.length) : 0;
      }
      break;
    case 'date_select':
      if (data?.date) {
        a.datesSelected = a.datesSelected || {};
        a.datesSelected[data.date] = (a.datesSelected[data.date] || 0) + 1;
        a.avgDays = Object.keys(a.datesSelected).length;
      }
      break;
    case 'price_click':
      if (data?.price) {
        a.priceClicks = a.priceClicks || {};
        a.priceClicks[data.price] = (a.priceClicks[data.price] || 0) + 1;
      }
      break;
    case 'pdf_download':
      a.downloads = (a.downloads || 0) + 1;
      break;
    case 'share':
      a.shares = (a.shares || 0) + 1;
      break;
  }

  // Calc p1→p2 rate
  if (a.views > 0) a.p1p2Rate = Math.min(1, (a.p2views || 0) / a.views);

  await kvSet(key, a);

  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
}
