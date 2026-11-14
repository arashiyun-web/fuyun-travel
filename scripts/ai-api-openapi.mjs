import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { inputSchemas, outputSchemas, errorSchema } from '../lib/aiApi/schema.mjs';
const target = new URL('../public/openapi.json', import.meta.url);
function jsonSchema(schema) {
  const { $schema, ...value } = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
  return value;
}
export function buildOpenApi() {
  const paths = {};
  const schemas = { Error: jsonSchema(errorSchema) };
  const endpoints = { get_quote: 'quote', check_availability: 'availability', create_booking: 'bookings', get_booking_status: 'bookings/status' };
  const descriptions = {
    get_booking_status: 'Read-only status for bookings created by the same API key. Supply booking_number and exactly one of query_code or phone_last4. POST keeps verification out of URLs. 20 status queries/minute; only failures consume the 10/hour failure quota. All missing, foreign and incorrect verifications return the same 404. Status and review_status are identical: pending, confirmed_by_staff, rejected or cancelled; it never implies a sale or payment.',
    get_quote: 'Indicative customerRange price only. Driver fee is separate. Staff confirm national holidays, taxes, vehicle and final fare.',
    check_availability: 'Always pending human confirmation. Does not query availability or reserve a vehicle.',
    create_booking: 'Creates a pending-review request only. Creation and replay acknowledgements keep legacy status=pending_review; review_status carries the current public review state (pending for a new request). No payment or confirmed sale. TEST- key names produce FY-TEST- numbers. Same API key and Idempotency-Key replay the same request for 24 hours; a new request may be created after expiry. The query_code is shown only on the first response; a replay returns query_code=null. Preserve it securely or use booking_number plus phone_last4.',
  };
  for (const [name, endpoint] of Object.entries(endpoints)) {
    schemas[`${name}Input`] = jsonSchema(inputSchemas[name]);
    schemas[`${name}Result`] = jsonSchema(outputSchemas[name]);
    const responses = {};
    for (const [status, description] of Object.entries({ 200: 'Success; human confirmation required', 400: 'Invalid input; issues identify field paths', 401: 'Missing, invalid or disabled key', 429: 'Shared rate limit exceeded', 503: 'Service temporarily unavailable' })) {
      responses[status] = { description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${status === '200' ? `${name}Result` : 'Error'}` } } },
        ...(status === '429' ? { headers: { 'Retry-After': { description: 'Seconds until the exhausted shared window resets.', schema: { type: 'integer', minimum: 1 } } } } : {}) };
    }
    if (name === 'get_booking_status') responses['404'] = { description: 'No matching booking for the supplied booking number and verification', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
    paths[`/api/public/v1/${endpoint}`] = { post: { operationId: name, description: descriptions[name],
      ...(name === 'create_booking' ? { parameters: [{ in: 'header', name: 'Idempotency-Key', required: false, description: 'Same API key and same header return the same request for 24 hours. Replays return HTTP 200 with replay=true.', schema: { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' } }] } : {}),
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}Input` } } } }, responses } };
  }
  return { openapi: '3.1.0', info: { title: 'Fuyun Travel AI API', version: '1.0.0', description: 'Owner-issued bearer key required. Shared limits per key: 30 requests/minute, 1,000/Taipei calendar day; 20 new booking requests/hour. Status queries: 20/minute and 10 failed verifications/hour. No automatic confirmation or payment. Dates use Asia/Taipei.' },
    servers: [{ url: 'https://fuyuntravel.com' }], security: [{ bearerAuth: [] }], paths,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'fyk_ + 32 random bytes encoded as base64url', description: 'Obtain a key from the owner. Keys are never pre-provisioned.' } }, schemas } };
}
const serialized = () => JSON.stringify(buildOpenApi(), null, 2) + '\n';
export function checkOpenApi(contents) { return contents === serialized(); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check')) {
    let contents = ''; try { contents = readFileSync(target, 'utf8'); } catch {}
    if (!checkOpenApi(contents)) { console.error('OpenAPI drift: run npm run openapi:generate'); process.exitCode = 1; }
    else console.log('OpenAPI matches shared Zod schemas');
  } else { writeFileSync(target, serialized()); console.log('Generated public/openapi.json'); }
}
