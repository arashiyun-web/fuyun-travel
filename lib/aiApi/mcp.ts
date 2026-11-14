import { randomUUID } from 'node:crypto';
import { toolDetail, type CallContext } from './audit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { requestOrigin } from '@/lib/adminAuth';
import { aiApi } from '@/lib/aiApi/runtime';
import { inputSchemas, type Operation } from './schema.mjs';
import { AiApiError, errorResponse } from './errors';

const descriptions: Record<Operation, string> = {
  get_booking_status: 'Look up a request created by this API key using its query code or phone last four digits. Read-only; staff alone confirm bookings.',
  get_quote: 'Get an indicative charter price range. Vehicle and final price require human confirmation.',
  check_availability: 'Request vehicle availability confirmation from staff. Does not reserve a vehicle.',
  create_booking: 'Create a pending-review request. This does not confirm a booking or issue a formal quote. Use the HTTP Idempotency-Key header for safe replay within 24 hours.',
};
export async function serveMcp(request: Request) {
  const started = Date.now(), requestId = randomUUID(), context: CallContext = {};
  // Retain only a local parsed body so even unauthenticated tools/call attempts can be audited.
  const body: unknown = await request.clone().json().catch(() => null);
  const rpc = body && typeof body === 'object' && !Array.isArray(body)
    ? body as { jsonrpc?: string; method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown } : null;
  const operation = typeof rpc?.params?.name === 'string' && Object.hasOwn(inputSchemas, rpc.params.name) ? rpc.params.name as Operation : undefined;
  let apiKeyId: string | undefined, result: unknown, failure: unknown, httpStatus = 503;
  try {
    // Authorization and shared limits apply to every HTTP request, including discovery and unsupported verbs.
    const identity = await aiApi.authorize(request, rpc?.method === 'tools/call' ? operation : undefined);
    apiKeyId = identity.id;
    if (request.headers.has('Origin') && request.headers.get('Origin') !== requestOrigin(request)) {
      throw new AiApiError(403, 'Origin is not allowed');
    }
    if (request.method !== 'POST') {
      httpStatus = 405;
      return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
    }
    if (!rpc) throw new AiApiError(400, 'Expected one JSON-RPC request');
    if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') throw new AiApiError(400, 'Invalid JSON-RPC request');
    // The SDK reports schema failures inside a 200 tool error. Public contract requires HTTP 400 with issue paths.
    if (rpc.method === 'tools/call') {
      if (!operation) throw new AiApiError(400, 'Unknown tool');
      if (rpc.id === undefined) throw new AiApiError(400, 'Tool calls require a JSON-RPC id');
      aiApi.validate(operation, rpc.params?.arguments);
    }
    const server = new McpServer({ name: 'fuyun-travel', version: '1.0.0' });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    let toolError: unknown;
    for (const name of Object.keys(inputSchemas) as Operation[]) {
      server.registerTool(name, { description: descriptions[name], inputSchema: inputSchemas[name],
        annotations: { readOnlyHint: name !== 'create_booking', destructiveHint: false, openWorldHint: false } }, async (input) => {
        try {
          result = await aiApi.execute(name, input, identity, request.headers.get('Idempotency-Key'), context);
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
      if (toolError) { failure = toolError; const response = errorResponse(toolError); httpStatus = response.status; return response; }
      httpStatus = response.status;
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } finally { await server.close(); }
  } catch (error) { failure = error; const response = errorResponse(error); httpStatus = response.status; return response; }
  finally {
    if (!rpc || rpc.method === 'tools/call') await aiApi.audit({
      eventType: 'tool_call', channel: 'mcp', tool: operation,
      apiKeyId: httpStatus === 401 ? undefined : (apiKeyId ?? (failure instanceof AiApiError ? failure.apiKeyId : undefined)), bookingId: context.bookingId,
      outcome: httpStatus < 400 ? 'success' : 'error', httpStatus, durationMs: Date.now() - started, requestId,
      detail: toolDetail(operation, rpc?.params?.arguments, result, failure instanceof AiApiError ? failure.issues?.length : undefined),
    });
  }
}
