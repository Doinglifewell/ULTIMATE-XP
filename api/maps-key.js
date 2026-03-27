export const config = { runtime: 'edge' };
export default function handler(req) {
  // Try all possible casing variations of the env var name
  const key = process.env.GOOGLE_PLACES_API_KEY
           || process.env.Google_Places
           || process.env.GOOGLE_PLACES
           || process.env.google_places
           || process.env.GOOGLE_MAPS_API_KEY
           || process.env.Google_Maps
           || process.env.GOOGLE_MAPS;

  if (!key) {
    return new Response(JSON.stringify({
      error: 'Maps key not configured',
      tried: ['GOOGLE_PLACES_API_KEY','Google_Places','GOOGLE_PLACES','GOOGLE_MAPS_API_KEY']
    }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  return new Response(JSON.stringify({ key }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
