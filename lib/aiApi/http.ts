import { aiApi } from '@/lib/aiApi/runtime';
import { AiApiError, errorResponse } from './errors';
import type { Operation } from './schema.mjs';
export async function servePublic(request: Request, operation: Operation) {
  try {
    const identity = await aiApi.authorize(request);
    let input: unknown;
    try { input = await request.json(); } catch { throw new AiApiError(400, 'Invalid JSON body', undefined, [{ path: ['body'], message: 'Expected a JSON object' }]); }
    return Response.json(await aiApi.execute(operation, input, identity, request.headers.get('Idempotency-Key')), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
