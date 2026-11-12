// v13 test double for the LINE Messaging API push endpoint, on 127.0.0.1 only. Implements X-Line-Retry-Key the
// way https://developers.line.biz/en/docs/messaging-api/retrying-api-request/ describes it:
// - the first accepted request with a key is delivered (200, x-line-request-id);
// - another request with the same key within 24 h is NOT delivered: 409, x-line-accepted-request-id = the id of
//   the accepted request, body { message: "The retry key is already accepted", sentMessages };
// - after 24 h the key is forgotten (fake clock, `advance`);
// - requests without a key are always delivered.
// `state.refuseNext = true` makes the next call fail with connection refused (nothing reaches LINE).
// `deliveries` counts what the customer would actually see. `plan(req)` can change one answer: { status,
// deliver, delayMs, destroy, noAcceptedHeader }. `install()` routes https://api.line.me to this server and
// refuses every other fetch (recorded in `violations`).
const http = require('node:http');
const crypto = require('node:crypto');
const DAY = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createFakeLine() {
  const state = { requests: [], deliveries: [], keys: new Map(), violations: [], offsetMs: 0, plans: [], onDeliver: null };
  const now = () => Date.now() + state.offsetMs;
  const rid = () => crypto.randomUUID();
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', async () => {
      const key = req.headers['x-line-retry-key'] || null;
      let body = null; try { body = JSON.parse(raw); } catch {}
      const entry = { at: now(), path: req.url, key, auth: req.headers.authorization || null, to: body && body.to, text: body && body.messages && body.messages[0] && body.messages[0].text, answer: null };
      state.requests.push(entry);
      const plan = state.plans.length ? state.plans.shift() : {};
      const send = (status, headers, payload) => { entry.answer = status; if (res.destroyed) return; res.writeHead(status, { 'content-type': 'application/json', 'x-line-request-id': rid(), ...headers }); res.end(JSON.stringify(payload)); };
      try {
        if (req.url !== '/v2/bot/message/push') return send(404, {}, { message: 'Not found' });
        if (key && !UUID.test(key)) return send(400, {}, { message: 'The value for the X-Line-Retry-Key header is invalid' });
        if (plan.destroy) { entry.answer = 'reset'; req.socket.destroy(); return; }
        if (plan.status && !plan.deliver) {
          return send(plan.status, {}, { message: `planned ${plan.status}` });
        }
        if (key) {
          const known = state.keys.get(key);
          if (known && now() - known.at < DAY) {
            if (plan.noAcceptedHeader) return send(409, {}, { message: 'Conflict' });
            return send(409, { 'x-line-accepted-request-id': known.requestId }, { message: 'The retry key is already accepted', sentMessages: known.sentMessages });
          }
        }
        const requestId = rid();
        const sentMessages = [{ id: String(Math.floor(Math.random() * 1e15)), quoteToken: crypto.randomBytes(8).toString('hex') }];
        state.deliveries.push({ at: now(), to: entry.to, text: entry.text, key });
        if (key) state.keys.set(key, { at: now(), requestId, sentMessages });
        if (state.onDeliver) await state.onDeliver(entry);
        if (plan.delayMs) await new Promise((r) => setTimeout(r, plan.delayMs));
        if (plan.status) return send(plan.status, {}, { message: `planned ${plan.status} after delivery` });
        entry.answer = 200;
        if (res.destroyed) return;
        res.writeHead(200, { 'content-type': 'application/json', 'x-line-request-id': requestId });
        res.end(JSON.stringify({ sentMessages }));
      } catch (error) { send(500, {}, { message: String(error) }); }
    });
  });
  const api = {
    state,
    get deliveries() { return state.deliveries; },
    get requests() { return state.requests; },
    plan(p) { state.plans.push(p); },
    advance(ms) { state.offsetMs += ms; },
    reset() { state.requests.length = 0; state.deliveries.length = 0; state.plans.length = 0; state.onDeliver = null; },
    forgetKeys() { state.keys.clear(); },
    async start() { await new Promise((r) => server.listen(0, '127.0.0.1', r)); api.port = server.address().port; return api; },
    async stop() { server.closeAllConnections && server.closeAllConnections(); await new Promise((r) => server.close(r)); },
    install(target = globalThis) {
      const realFetch = target.fetch;
      target.fetch = (input, init) => {
        const url = String(input && input.url ? input.url : input);
        if (url.startsWith('https://api.line.me/') && state.refuseNext) { state.refuseNext = false; state.requests.push({ at: now(), refused: true }); return realFetch('http://127.0.0.1:9/v2/bot/message/push', init); }
        if (url.startsWith('https://api.line.me/')) return realFetch(`http://127.0.0.1:${api.port}/${url.slice('https://api.line.me/'.length)}`, init);
        state.violations.push(url);
        return Promise.reject(new Error(`fake-line: fetch to ${url} refused`));
      };
      return () => { target.fetch = realFetch; };
    },
  };
  return api;
}
module.exports = { createFakeLine, UUID };
