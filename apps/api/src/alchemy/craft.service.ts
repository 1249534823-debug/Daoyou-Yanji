import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { assertAlchemyMaterialVersions } from '@server/alchemy/application/inventory/AlchemyInventory';
import { previewFormulaCraft } from '@server/alchemy/application/AlchemyFormulaService';
import { previewAlchemySelection } from '@server/alchemy/application/alchemyServiceV2';
import { executeCraftCommand } from '@server/forging/application/CraftApplicationService';
import { readCraftReadinessFacts } from '@server/cultivator/application/readers/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository';
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
