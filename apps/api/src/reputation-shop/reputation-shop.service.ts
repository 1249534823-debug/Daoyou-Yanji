import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { readCultivatorReputation } from '@server/cultivator/application/readers/CultivatorFactsReader';
import { purchaseReputationShopItemCommand } from '@server/reputation-shop/application/ReputationShopApplicationService';
import { listReputationShopItems } from '@server/reputation-shop/application/ReputationShopService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';

@Injectable()
export class ReputationShopService {
  async list(owner: string) {
    const items = await listReputationShopItems({
      cultivatorId: owner,
      userVisibleOnly: true,
    });
    const { reputation } = await readCultivatorReputation(owner);
    return { items, reputation };
  }

  async buy(actor: ActiveCultivatorRef, id: string, requestId: string) {
    return toPlayerStateMutationResponse(
      await purchaseReputationShopItemCommand({
        id,
        requestId,
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
      }),
    );
  }
}
