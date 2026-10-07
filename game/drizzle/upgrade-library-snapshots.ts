/** Run after SQL 0067 and before any application writer starts.
 * Default is a read-only dry-run. --apply requires --database matching the target.
 * --catalog-file validates a read-only JSON export without connecting to a DB.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { RewardItemSchema } from '@shared/contracts/adminRewards';
import { isRetiredDrawItem } from '@shared/lib/retiredDraw';
import { legacyLibraryInventoryGrant } from '@server/lib/services/LegacyLibraryInventoryGrant';

const LibraryRowSchema = z.object({
  item_id: z.string().min(1),
  type: z.enum(['material', 'consumable', 'artifact']),
  payload: z.unknown(),
  created_at: z.union([z.string(), z.date()]),
});
type LibraryRow = z.infer<typeof LibraryRowSchema>;
const ShelfSchema = z.object({
  id: z.string().uuid(),
  item_library_item_id: z.string().min(1),
  quantity: z.number().int().positive(),
  status: z.enum(['active', 'archived']),
}).passthrough();
const RECEIPT = 'custom-v0415:library-snapshots';
const RETIRED_REASON = '作者 V6 已退役旧功法/神通抽取入口；原道具、配置及购买历史保留，专属符箓暂不转换、不补偿。';
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
function convert(row: LibraryRow, quantity = 1) {
  return RewardItemSchema.parse(legacyLibraryInventoryGrant({
    itemId: row.item_id, type: row.type, payload: row.payload, createdAt: row.created_at,
  }, quantity));
}
function catalogReport(rows: LibraryRow[]) {
  const counts: Record<string, number> = {};
  const retired: string[] = [];
  const errors: Array<{ itemId: string; error: string }> = [];
  let specialEffect = 0;
  for (const row of rows) {
    if (isRetiredDrawItem(row.payload)) { retired.push(row.item_id); continue; }
    try {
      const grant = convert(row);
      counts[grant.definitionId] = (counts[grant.definitionId] ?? 0) + 1;
      if (grant.definitionId === 'consumable.v1' && grant.instanceData &&
        'spec' in grant.instanceData && 'specialEffect' in grant.instanceData.spec &&
        grant.instanceData.spec.specialEffect === 'restore_qi_to_max') specialEffect++;
    } catch (error) {
      errors.push({ itemId: row.item_id, error: String(error).slice(0, 600) });
    }
  }
  return { scanned: rows.length, counts, specialEffect, retired, errors };
}

async function main() {
  const catalogFile = option('--catalog-file');
  if (catalogFile) {
    if (apply) throw new Error('--catalog-file never permits --apply');
    const report = catalogReport(z.array(LibraryRowSchema).parse(JSON.parse(readFileSync(catalogFile, 'utf8'))));
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) process.exitCode = 1;
    return;
  }
  const expectedDatabase = option('--database');
  if (!expectedDatabase || !process.env.DATABASE_URL)
    throw new Error('Set DATABASE_URL explicitly and pass --database EXPECTED_NAME');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    const target = await client.query<{ name: string }>('SELECT current_database() AS name');
    if (target.rows[0]?.name !== expectedDatabase) throw new Error('Database identity mismatch');
    if (apply) {
      await client.query('SELECT pg_advisory_xact_lock(74612015)');
      await client.query('LOCK TABLE wanjiedaoyou_reputation_shop_items, wanjiedaoyou_sect_shop_items IN SHARE ROW EXCLUSIVE MODE');
    }
    const completed = await client.query<{ value: string }>('SELECT value FROM wanjiedaoyou_app_settings WHERE key=$1', [RECEIPT]);
    if (completed.rows.length) {
      console.log(JSON.stringify({ state: 'already-completed', receipt: JSON.parse(completed.rows[0].value) }, null, 2));
      await client.query('ROLLBACK');
      return;
    }
    const libraryQuery = await client.query('SELECT item_id, type, payload, created_at FROM wanjiedaoyou_item_library WHERE type IN (\'material\',\'consumable\',\'artifact\')');
    const library = z.array(LibraryRowSchema).parse(libraryQuery.rows);
    const byId = new Map(library.map((row) => [row.item_id, row]));
    const restored: Array<{ table: string; shopId: string; itemId: string; definitionId: string }> = [];
    const retired: Array<{ table: string; shopId: string; itemId: string; scenario: string; reason: string }> = [];
    const archivedWithoutSnapshot: Array<{ table: string; shopId: string; reason: string }> = [];
    const plans: Array<{ table: string; id: string; snapshot: unknown; status: string; original: unknown }> = [];
    const source: unknown[] = [];
    for (const [table, key] of [
      ['wanjiedaoyou_reputation_shop_items', 'custom-v0415:before:reputation-shop'],
      ['wanjiedaoyou_sect_shop_items', 'custom-v0415:before:sect-shop'],
    ] as const) {
      const archive = await client.query<{ value: string }>('SELECT value FROM wanjiedaoyou_app_settings WHERE key=$1', [key]);
      if (archive.rows.length !== 1) throw new Error(`Missing SQL migration archive ${key}`);
      const shelves = z.array(ShelfSchema).parse(JSON.parse(archive.rows[0].value));
      source.push({ table, shelves });
      for (const shelf of shelves) {
        const row = byId.get(shelf.item_library_item_id);
        if (!row) throw new Error(`Missing original library item ${shelf.item_library_item_id}`);
        if (isRetiredDrawItem(row.payload)) {
          const scenario = z.object({ spec: z.object({ scenario: z.enum(['draw_gongfa', 'draw_skill']) }) }).parse(row.payload).spec.scenario;
          retired.push({ table, shopId: shelf.id, itemId: row.item_id, scenario, reason: RETIRED_REASON });
          plans.push({ table, id: shelf.id, snapshot: null, status: 'archived', original: shelf });
          continue;
        }
        try {
          const { definitionId, instanceData } = convert(row, shelf.quantity);
          const snapshot = { definitionId, instanceData };
          plans.push({ table, id: shelf.id, snapshot, status: shelf.status, original: shelf });
          restored.push({ table, shopId: shelf.id, itemId: row.item_id, definitionId: snapshot.definitionId });
        } catch (error) {
          if (shelf.status === 'active') throw new Error(`Active SKU ${shelf.id} cannot migrate: ${String(error).slice(0, 600)}`, { cause: error });
          archivedWithoutSnapshot.push({ table, shopId: shelf.id, reason: String(error).slice(0, 600) });
        }
      }
    }
    const report = {
      version: 1, sourceSha256: createHash('sha256').update(JSON.stringify(source)).digest('hex'),
      restored, retired, archivedWithoutSnapshot,
    };
    if (apply) {
      for (const plan of plans) {
        // Table names are the literal allowlist above. All values are bound.
        const result = await client.query(`UPDATE ${plan.table} s SET item_snapshot=$1::jsonb, status=$2
          WHERE id=$3 AND (to_jsonb(s)-'item_snapshot'-'status')=($4::jsonb-'item_snapshot'-'status')`,
          [JSON.stringify(plan.snapshot), plan.status, plan.id, JSON.stringify(plan.original)]);
        if (result.rowCount !== 1) throw new Error(`Shelf changed since migration archive: ${plan.id}`);
      }
      await client.query('INSERT INTO wanjiedaoyou_app_settings (key,value) VALUES ($1,$2)', [RECEIPT, JSON.stringify(report)]);
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
    console.log(JSON.stringify({ state: apply ? 'applied' : 'dry-run', ...report }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
main().catch((error) => { console.error(String(error)); process.exitCode = 1; });
