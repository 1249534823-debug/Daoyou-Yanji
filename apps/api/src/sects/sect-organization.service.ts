import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { findMembership } from '@server/lib/repositories/sectRepository';
import type { CommittedCommand } from '@server/lib/services/CommandExecutors';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  readResourceWithMeta,
  readResourceWithResolvedScope,
} from '@server/lib/services/ResourceReadService';
import { SectError } from '@server/lib/services/SectError';
import { sectOrganizationFacade } from '@server/lib/services/sect-organization';
import {
  createPostgresSectConstructionQueryContext,
  createPostgresSectEconomyContext,
  createPostgresSectMembershipQueryContext,
  createPostgresSectQueryContext,
} from '@server/lib/services/sect-organization/PostgresSectOrganizationAdapters';
import { executeSectConstructionDonationCommand } from '@server/lib/services/sect-organization/SectConstructionCommand';
import {
  executeSectShopPurchaseCommand,
  executeSectStipendClaimCommand,
} from '@server/lib/services/sect-organization/SectEconomyCommand';
import {
  executeSectJoinCommand,
  executeSectPromotionCommand,
} from '@server/lib/services/sect-organization/SectMembershipCommand';
import { executeSectTaskActionCommand } from '@server/lib/services/sect-organization/SectTaskCommand';
import { previewSectTransfer } from '@server/lib/services/sect-organization/SectTransferApplicationService';
import { executeSectTransferCommand } from '@server/lib/services/sect-organization/SectTransferCommand';
import type { SectCommandArgs } from '@server/lib/services/sect-organization/commandSupport';
import type {
  SectDonationRequestSchema,
  SectTaskActionRequestSchema,
  SectTransferPreviewQuerySchema,
  SectTransferRequestSchema,
} from '@daoyou/shared/contracts/sect';
import { SectShopBuyParamsSchema } from '@daoyou/shared/contracts/sectShop';
import { productionSectRuntime as runtime } from '@daoyou/shared/engine/sect/content';
import type { RealmStage, RealmType } from '@daoyou/shared/types/constants';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import {
  requireSectIdempotency,
  type SectCommandRequest,
} from './sect-idempotency';

@Injectable()
export class SectOrganizationService {
  infrastructure(actor: ActiveCultivatorRef) {
    return readResourceWithResolvedScope('sect.infrastructure', async (q) => {
      const membership = await findMembership(actor.cultivatorId, q);
      if (!membership)
        throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门', 404);
      return {
        scope: { kind: 'sect', id: membership.sectId },
        data: await sectOrganizationFacade.membership.getInfrastructureResource(
          actor.cultivatorId,
          createPostgresSectMembershipQueryContext({ q, runtime }),
        ),
      };
    });
  }

  async stipend(actor: ActiveCultivatorRef) {
    const q = getExecutor();
    const cultivator = await q.query.cultivators.findFirst({
      columns: { id: true, realm: true },
      where: eq(cultivators.id, actor.cultivatorId),
    });
    if (!cultivator)
      throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
    const data = await sectOrganizationFacade.membership.getStipendResource(
      { id: cultivator.id, realm: cultivator.realm as RealmType },
      createPostgresSectMembershipQueryContext({ q, runtime }),
    );
    return { success: true, data };
  }

  async promotionEvaluation(actor: ActiveCultivatorRef) {
    const q = getExecutor();
    const cultivator = await q.query.cultivators.findFirst({
      columns: { id: true, realm: true, realm_stage: true },
      where: eq(cultivators.id, actor.cultivatorId),
    });
    if (!cultivator)
      throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
    const data =
      await sectOrganizationFacade.membership.getPromotionEvaluationResource(
        {
          id: cultivator.id,
          realm: cultivator.realm as RealmType,
          realm_stage: cultivator.realm_stage as RealmStage,
        },
        createPostgresSectMembershipQueryContext({ q, runtime }),
      );
    return { success: true, data };
  }

  tasks(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'sect.tasks',
      (q) =>
        sectOrganizationFacade.tasks.queries.execute(
          { cultivatorId: actor.cultivatorId },
          createPostgresSectQueryContext({ q, runtime }),
        ),
    );
  }

  async submissionCandidates(actor: ActiveCultivatorRef, taskId: string) {
    if (!taskId || taskId.length > 64)
      throw new HttpException({ success: false, error: '任务编号无效' }, 400);
    return {
      success: true,
      data: await sectOrganizationFacade.tasks.submissions.execute(
        { cultivatorId: actor.cultivatorId, taskId },
        createPostgresSectQueryContext({ q: getExecutor(), runtime }),
      ),
    };
  }

  shop(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'sect.shop',
      (q) =>
        sectOrganizationFacade.economy.getShop(
          actor.cultivatorId,
          createPostgresSectEconomyContext({ q, runtime }),
        ),
    );
  }

  constructionMember(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'sect.construction-member',
      (q) =>
        sectOrganizationFacade.construction.getConstructionMember(
          actor.userId,
          actor.cultivatorId,
          createPostgresSectConstructionQueryContext({ q, runtime }),
        ),
    );
  }

  members(
    actor: ActiveCultivatorRef,
    query: { page: number; pageSize: number },
  ) {
    return readResourceWithResolvedScope('sect.members', async (q) => {
      const membership = await findMembership(actor.cultivatorId, q);
      if (!membership)
        throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门', 404);
      return {
        scope: { kind: 'sect', id: membership.sectId },
        data: await sectOrganizationFacade.membership.listMembers(
          actor.cultivatorId,
          query.page,
          query.pageSize,
          createPostgresSectMembershipQueryContext({ q, runtime }),
        ),
      };
    });
  }

  async transferPreview(
    actor: ActiveCultivatorRef,
    query: z.infer<typeof SectTransferPreviewQuerySchema>,
  ) {
    return {
      success: true,
      data: await previewSectTransfer({
        cultivatorId: actor.cultivatorId,
        ...query,
        runtime,
        q: getExecutor(),
      }),
    };
  }

  taskAction(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    taskId: string,
    actionKey: string,
    body: z.infer<typeof SectTaskActionRequestSchema>,
  ) {
    if (taskId.length > 64 || actionKey.length > 64)
      throw new HttpException(
        { success: false, error: '任务操作编号无效' },
        400,
      );
    return this.mutate(
      actor,
      request,
      'sect_task_action',
      { taskId, actionKey, input: body.input },
      (args) =>
        executeSectTaskActionCommand({
          ...args,
          taskId,
          actionKey,
          requestId: request.key ?? '',
          input: body.input,
        }),
    );
  }

  promote(actor: ActiveCultivatorRef, request: SectCommandRequest) {
    return this.mutate(
      actor,
      request,
      'sect_promotion',
      null,
      executeSectPromotionCommand,
    );
  }

  buy(actor: ActiveCultivatorRef, request: SectCommandRequest, id: string) {
    const parsed = SectShopBuyParamsSchema.safeParse({ id });
    if (!parsed.success)
      throw new HttpException({ success: false, error: '商品编号无效' }, 400);
    return this.mutate(
      actor,
      request,
      'sect_shop_purchase',
      parsed.data,
      (args) =>
        executeSectShopPurchaseCommand({ ...args, itemId: parsed.data.id }),
    );
  }

  donate(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    body: z.infer<typeof SectDonationRequestSchema>,
  ) {
    return this.mutate(
      actor,
      request,
      'sect_construction_donate',
      body,
      (args) => executeSectConstructionDonationCommand({ ...args, ...body }),
    );
  }

  claimStipend(actor: ActiveCultivatorRef, request: SectCommandRequest) {
    return this.mutate(
      actor,
      request,
      'sect_stipend_claim',
      null,
      executeSectStipendClaimCommand,
    );
  }

  transfer(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    body: z.infer<typeof SectTransferRequestSchema>,
  ) {
    return this.mutate(actor, request, 'sect_transfer', body, (args) =>
      executeSectTransferCommand({ ...args, ...body }),
    );
  }

  join(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    sectId: string,
  ) {
    return this.mutate(actor, request, 'sect_join', { sectId }, (args) =>
      executeSectJoinCommand({
        ...args,
        sectId,
        admission: (q) => sectOrganizationFacade.admission(q, runtime),
      }),
    );
  }

  private async mutate<T>(
    actor: ActiveCultivatorRef,
    request: SectCommandRequest,
    source: string,
    payload: unknown,
    run: (args: SectCommandArgs) => Promise<CommittedCommand<T>>,
  ) {
    const committed = await run({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source,
      idempotency: requireSectIdempotency(request, source, payload),
      runtime,
    });
    return toPlayerStateMutationResponse(committed);
  }
}
