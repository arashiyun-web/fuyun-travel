const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = process.env.STEP2_PGLITE_MODULE || '@electric-sql/pglite';
const { PGlite } = require(engine);
const migration = path.resolve('prisma/migrations/202611080002_charter_orders/migration.sql');
test('charter migration is repeatable against empty and preexisting tables and preserves rows', async () => {
  assert.equal(fs.existsSync(migration), true, 'canonical migration must exist');
  const sql = fs.readFileSync(migration, 'utf8');
  const db = new PGlite();
  try {
    await db.exec(sql);
    await db.exec(`INSERT INTO charter_orders (id,quote_id,line_uid,base_amount_twd,vehicle_label,route_label,quote_fingerprint) VALUES ('fixture','quote','mock',7000,'van','taipei-jiufen','fingerprint')`);
    await db.exec(sql);
    await db.exec(fs.readFileSync('prisma/pending/202611080002_charter_orders.sql', 'utf8'));
    const rows = await db.query('SELECT id, base_amount_twd, total_amount_twd, status FROM charter_orders');
    assert.deepEqual(rows.rows, [{ id: 'fixture', base_amount_twd: 7000, total_amount_twd: null, status: 'pending_confirmation' }]);
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='charter_orders' ORDER BY ordinal_position");
    assert.deepEqual(columns.rows.map((r) => r.column_name), ['id','quote_id','line_uid','base_amount_twd','total_amount_twd','vehicle_label','route_label','quote_fingerprint','review_json','status','created_at']);
    await assert.rejects(db.exec(`INSERT INTO charter_orders (id,quote_id,line_uid,base_amount_twd,vehicle_label,route_label,quote_fingerprint) VALUES ('duplicate','quote','mock',7000,'van','route','fingerprint')`), /duplicate key/);
    const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE tablename='charter_orders' ORDER BY indexname");
    assert.deepEqual(indexes.rows.map((r) => r.indexname), ['charter_orders_pkey','charter_orders_quote_id_key']);
  } finally { await db.close(); }
});
