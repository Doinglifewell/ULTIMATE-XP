export const config = { runtime: 'edge' };

export default function handler(req) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: 'not configured' }), {
    status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
  return new Response(JSON.stringify({ key }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'private, max-age=3600' }
  });
}
