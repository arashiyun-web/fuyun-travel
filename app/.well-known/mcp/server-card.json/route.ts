// Supplemental discovery description; protocol negotiation happens at /api/mcp.
export function GET() {
  return Response.json({ name: 'fuyun-travel', version: '1.0.0',
    description: 'Fuyun Travel indicative charter quotes, pending availability and human-reviewed booking requests.',
    transport: { type: 'streamable-http', url: 'https://fuyuntravel.com/api/mcp', stateless: true },
    authentication: { type: 'http', scheme: 'bearer', description: 'Owner-issued API key required for every HTTP request.' },
    tools: ['get_quote', 'check_availability', 'create_booking'],
    openapi: 'https://fuyuntravel.com/openapi.json',
    requires_human_confirmation: true,
  });
}
