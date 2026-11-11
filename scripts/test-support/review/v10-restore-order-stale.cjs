// Read-only on the local test DB: order fingerprint of a regenerated row (A2, still regenerated) vs the same
// data after legacy-restore on an ORDER_PENDING copy (S_ORDER_PENDING). Shows restore stales the order.
const path = require('path'); const root = process.argv[2]; process.chdir(root);
const loader = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client')); const db = new PrismaClient();
loader.mock('@/lib/prisma', { prisma: db });
const { quoteFingerprint, orderView } = loader.load('lib/charterOrder.ts');
(async () => {
  const a2 = await db.charterQuote.findUnique({ where: { id: 'A2_untouched_gm_shape' } });
  const s = await db.charterQuote.findUnique({ where: { id: 'S_ORDER_PENDING' } });
  const order = await db.charterOrder.findUnique({ where: { quoteId: 'S_ORDER_PENDING' } });
  console.log(JSON.stringify({ fingerprintBeforeRestore_sameDataAsA2: quoteFingerprint(a2), fingerprintAfterRestore: quoteFingerprint(s), changed: quoteFingerprint(a2) !== quoteFingerprint(s), restoredTextHead: s.quoteDraftText.split('\n')[0], status: s.quoteStatus, orderExists: Boolean(order) }, null, 2));
  await db.$disconnect();
})();
