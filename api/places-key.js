export const config = { runtime: 'edge' };
export default function handler(req) {
  const key = process.env.Google_Places;
  if (!key) return new Response(JSON.stringify({ error: 'not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ key }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
