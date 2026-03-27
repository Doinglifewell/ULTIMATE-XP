export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  // Return empty array — client-side demo data fills in when no real data exists
  return new Response(JSON.stringify([]), { headers: cors });
}
