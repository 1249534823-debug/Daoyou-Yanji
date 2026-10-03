import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import type { DbClient, DbExecutor } from '@server/lib/drizzle/db';
import { readCultivatorRealm } from './application/readers/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from './application/readers/CultivatorProfileRepository';

/** Public character facts for application use cases outside this feature. */
@Injectable()
export class CultivatorQueriesService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  realm(cultivatorId: string, executor: DbExecutor = this.database) {
    return readCultivatorRealm(cultivatorId, executor);
  }

  async preHeavenFates(
    userId: string,
    cultivatorId: string,
    executor: DbExecutor = this.database,
  ) {
    return (
      (await getPlayerPreHeavenFates(userId, cultivatorId, executor)) ?? []
    );
  }
}
