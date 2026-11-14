import { randomUUID } from 'node:crypto';
import { aiApi } from '@/lib/aiApi/runtime';
import { AiApiError, errorResponse } from './errors';
import { toolDetail, type CallContext } from './audit';
import type { Operation } from './schema.mjs';
export async function servePublic(request: Request, operation: Operation) {
  const started = Date.now(), requestId = randomUUID(), context: CallContext = {};
  let apiKeyId: string | undefined, input: unknown, result: unknown, failure: unknown, response: Response;
  try {
    const identity = await aiApi.authorize(request, operation);
    apiKeyId = identity.id;
    try { input = await request.json(); } catch { throw new AiApiError(400, 'Invalid JSON body', undefined, [{ path: ['body'], message: 'Expected a JSON object' }]); }
    result = await aiApi.execute(operation, input, identity, request.headers.get('Idempotency-Key'), context);
    response = Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { failure = error; response = errorResponse(error); }
  await aiApi.audit({ eventType: 'tool_call', channel: 'rest', tool: operation,
    apiKeyId: response.status === 401 ? undefined : (apiKeyId ?? (failure instanceof AiApiError ? failure.apiKeyId : undefined)), bookingId: context.bookingId,
    outcome: response.ok ? 'success' : 'error', httpStatus: response.status, durationMs: Date.now() - started, requestId,
    detail: toolDetail(operation, input, result, failure instanceof AiApiError ? failure.issues?.length : undefined),
  });
  return response;
}
