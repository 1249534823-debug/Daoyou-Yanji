import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { assertAlchemyMaterialVersions } from '@server/lib/services/alchemy/AlchemyInventory';
import { previewFormulaCraft } from '@server/lib/services/AlchemyFormulaService';
import { previewAlchemySelection } from '@server/lib/services/alchemyServiceV2';
import { executeCraftCommand } from '@server/lib/services/CraftApplicationService';
import { readCraftReadinessFacts } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import type { z } from 'zod';
import type { CraftCommandSchema, CraftSchema } from './alchemy-input';

@Injectable()
export class CraftService {
  async preview(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof CraftSchema>,
  ) {
    const owner = actor.cultivatorId;
    await assertAlchemyMaterialVersions(
      owner,
      input.materialIds,
      input.materialVersions,
    );
    const [facts, fates] = await Promise.all([
      readCraftReadinessFacts(owner),
      getPlayerPreHeavenFates(actor.userId, owner),
    ]);
    if (input.alchemyMode === 'formula' && !input.formulaId)
      throw new HttpException({ error: '请选择丹方' }, 400);
    const data =
      input.alchemyMode === 'formula'
        ? await previewFormulaCraft(
            owner,
            input.formulaId!,
            input.materialIds,
            facts.spiritStones,
            fates ?? [],
            input.materialQuantities,
          )
        : await previewAlchemySelection(
            owner,
            facts.spiritStones,
            input.materialIds,
            fates ?? [],
            input.materialQuantities,
          );
    return { success: true, data };
  }

  async execute(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof CraftCommandSchema>,
  ) {
    return toPlayerStateMutationResponse(
      await executeCraftCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        input,
      }),
    );
  }
}
