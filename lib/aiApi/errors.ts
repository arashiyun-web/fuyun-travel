export class AiApiError extends Error {
  subject?: string;
  constructor(public status: number, message: string, public retryAfter?: number,
    public issues?: Array<{ path: PropertyKey[]; message: string }>) { super(message); }
}
export function errorResponse(error: unknown): Response {
  const safe = error instanceof AiApiError ? error : new AiApiError(503, 'Service temporarily unavailable');
  return Response.json({ error: safe.message, ...(safe.issues ? { issues: safe.issues } : {}) }, {
    status: safe.status, headers: { 'Cache-Control': 'no-store', ...(safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {}), ...(safe.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) },
  });
}
