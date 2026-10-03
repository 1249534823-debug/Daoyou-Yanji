import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import {
  confirmBagRecycle,
  previewBagRecycle,
} from '@server/inventory/application/BagRecycleService';
import { purchaseMarketItems } from '@server/market/application/MarketApplicationService';
import {
  getMarketListings,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@server/market/application/MarketService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readCultivatorRealm } from '@server/cultivator/application/readers/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository';
import type { MarketBuyInput } from '@daoyou/shared/contracts/market';
import type { RecycleRequestSchema } from '@daoyou/shared/contracts/recycle';
import type { z } from 'zod';

@Injectable()
export class MarketService {
  async list(actor: ActiveCultivatorRef, node: string, layerValue?: string) {
    const nodeId = resolveNodeId(node);
    const layer = resolveLayer(layerValue);
    if (layer === 'black')
      throw new MarketServiceError(410, '黑市已经移入暗巷，请从坊市入口前往');
    const [{ realm }, fates] = await Promise.all([
      readCultivatorRealm(actor.cultivatorId),
      getPlayerPreHeavenFates(actor.userId, actor.cultivatorId),
    ]);
    return getMarketListings({
      nodeId,
      layer,
      userId: actor.userId,
      cultivatorRealm: realm,
      fates: fates ?? [],
    });
  }

  async buy(actor: ActiveCultivatorRef, node: string, input: MarketBuyInput) {
    return toPlayerStateMutationResponse(
      await purchaseMarketItems({ actor, nodeId: resolveNodeId(node), input }),
    );
  }

  async recycle(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof RecycleRequestSchema>,
  ) {
    if (input.phase === 'preview')
      return {
        success: true,
        data: await previewBagRecycle(actor.cultivatorId, input.items),
      };
    return toPlayerStateMutationResponse(
      await confirmBagRecycle(actor, input.quoteId),
    );
  }
}
