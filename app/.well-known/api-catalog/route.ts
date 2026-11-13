const origin = 'https://fuyuntravel.com';
const catalog = { linkset: ['quote', 'availability', 'bookings'].map(name => ({
  anchor: `${origin}/api/public/v1/${name}`,
  'service-desc': [{ href: `${origin}/openapi.json`, type: 'application/vnd.oai.openapi+json;version=3.1' }],
  'service-meta': [{ href: `${origin}/.well-known/mcp/server-card.json`, type: 'application/json' }],
})) };
const headers = {
  'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
  Link: '<https://fuyuntravel.com/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
};
export function GET() { return Response.json(catalog, { headers }); }
export function HEAD() { return new Response(null, { headers }); }
