import { db } from '@server/lib/drizzle/db';
import { itemLibrary } from '@server/lib/drizzle/schema';
import { generateMaterialLibraryEntries } from '@server/lib/services/MaterialLibraryService';
import { QUALITY_VALUES, MATERIAL_TYPE_VALUES } from '@shared/types/constants';
import { and, eq, count } from 'drizzle-orm';

const actor = process.env.ADMIN_USER_IDS?.split(',')[0];
if (!actor) throw new Error('Administrator not configured');
let added = 0;
for (const quality of QUALITY_VALUES) {
  for (const materialType of MATERIAL_TYPE_VALUES) {
    const [row] = await db.select({ n: count() }).from(itemLibrary).where(and(
      eq(itemLibrary.type, 'material'), eq(itemLibrary.status, 'published'),
      eq(itemLibrary.category, materialType), eq(itemLibrary.quality, quality),
    ));
    const missing = Math.max(0, 5 - Number(row.n));
    if (!missing) continue;
    const items = await generateMaterialLibraryEntries({
      request: { count: missing, materialType, quality, status: 'published',
        seed: 'yanji-stage-coverage-v1' },
      userId: actor, ignoreItemIdConflicts: true,
    });
    added += items.length;
    console.log(JSON.stringify({ quality, materialType, added: items.length }));
  }
}
console.log(JSON.stringify({ complete: true, added }));
process.exit(0);
