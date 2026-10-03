import type { SectPathSelectionRequest } from '@daoyou/shared/contracts/combatV6';
import type { SectV6ActionSchema } from '@daoyou/shared/contracts/combatV6Sect';
import { Inject, Injectable } from '@nestjs/common';
import {
  getSectCombatView,
  selectInitialSectPath,
} from '@server/combat/application/CombatV6BuildService';
import {
  mutateSectV6,
  readSectV6,
} from '@server/combat/application/CombatV6SectService';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import type { DbClient } from '@server/lib/drizzle/db';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService';
import type { z } from 'zod';

@Injectable()
export class SectCombatService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  state(owner: string) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: owner },
      'player.sect-combat',
      (tx) => getSectCombatView(owner, tx),
      this.database,
    );
  }
  async selectPath(
    actor: ActiveCultivatorRef,
    input: SectPathSelectionRequest,
  ) {
    return toPlayerStateMutationResponse(
      await selectInitialSectPath(actor, input),
    );
  }
  async read(owner: string) {
    return { success: true, data: await readSectV6(owner) };
  }
  async mutate(owner: string, action: z.infer<typeof SectV6ActionSchema>) {
    return { success: true, ...(await mutateSectV6(owner, action)) };
  }
}
