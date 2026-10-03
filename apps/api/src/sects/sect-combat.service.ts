import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import {
  getSectCombatView,
  selectInitialSectPath,
} from '@server/lib/services/combat-v6/CombatV6BuildService';
import {
  mutateSectV6,
  readSectV6,
} from '@server/lib/services/combat-v6/CombatV6SectService';
import type { SectPathSelectionRequest } from '@daoyou/shared/contracts/combatV6';
import type { SectV6ActionSchema } from '@daoyou/shared/contracts/combatV6Sect';
import type { z } from 'zod';

@Injectable()
export class SectCombatService {
  state(owner: string) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: owner },
      'player.sect-combat',
      (tx) => getSectCombatView(owner, tx),
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
