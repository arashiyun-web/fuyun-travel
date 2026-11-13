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
  const endpoints = { get_quote: 'quote', check_availability: 'availability', create_booking: 'bookings' };
  const descriptions = {
    get_quote: 'Indicative customerRange price only. Driver fee is separate. Staff confirm national holidays, taxes, vehicle and final fare.',
    check_availability: 'Always pending human confirmation. Does not query availability or reserve a vehicle.',
    create_booking: 'Creates a pending-review request only. No payment or confirmed sale. TEST- key names produce FY-TEST- numbers. Same API key and Idempotency-Key replay the same request for 24 hours; a new request may be created after expiry.',
  };
  for (const [name, endpoint] of Object.entries(endpoints)) {
    schemas[`${name}Input`] = jsonSchema(inputSchemas[name]);
    schemas[`${name}Result`] = jsonSchema(outputSchemas[name]);
    const responses = {};
    for (const [status, description] of Object.entries({ 200: 'Success; human confirmation required', 400: 'Invalid input; issues identify field paths', 401: 'Missing, invalid or disabled key', 429: 'Shared rate limit exceeded', 503: 'Service temporarily unavailable' })) {
      responses[status] = { description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${status === '200' ? `${name}Result` : 'Error'}` } } },
        ...(status === '429' ? { headers: { 'Retry-After': { description: 'Seconds until the exhausted shared window resets.', schema: { type: 'integer', minimum: 1 } } } } : {}) };
    }
    paths[`/api/public/v1/${endpoint}`] = { post: { operationId: name, description: descriptions[name],
      ...(name === 'create_booking' ? { parameters: [{ in: 'header', name: 'Idempotency-Key', required: false, description: 'Same API key and same header return the same request for 24 hours. Replays return HTTP 200 with replay=true.', schema: { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' } }] } : {}),
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}Input` } } } }, responses } };
  }
  return { openapi: '3.1.0', info: { title: 'Fuyun Travel AI API', version: '1.0.0', description: 'Owner-issued bearer key required. Shared limits per key: 30 requests/minute, 1,000/Taipei calendar day; 20 new booking requests/hour. No automatic confirmation or payment. Dates use Asia/Taipei.' },
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
