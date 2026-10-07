import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  playerMutationRequests,
  resourceEvents,
  resourceScopes,
} from '@server/lib/drizzle/schema';
import { invalidateActiveCultivatorRef } from '@server/lib/hono/middleware';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { mapResourceEventRow } from '@server/lib/repositories/playerStateRepository';
import {
  deleteTempData,
  getTempCharacter,
  getTempFates,
} from '@server/lib/repositories/redisCultivatorRepository';
import { createCultivator } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { isValidFateSelection } from '@shared/engine/cultivator/creation/fateSelection';
import type { Cultivator } from '@shared/types/cultivator';
import { and, eq, sql } from 'drizzle-orm';
import {
  playerCommandExecutor,
  type CommittedCommand,
} from './CommandExecutors';
import { MailService } from './MailService';
import { baselinesFromResourceChanges } from './ResourceEventCommitter';
import { TaskService } from './TaskService';

export async function executeCultivatorCreationCommand(
  userId: string,
  cultivator: Cultivator,
  tx: DbTransaction,
): Promise<{
  cultivatorId: string;
  result: null;
  resourceChanges: ResourceChangeDescriptor[];
}> {
  // Database fencing remains effective even if the Redis lease expires.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`cultivator-creation:${userId}`}, 0))`,
  );
  const [active] = await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(
      and(eq(cultivators.userId, userId), eq(cultivators.status, 'active')),
    )
    .limit(1);
  if (active)
    throw new CultivatorCreationCommandError(
      '您已经拥有一位道身，无法创建新的道身',
    );
  const created = await createCultivator(userId, cultivator, tx);
  if (!created.id) {
    throw new Error('创建角色后缺少角色标识');
  }

  await TaskService.syncCultivatorTasks(created.id, tx);
  await MailService.sendNewRewardMail(
    created.id,
    '仙缘初结·新手礼包',
    '恭喜道友踏入仙途！大道争锋，财侣法地缺一不可。这有些许灵石，聊表心意，助道友仙路顺遂。',
    [{ type: 'spirit_stones', name: '灵石', quantity: 20000 }],
    'reward',
    tx,
  );

  return {
    cultivatorId: created.id,
    result: null,
    resourceChanges: [
      {
        resourceTopic: 'player.session',
        eventType: 'cultivator.created',
        operation: 'replace',
        payload: {
          activeCultivator: {
            id: created.id,
            status: 'active',
            sectId: null,
          },
        },
      },
    ],
  };
}

export class CultivatorCreationCommandError extends Error {}

class CreationAlreadyCommitted extends Error {
  constructor(readonly committed: CommittedCommand<null>) {
    super('角色创建已完成');
  }
}

export function createCultivatorFromTemp(args: {
  userId: string;
  tempCultivatorId: string;
  selectedFateIndices: number[];
}) {
  if (!isValidFateSelection(args.selectedFateIndices)) {
    throw new CultivatorCreationCommandError('请选择三个不同的有效气运');
  }
  const fingerprint = JSON.stringify(
    [...args.selectedFateIndices].sort((a, b) => a - b),
  );
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorCreation(args.userId),
      context: 'save-character',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) => {
      let committed: CommittedCommand<null>;
      try {
        committed = await playerCommandExecutor.executeInitial({
          userId: args.userId,
          source: 'cultivator_created',
          command: async (tx) => {
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`cultivator-creation:${args.userId}`}, 0))`,
            );
            // Receipt is written with the character, mail and resource event in
            // the same transaction. Retries do not depend on Redis cleanup.
            const [receipt] = await tx
              .select({
                fingerprint: playerMutationRequests.requestFingerprint,
                cultivatorId: cultivators.id,
              })
              .from(playerMutationRequests)
              .innerJoin(
                cultivators,
                eq(cultivators.id, playerMutationRequests.cultivatorId),
              )
              .where(
                and(
                  eq(cultivators.userId, args.userId),
                  eq(playerMutationRequests.source, 'cultivator_created'),
                  eq(playerMutationRequests.requestId, args.tempCultivatorId),
                ),
              )
              .limit(1);
            if (receipt) {
              if (receipt.fingerprint !== fingerprint)
                throw new CultivatorCreationCommandError(
                  '角色已创建，不能更改原气运选择',
                );
              const rows = await tx
                .select({
                  event: resourceEvents,
                  kind: resourceScopes.scopeKind,
                  id: resourceScopes.scopeKey,
                })
                .from(resourceEvents)
                .innerJoin(
                  resourceScopes,
                  eq(resourceScopes.id, resourceEvents.scopeId),
                )
                .where(
                  and(
                    eq(resourceEvents.actorCultivatorId, receipt.cultivatorId),
                    eq(resourceEvents.source, 'cultivator_created'),
                  ),
                );
              const changes = rows.map((row) =>
                mapResourceEventRow(row.event, { kind: row.kind, id: row.id }),
              );
              throw new CreationAlreadyCommitted({
                result: null,
                state: {
                  changes,
                  baselines: baselinesFromResourceChanges(changes),
                  replayed: true,
                },
              });
            }
            const [cultivator, fates] = await Promise.all([
              getTempCharacter(args.tempCultivatorId, args.userId),
              getTempFates(args.tempCultivatorId, args.userId),
            ]);
            if (!cultivator || !fates)
              throw new CultivatorCreationCommandError(
                '角色推演已过期，请重新生成',
              );
            if (!isValidFateSelection(args.selectedFateIndices, fates.length))
              throw new CultivatorCreationCommandError('气运选择有误');
            cultivator.pre_heaven_fates = args.selectedFateIndices.map(
              (index) => fates[index],
            );
            lease.assertHeld();
            const result = await executeCultivatorCreationCommand(
              args.userId,
              cultivator,
              tx,
            );
            await tx
              .insert(playerMutationRequests)
              .values({
                cultivatorId: result.cultivatorId,
                source: 'cultivator_created',
                requestId: args.tempCultivatorId,
                requestFingerprint: fingerprint,
                result: {},
              });
            lease.assertHeld();
            return result;
          },
        });
      } catch (error) {
        if (!(error instanceof CreationAlreadyCommitted)) throw error;
        committed = error.committed;
      }
      // A cache outage after commit must not turn a successful durable write
      // into a second creation attempt. The receipt is the replay authority.
      const cleanup = await Promise.allSettled([
        invalidateActiveCultivatorRef(args.userId),
        deleteTempData(args.tempCultivatorId, args.userId),
      ]);
      if (cleanup.some((entry) => entry.status === 'rejected'))
        console.warn(
          '[cultivator-creation] post-commit cache cleanup incomplete',
        );
      return committed;
    },
  );
}
