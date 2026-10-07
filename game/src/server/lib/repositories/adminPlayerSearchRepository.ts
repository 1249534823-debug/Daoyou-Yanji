import { db } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import type { AdminPlayerSearchItem } from '@shared/contracts/adminPlayers';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

export async function searchAdminPlayers(
  query: string,
): Promise<AdminPlayerSearchItem[]> {
  const escapedQuery = query.replace(/[\\%_]/g, '\\$&');
  return db
    .select({
      id: cultivators.id,
      name: cultivators.name,
      realm: cultivators.realm,
      stage: cultivators.realm_stage,
    })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.status, 'active'),
        or(
          ilike(cultivators.name, '%' + escapedQuery + '%'),
          sql`${cultivators.id}::text = ${query}`,
          sql`${cultivators.userId}::text = ${query}`,
        ),
      ),
    )
    .orderBy(desc(cultivators.updatedAt))
    .limit(20);
}
