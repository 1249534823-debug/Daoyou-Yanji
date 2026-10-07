/** Run once after stopping/draining the old app and applying migration 0035.
 * Dry-run by default. --write requires MARKET_WRITES_DRAINED=1.
 * Imports existing current-cycle markers; cannot recover markers already lost.
 */
import assert from 'node:assert/strict';
const write = process.argv.includes('--write');
if (write)
  assert.equal(
    process.env.MARKET_WRITES_DRAINED,
    '1',
    'Stop/drain all market writers first',
  );
const { redis } = await import('../src/server/lib/redis');
const { db } = await import('../src/server/lib/drizzle/db');
const { marketPurchaseReceipts } =
  await import('../src/server/lib/drizzle/schema');
const { getCurrentCycle } = await import('../src/shared/lib/game/marketConfig');
let cursor = '0';
let scanned = 0,
  activeSets = 0,
  receipts = 0,
  inserted = 0;
const cycles = Object.fromEntries(
  ['common', 'treasure', 'heaven', 'black'].map((layer) => [
    layer,
    getCurrentCycle(layer as 'common'),
  ]),
);
do {
  const page = await redis.scan(
    cursor,
    'MATCH',
    'market:v2:bought:*',
    'COUNT',
    100,
  );
  cursor = page[0];
  for (const key of page[1]) {
    if (++scanned > 100000)
      throw new Error(
        'Import safety bound reached; do not reopen writes until reviewed',
      );
    const match =
      /^market:v2:bought:([0-9a-f-]{36}):(.+):(common|treasure|heaven|black):(\d+)$/.exec(
        key,
      );
    if (!match)
      throw new Error('Unexpected market purchase key; import stopped');
    const [, userId, nodeId, layer, rawCycle] = match;
    const cycle = Number(rawCycle);
    if (cycle !== cycles[layer]) continue;
    const listingIds = await redis.smembers(key);
    if (listingIds.length > 1000)
      throw new Error('Unexpected purchase set size; import stopped');
    activeSets++;
    receipts += listingIds.length;
    if (write && listingIds.length) {
      const rows = await db
        .insert(marketPurchaseReceipts)
        .values(
          listingIds.map((listingId) => ({
            userId,
            nodeId,
            layer,
            cycle,
            listingId,
            legacy: true,
          })),
        )
        .onConflictDoNothing()
        .returning({ listingId: marketPurchaseReceipts.listingId });
      inserted += rows.length;
    }
  }
} while (cursor !== '0');
console.log(
  JSON.stringify({
    success: true,
    write,
    scanned,
    activeSets,
    receipts,
    inserted,
  }),
);
process.exit(0);
