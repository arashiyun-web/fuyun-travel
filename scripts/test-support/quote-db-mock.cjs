// In-memory stand-in for the Prisma calls used by lib/quoteArchive.ts regenerate / legacy-restore (v11).
// $executeRaw interprets the one conditional UPDATE in guardedDraftWrite by its SQL text and parameters,
// with the same semantics as PostgreSQL (the real statement is exercised in quotes-v10-db-proof.cjs).
const { isDeepStrictEqual } = require('node:util');

const clone = (v) => (v == null ? v : structuredClone(v));

function createQuoteDb() {
  const db = { rows: [], orders: [], writes: [], ordersTable: true, sql: [] };
  const matches = (row, where = {}) => {
    for (const [key, cond] of Object.entries(where || {})) {
      if (key === 'AND') { if (!cond.every((part) => matches(row, part))) return false; continue; }
      if (key === 'OR') { if (!cond.some((part) => matches(row, part))) return false; continue; }
      const value = row[key];
      if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
        if (cond.in && !cond.in.includes(value)) return false;
        if (cond.notIn && cond.notIn.includes(value)) return false;
      } else if (value !== cond) return false;
    }
    return true;
  };
  const get = (id) => db.rows.find((r) => r.id === id);
  const needTable = () => { if (!db.ordersTable) { const e = new Error('relation "charter_orders" does not exist'); throw e; } };
  const charterQuote = {
    findUnique: async ({ where }) => clone(get(where.id) || null),
    findMany: async ({ where, take } = {}) => clone(db.rows.filter((r) => matches(r, where)).slice(0, take || 100)),
    update: async ({ where, data }) => { db.writes.push(where.id); return clone(Object.assign(get(where.id), clone(data))); },
    updateMany: async ({ where, data }) => { const hit = db.rows.filter((r) => matches(r, where)); for (const r of hit) { db.writes.push(r.id); Object.assign(r, clone(data)); } return { count: hit.length }; },
  };
  const charterOrder = {
    findMany: async ({ where }) => { needTable(); return clone(db.orders.filter((o) => where.quoteId.in.includes(o.quoteId))); },
    findUnique: async ({ where }) => { needTable(); return clone(db.orders.find((o) => (where.quoteId ? o.quoteId === where.quoteId : o.id === where.id)) || null); },
    create: async ({ data }) => {
      needTable();
      if (db.orders.some((o) => o.quoteId === data.quoteId)) { const e = new Error('Unique constraint failed on quote_id'); e.code = 'P2002'; throw e; }
      const o = { id: `order-${db.orders.length + 1}`, status: 'pending_confirmation', totalAmountTwd: null, reviewJson: null, ...clone(data) };
      db.orders.push(o); return clone(o);
    },
    updateMany: async ({ where, data }) => { needTable(); const hit = db.orders.filter((o) => matches(o, where)); for (const o of hit) Object.assign(o, clone(data)); return { count: hit.length }; },
  };
  const UPDATE_SHAPE = [
    'UPDATE charter_quotes AS q', 'SET quote_draft_text = ', 'recommended_vehicle = ', 'quote_options = CAST(',
    'WHERE q.id = ', 'AND q.quote_status = ', 'AND q.quote_status NOT IN (', 'AND q.sent_at IS NULL',
    'AND q.quote_draft_text IS NOT DISTINCT FROM ', 'AND q.recommended_vehicle IS NOT DISTINCT FROM ', 'AND q.quote_options IS NOT DISTINCT FROM CAST(',
  ];
  const tx = {
    charterQuote, charterOrder,
    $queryRaw: async (strings, ...values) => {
      const text = strings.join('?');
      if (/to_regclass\('charter_orders'\)/.test(text)) return [{ present: db.ordersTable }];
      if (/FOR UPDATE/.test(text)) return get(values[0]) ? [{ id: values[0] }] : [];
      throw new Error(`unexpected $queryRaw: ${text}`);
    },
    $executeRaw: async (query) => {
      const text = query.sql;
      db.sql.push(text);
      let at = 0;
      for (const part of UPDATE_SHAPE) { const i = text.indexOf(part, at); if (i < 0) throw new Error(`guarded UPDATE lost "${part}"`); at = i + part.length; }
      const v = query.values;
      const [newText, newVehicle, newOptions, id, status] = v;
      const lockedCount = v.length - 8;
      const locked = v.slice(5, 5 + lockedCount);
      if (JSON.stringify(locked) !== JSON.stringify(['SENT', 'CONFIRMED', 'ARCHIVED', 'ORDER_PENDING', 'STAFF_PRICED'])) throw new Error(`guarded UPDATE locked statuses changed: ${JSON.stringify(locked)}`);
      const [expText, expVehicle, expOptions] = v.slice(5 + lockedCount);
      const noOrderClause = /NOT EXISTS \(SELECT 1 FROM charter_orders o WHERE o\.quote_id = q\.id\)/.test(text);
      const row = get(id);
      if (!row) return 0;
      const options = row.quoteOptions === undefined ? null : row.quoteOptions;
      const ok = row.quoteStatus === status && !locked.includes(row.quoteStatus) && row.sentAt == null &&
        (row.quoteDraftText ?? null) === expText && (row.recommendedVehicle ?? null) === expVehicle &&
        isDeepStrictEqual(options, expOptions == null ? null : JSON.parse(expOptions)) &&
        (!noOrderClause || !db.orders.some((o) => o.quoteId === id));
      if (!ok) return 0;
      db.writes.push(id);
      Object.assign(row, { quoteDraftText: newText, recommendedVehicle: newVehicle, quoteOptions: JSON.parse(newOptions) });
      return 1;
    },
  };
  const prisma = { ...tx, $transaction: async (fn) => fn(tx) };
  return { db, prisma, get, clone };
}

module.exports = { createQuoteDb, clone };
