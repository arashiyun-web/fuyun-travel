// v12 test support: the admin quote write routes (send, fleet draft, PATCH, regenerate, legacy-restore) run in
// a transaction: to_regclass + SELECT … FOR UPDATE, then a conditional `UPDATE charter_quotes AS q … WHERE …`.
// routeTx() turns a plain in-memory Prisma double ({ charterQuote: { findUnique, update } }, optionally
// charterOrder) into one that also answers those calls, with PostgreSQL semantics for the UPDATE:
// every WHERE clause the code sends is evaluated against the row; a clause the code no longer sends is not.
// No orders exist unless the double has charterOrder (or `orders` is given).
const { isDeepStrictEqual } = require('node:util');

const COLUMNS = { quote_draft_text: 'quoteDraftText', recommended_vehicle: 'recommendedVehicle', quote_options: 'quoteOptions', quote_status: 'quoteStatus', sent_at: 'sentAt' };
const column = (name) => { const key = COLUMNS[name]; if (!key) throw new Error(`route-prisma: unknown column ${name}`); return key; };
const norm = (v) => (v === undefined ? null : v);
const asJson = (v) => (v == null ? null : JSON.parse(v));
const sameValue = (a, b) => isDeepStrictEqual(norm(a), norm(b));

/** Parses and applies one guarded UPDATE. `get(id)` returns the row (or null); `orderFor(id)` is truthy when an order exists. */
async function applyGuardedUpdate(query, { get, write, orderFor }) {
  const text = query.sql.replace(/\s+/g, ' ').trim();
  const values = query.values.slice();
  const m = text.match(/^UPDATE charter_quotes AS q SET (.+?) WHERE (.+)$/);
  if (!m) throw new Error(`route-prisma: unexpected $executeRaw: ${text}`);
  const take = () => { if (!values.length) throw new Error('route-prisma: placeholder/value mismatch'); return values.shift(); };
  const data = {};
  for (const part of m[1].split(/, (?=[a-z_]+ = )/)) {
    let a;
    if ((a = part.match(/^([a-z_]+) = CAST\(\? AS jsonb\)$/))) data[column(a[1])] = asJson(take());
    else if ((a = part.match(/^([a-z_]+) = CAST\(\? AS timestamptz\) AT TIME ZONE 'UTC'$/))) data[column(a[1])] = new Date(take());
    else if ((a = part.match(/^([a-z_]+) = '([A-Z_]+)'$/))) data[column(a[1])] = a[2];
    else if ((a = part.match(/^([a-z_]+) = \?$/))) data[column(a[1])] = take();
    else throw new Error(`route-prisma: unexpected SET part: ${part}`);
  }
  const checks = [];
  let id;
  for (const clause of m[2].split(/ AND (?![^(]*\))/)) {
    let a;
    if (clause === 'q.id = ?') id = take();
    else if ((a = clause.match(/^q\.([a-z_]+) = \?$/))) { const k = column(a[1]); const v = take(); checks.push((row) => norm(row[k]) === norm(v)); }
    else if ((a = clause.match(/^q\.([a-z_]+) NOT IN \(([?, ]+)\)$/))) { const k = column(a[1]); const list = a[2].split(',').map(() => take()); checks.push((row) => !list.includes(row[k])); }
    else if ((a = clause.match(/^q\.([a-z_]+) IS NULL$/))) { const k = column(a[1]); checks.push((row) => row[k] == null); }
    else if ((a = clause.match(/^q\.([a-z_]+) IS NOT DISTINCT FROM CAST\(\? AS jsonb\)$/))) { const k = column(a[1]); const v = asJson(take()); checks.push((row) => sameValue(row[k], v)); }
    else if ((a = clause.match(/^q\.([a-z_]+) IS NOT DISTINCT FROM \?$/))) { const k = column(a[1]); const v = take(); checks.push((row) => sameValue(row[k], v)); }
    else if (clause === 'NOT EXISTS (SELECT 1 FROM charter_orders o WHERE o.quote_id = q.id)') checks.push((row) => !orderFor(row.id));
    else throw new Error(`route-prisma: unexpected WHERE clause: ${clause}`);
  }
  if (values.length) throw new Error('route-prisma: unused values');
  const row = await get(id);
  if (!row || !checks.every((check) => check(row))) return 0;
  await write(id, data);
  return 1;
}

function routeTx(base, options = {}) {
  const orders = options.orders || null;
  const charterOrder = {
    findUnique: async ({ where }) => (orders ? orders.find((o) => o.quoteId === where.quoteId) || null : null),
    findMany: async ({ where }) => (orders ? orders.filter((o) => where.quoteId.in.includes(o.quoteId)) : []),
    ...(base.charterOrder || {}),
  };
  const orderFor = async (id) => Boolean(await charterOrder.findUnique({ where: { quoteId: id }, select: { id: true } }));
  const self = {
    ...base,
    charterOrder,
    $queryRaw: async (strings, ...values) => {
      const text = Array.isArray(strings) ? strings.join('?') : strings.sql;
      if (/to_regclass\('charter_orders'\)/.test(text)) return [{ present: true }];
      if (/FOR UPDATE/.test(text)) return (await base.charterQuote.findUnique({ where: { id: values[0] } })) ? [{ id: values[0] }] : [];
      throw new Error(`route-prisma: unexpected $queryRaw: ${text}`);
    },
    $executeRaw: async (query) => {
      const known = new Map();
      // Order presence is read before evaluating (the double has no concurrency inside one call).
      const text = query.sql;
      const idIndex = (text.slice(0, text.indexOf('WHERE q.id = ?')).match(/\?/g) || []).length;
      known.set(query.values[idIndex], await orderFor(query.values[idIndex]));
      return applyGuardedUpdate(query, {
        get: (id) => base.charterQuote.findUnique({ where: { id } }),
        write: (id, data) => base.charterQuote.update({ where: { id }, data }),
        orderFor: (id) => known.get(id),
      });
    },
  };
  self.$transaction = async (fn) => fn(self);
  return self;
}

module.exports = { routeTx, applyGuardedUpdate };
