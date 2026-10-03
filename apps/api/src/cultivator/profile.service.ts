import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { db } from '@server/lib/drizzle/db';
import {
  isValidRedeemCodeFormat,
  normalizeRedeemCode,
} from '@server/lib/redeem/code';
import { loadPlayerRetreatFacts } from '@server/lib/services/cultivator/CultivatorConditionFactsReader';
import {
  allocateCultivatorAttributes,
  reincarnateActiveCultivator,
  resetCultivatorAttributes,
  updateCultivatorTitle,
} from '@server/lib/services/CultivatorProfileApplicationService';
import { QiService } from '@server/lib/services/QiService';
import { claimRedeemCode } from '@server/lib/services/RedeemCodeApplicationService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import type {
  AttributeAllocationRequest,
  AttributePreviewData,
} from '@daoyou/shared/contracts/characterAttributes';
import {
  CHARACTER_ATTRIBUTE_LABELS,
  projectCharacterDisplay,
} from '@daoyou/shared/lib/cultivatorDisplay';

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class ProfileService {
  async reincarnate(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await reincarnateActiveCultivator({ actor }),
    );
  }

  async qiLogs(cultivatorId: string, page?: string, pageSize?: string) {
    return {
      success: true,
      data: await QiService.listLogs(cultivatorId, {
        page: parsePositiveInt(page, 1),
        pageSize: Math.min(100, parsePositiveInt(pageSize, 20)),
      }),
    };
  }

  async title(actor: ActiveCultivatorRef, title?: string | null) {
    return toPlayerStateMutationResponse(
      await updateCultivatorTitle({ ...actor, title: title || null }),
    );
  }

  async preview(actor: ActiveCultivatorRef, delta: AttributeAllocationRequest) {
    const data = await db.transaction(
      async (tx): Promise<AttributePreviewData> => {
        const facts = await loadPlayerRetreatFacts(
          actor.userId,
          actor.cultivatorId,
          tx,
        );
        if (!facts) throw new HttpException({ error: '角色不存在' }, 404);
        const keys = Object.keys(
          CHARACTER_ATTRIBUTE_LABELS,
        ) as (keyof typeof facts.attributes)[];
        const spent = keys.reduce((sum, key) => sum + delta[key], 0);
        if (spent > facts.unallocated_attribute_points)
          throw new HttpException({ error: '未分配属性点不足' }, 400);
        const attributes = { ...facts.attributes };
        for (const key of keys) attributes[key] += delta[key];
        return {
          current: facts.combatV6ResourceAuthority.attrs,
          preview: projectCharacterDisplay(
            { ...facts, attributes },
            facts.combatV6ResourceAuthority.build,
          ),
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    return { success: true, data };
  }

  async allocate(
    actor: ActiveCultivatorRef,
    delta: AttributeAllocationRequest,
  ) {
    return toPlayerStateMutationResponse(
      await allocateCultivatorAttributes({ actor, delta }),
    );
  }

  async reset(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await resetCultivatorAttributes(actor),
    );
  }

  async redeem(actor: ActiveCultivatorRef, code: string) {
    const normalizedCode = normalizeRedeemCode(code);
    if (!isValidRedeemCodeFormat(normalizedCode))
      throw new HttpException(
        { error: '兑换码格式错误，仅支持 6-64 位大写字母数字' },
        400,
      );
    return toPlayerStateMutationResponse(
      await claimRedeemCode({ ...actor, code: normalizedCode }),
    );
  }
}
