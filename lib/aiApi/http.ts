import { aiApi } from '@/lib/aiApi/runtime';
import { AiApiError, errorResponse } from './errors';
import type { Operation } from './schema.mjs';
import type { Identity } from './store';
export async function servePublic(request: Request, operation: Operation) {
  const started = Date.now(); let identity: Identity | undefined; let input: unknown; let executing = false;
  try {
    identity = await aiApi.authorize(request);
    try { input = await request.json(); } catch { throw new AiApiError(400, 'Invalid JSON body', undefined, [{ path: ['body'], message: 'Expected a JSON object' }]); }
    executing = true;
    return Response.json(await aiApi.execute(operation, input, identity, request.headers.get('Idempotency-Key')), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!executing) await aiApi.observe(operation, input, identity, started, error).catch(() => {});
    return errorResponse(error);
  }
}
