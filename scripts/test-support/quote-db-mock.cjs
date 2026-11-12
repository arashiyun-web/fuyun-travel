// In-memory stand-in for the Prisma calls used by lib/quoteArchive.ts regenerate / legacy-restore (v11).
// $executeRaw interprets the conditional UPDATEs (guardedDraftWrite, v12 send) by their SQL text and
// parameters, with the same semantics as PostgreSQL (the real statements run in quotes-legacy-db-proof.cjs).
const { applyGuardedUpdate } = require('./route-prisma.cjs');

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
  const tx = {
    charterQuote, charterOrder,
    $queryRaw: async (strings, ...values) => {
      const text = strings.join('?');
      if (/to_regclass\('charter_orders'\)/.test(text)) return [{ present: db.ordersTable }];
      if (/FOR UPDATE/.test(text)) return get(values[0]) ? [{ id: values[0] }] : [];
      throw new Error(`unexpected $queryRaw: ${text}`);
    },
    // v12: one interpreter for every guarded UPDATE (route-prisma.cjs): each WHERE clause the code sends is
    // evaluated with PostgreSQL semantics, so dropping a clause from the code changes the outcome here.
    $executeRaw: async (query) => {
      db.sql.push(query.sql);
      return applyGuardedUpdate(query, {
        get: async (id) => get(id) || null,
        write: async (id, data) => { db.writes.push(id); Object.assign(get(id), clone(data)); },
        orderFor: (id) => db.orders.some((o) => o.quoteId === id),
      });
    },
  };
  const prisma = { ...tx, $transaction: async (fn) => fn(tx) };
  return { db, prisma, get, clone };
}

module.exports = { createQuoteDb, clone };
