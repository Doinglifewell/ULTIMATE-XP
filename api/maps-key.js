export const config = { runtime: 'edge' };

export default function handler(req) {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return new Response(JSON.stringify({ error: 'not configured' }), { 
    status: 500, headers: { 'Content-Type': 'application/json' }
  });
  // Return a bootstrap script that loads Places API with the key server-side
  const script = `(function(){
    const s=document.createElement('script');
    s.src='https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=initPlacesAutocomplete';
    s.async=true; s.defer=true;
    document.head.appendChild(s);
  })();`;
  return new Response(script, { 
    headers: { 
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
