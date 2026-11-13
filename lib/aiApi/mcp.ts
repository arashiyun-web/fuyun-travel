import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { requestOrigin } from '@/lib/adminAuth';
import { aiApi } from '@/lib/aiApi/runtime';
import { inputSchemas, type Operation } from './schema.mjs';
import { AiApiError, errorResponse } from './errors';

const descriptions: Record<Operation, string> = {
  get_quote: 'Get an indicative charter price range. Vehicle and final price require human confirmation.',
  check_availability: 'Request vehicle availability confirmation from staff. Does not reserve a vehicle.',
  create_booking: 'Create a pending-review request. This does not confirm a booking or issue a formal quote. Use the HTTP Idempotency-Key header for safe replay within 24 hours.',
};
export async function serveMcp(request: Request) {
  try {
    // Authorization and shared limits apply to every HTTP request, including discovery and unsupported verbs.
    const identity = await aiApi.authorize(request);
    if (request.headers.has('Origin') && request.headers.get('Origin') !== requestOrigin(request)) {
      throw new AiApiError(403, 'Origin is not allowed');
    }
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
    let body: unknown;
    try { body = await request.json(); } catch { throw new AiApiError(400, 'Invalid JSON body'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AiApiError(400, 'Expected one JSON-RPC request');
    const rpc = body as { jsonrpc?: string; method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown };
    if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') throw new AiApiError(400, 'Invalid JSON-RPC request');
    // The SDK reports schema failures inside a 200 tool error. Public contract requires HTTP 400 with issue paths.
    if (rpc.method === 'tools/call' && rpc.params?.name && Object.hasOwn(inputSchemas, rpc.params.name)) {
      if (rpc.id === undefined) throw new AiApiError(400, 'Tool calls require a JSON-RPC id');
      aiApi.validate(rpc.params.name as Operation, rpc.params.arguments);
    }
    const server = new McpServer({ name: 'fuyun-travel', version: '1.0.0' });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    let toolError: unknown;
    for (const name of Object.keys(inputSchemas) as Operation[]) {
      server.registerTool(name, { description: descriptions[name], inputSchema: inputSchemas[name],
        annotations: { readOnlyHint: name !== 'create_booking', destructiveHint: false, openWorldHint: false } }, async (input) => {
        try {
          const result = await aiApi.execute(name, input, identity, request.headers.get('Idempotency-Key'));
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        } catch (error) {
          toolError = error;
          return { isError: true, content: [{ type: 'text' as const, text: 'Request could not be completed' }] };
        }
      });
    }
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody: body });
      if (toolError) return errorResponse(toolError);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } finally { await server.close(); }
  } catch (error) { return errorResponse(error); }
}
