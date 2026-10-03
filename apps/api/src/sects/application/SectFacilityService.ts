import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';

export async function getSectFacilityBonuses(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  const { sectOrganizationFacade } = await import(
    '@server/sects/organization/productionSectOrganization.js'
  );
  return sectOrganizationFacade.getFacilityBonuses(cultivatorId, q);
}
