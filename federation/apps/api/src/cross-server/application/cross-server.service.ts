import {
  canonicalCrossServerJson,
  createCrossServerWireSchemas,
  CROSS_SERVER_CLOCK_SKEW_SECONDS,
  CROSS_SERVER_INVITE_TTL_MS,
  CROSS_SERVER_PROTOCOL,
  CrossServerDirectorySchema,
  type CrossServerChallengeView,
  type CrossServerCreateSchema,
  type CrossServerInvitation,
  type CrossServerReceipt,
  type CrossServerState,
} from '@daoyou/contracts/cross-server';
import {
  crossServerBattle,
  CrossServerCombatBuildSchema,
  exportCrossServerBuild,
} from '@daoyou/game-rules/combat/cross-server';
import { createCombatV6Replay } from '@daoyou/game-rules/combat/replay';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  assembleCombatV6TrainingPlayer,
  CombatV6BuildError,
} from '../../combat/application/CombatV6BuildService.js';
import { DRIZZLE_DATABASE } from '../../database/database.service.js';
import { assertInventoryIdle } from '../../inventory/operations.js';
import type { ActiveCultivatorRef } from '../../lib/auth/types.js';
import type { DbClient, DbExecutor } from '../../lib/drizzle/db.js';
import {
  crossServerChallenges as challenges,
  crossServerPeers,
  cultivators,
  crossServerProfiles as profiles,
} from '../../lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '../../lib/redis/lock.js';
import { archiveCombatV6Replay } from '../../lib/repositories/combatV6ReplayRepository.js';
import { namespacedCombatId, sha256 } from '../identity.js';
import { CrossServerPeersService } from '../peers.service.js';
import { crossServerError, type SigningPeer } from '../transport.js';

export const crossServerWire = createCrossServerWireSchemas(
  CrossServerCombatBuildSchema,
);
type Challenge = typeof challenges.$inferSelect;

@Injectable()
export class CrossServerService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(CrossServerPeersService) readonly peers: CrossServerPeersService,
  ) {}
  private async active(actor: ActiveCultivatorRef, q: DbExecutor = this.db) {
    const [row] = await q
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
      })
      .from(cultivators)
      .where(
        and(
          eq(cultivators.id, actor.cultivatorId),
          eq(cultivators.userId, actor.userId),
          eq(cultivators.status, 'active'),
        ),
      )
      .limit(1);
    return row ?? crossServerError('当前角色不可用', 404);
  }
  private async optedIn(cultivatorId: string, q: DbExecutor = this.db) {
    const [profile] = await q
      .select()
      .from(profiles)
      .where(
        and(
          eq(profiles.cultivatorId, cultivatorId),
          eq(profiles.enabled, true),
        ),
      )
      .limit(1);
    if (!profile) crossServerError('角色尚未开启跨服切磋', 409);
  }
  private freeze(actor: ActiveCultivatorRef) {
    return withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
        context: 'cross-server-build',
      },
      async (lease) => {
        await assertInventoryIdle(actor.cultivatorId);
        const build = await this.db.transaction(
          async (tx) => {
            await this.active(actor, tx);
            await this.optedIn(actor.cultivatorId, tx);
            return this.build(actor.cultivatorId, tx);
          },
          { isolationLevel: 'repeatable read', accessMode: 'read only' },
        );
        lease.assertHeld();
        return build;
      },
    );
  }
  private async build(cultivatorId: string, q: DbExecutor) {
    try {
      return exportCrossServerBuild(
        (await assembleCombatV6TrainingPlayer(cultivatorId, q)).player,
      );
    } catch (error) {
      if (error instanceof CombatV6BuildError)
        crossServerError(error.message, error.status);
      throw error;
    }
  }
  async profile(actor: ActiveCultivatorRef, enabled: boolean) {
    this.peers.manifest();
    await this.active(actor);
    if (enabled) {
      await this.db.transaction((tx) => this.build(actor.cultivatorId, tx), {
        isolationLevel: 'repeatable read',
        accessMode: 'read only',
      });
    }
    await this.db
      .insert(profiles)
      .values({ cultivatorId: actor.cultivatorId, enabled })
      .onConflictDoUpdate({
        target: profiles.cultivatorId,
        set: { enabled, updatedAt: new Date() },
      });
    // Closing consent also closes invitations waiting on this character.
    if (!enabled)
      await this.db
        .update(challenges)
        .set({ status: 'declined', updatedAt: new Date() })
        .where(
          and(
            eq(challenges.localCultivatorId, actor.cultivatorId),
            eq(challenges.direction, 'incoming'),
            eq(challenges.status, 'pending'),
          ),
        );
    return this.state(actor);
  }
  async state(actor: ActiveCultivatorRef): Promise<CrossServerState> {
    await this.active(actor);
    await this.db
      .update(challenges)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(challenges.localCultivatorId, actor.cultivatorId),
          eq(challenges.direction, 'incoming'),
          eq(challenges.status, 'pending'),
          lte(challenges.expiresAt, new Date()),
        ),
      );
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.cultivatorId, actor.cultivatorId))
      .limit(1);
    const peers = (await this.peers.list()).filter((peer) => peer.enabled);
    const rows = await this.db
      .select({
        id: challenges.id,
        peerId: challenges.peerSiteId,
        peerName: crossServerPeers.name,
        direction: challenges.direction,
        opponentName: challenges.opponentName,
        status: challenges.status,
        expiresAt: challenges.expiresAt,
        createdAt: challenges.createdAt,
        lastError: challenges.lastError,
        winner: challenges.winner,
        roundCount: challenges.roundCount,
      })
      .from(challenges)
      .innerJoin(
        crossServerPeers,
        eq(challenges.peerSiteId, crossServerPeers.siteId),
      )
      .where(eq(challenges.localCultivatorId, actor.cultivatorId))
      // At most 13 open invitations: keep them visible even after many completed duels.
      .orderBy(
        desc(sql`${challenges.status} in ('sending', 'pending')`),
        desc(challenges.createdAt),
        desc(challenges.id),
      )
      .limit(50);
    return {
      configured: !!this.peers.transport.identity,
      profileEnabled: profile?.enabled ?? false,
      peers,
      challenges: rows.map(({ winner, ...row }): CrossServerChallengeView => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        outcome:
          winner === null
            ? null
            : winner === 'draw'
              ? 'draw'
              : winner === (row.direction === 'outgoing' ? '0' : '1')
                ? 'victory'
                : 'defeat',
      })),
    };
  }
  async localDirectory(peerId: string, cursor?: string) {
    await this.peers.trusted(peerId);
    const rows = await this.db
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
      })
      .from(profiles)
      .innerJoin(cultivators, eq(profiles.cultivatorId, cultivators.id))
      .where(
        and(
          eq(profiles.enabled, true),
          eq(cultivators.status, 'active'),
          cursor ? gt(cultivators.id, cursor) : undefined,
        ),
      )
      .orderBy(cultivators.id)
      .limit(21);
    return {
      players: rows.slice(0, 20),
      nextCursor: rows.length > 20 ? rows[19].id : null,
    };
  }
  async remoteDirectory(
    actor: ActiveCultivatorRef,
    peerId: string,
    cursor?: string,
  ) {
    await this.active(actor);
    const peer = await this.peers.trusted(peerId);
    try {
      return CrossServerDirectorySchema.parse(
        await this.peers.transport.call(
          peer,
          `/players${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        ),
      );
    } catch {
      crossServerError('无法读取对站道友，请检查双方接入状态后重试', 502);
    }
  }
  private async owned(actor: ActiveCultivatorRef, id: string) {
    await this.active(actor);
    const [row] = await this.db
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.id, id),
          eq(challenges.localCultivatorId, actor.cultivatorId),
        ),
      )
      .limit(1);
    return row ?? crossServerError('挑战不存在', 404);
  }
  async create(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof CrossServerCreateSchema>,
  ) {
    const peer = await this.peers.trusted(input.peerId);
    const requestHash = sha256(
      canonicalCrossServerJson({
        peerId: input.peerId,
        targetId: input.targetId,
        cultivatorId: actor.cultivatorId,
      }),
    );
    await withRedisLock(
      {
        key: `lock:cross-server:create:${actor.cultivatorId}`,
        context: 'cross-server-create',
      },
      async (lease) => {
        await this.active(actor);
        const [existing] = await this.db
          .select()
          .from(challenges)
          .where(eq(challenges.id, input.requestId))
          .limit(1);
        if (existing) {
          if (
            existing.localCultivatorId !== actor.cultivatorId ||
            existing.direction !== 'outgoing' ||
            existing.requestHash !== requestHash
          )
            crossServerError('挑战编号已用于其他请求');
          return;
        }
        const open = await this.db
          .select({ id: challenges.id })
          .from(challenges)
          .where(
            and(
              eq(challenges.localCultivatorId, actor.cultivatorId),
              eq(challenges.direction, 'outgoing'),
              inArray(challenges.status, ['sending', 'pending']),
            ),
          )
          .limit(3);
        if (open.length >= 3)
          crossServerError('请先同步或取消尚未结束的三场邀战');
        const build = await this.freeze(actor);
        const invitation: CrossServerInvitation = {
          id: input.requestId,
          combatHash: this.peers.manifest().combatHash,
          targetId: input.targetId,
          expiresAt: new Date(
            Date.now() + CROSS_SERVER_INVITE_TTL_MS,
          ).toISOString(),
          challenger: build,
        };
        lease.assertHeld();
        const inserted = await this.db
          .insert(challenges)
          .values({
            id: invitation.id,
            peerSiteId: peer.siteId,
            localCultivatorId: actor.cultivatorId,
            direction: 'outgoing',
            status: 'sending',
            requestHash,
            invitation,
            expiresAt: new Date(invitation.expiresAt),
            opponentName: '异界道友',
          })
          .onConflictDoNothing()
          .returning({ id: challenges.id });
        if (!inserted.length) crossServerError('挑战编号发生冲突，请重新发起');
      },
    );
    await this.sync(actor, input.requestId);
    return this.state(actor);
  }
  async invite(peer: SigningPeer, invitation: CrossServerInvitation) {
    const identity = this.peers.manifest();
    const requestHash = sha256(canonicalCrossServerJson(invitation));
    return withRedisLock(
      {
        key: `lock:cross-server:receive:${invitation.targetId}`,
        context: 'cross-server-receive',
      },
      async (lease) => {
        const [existing] = await this.db
          .select()
          .from(challenges)
          .where(eq(challenges.id, invitation.id))
          .limit(1);
        if (existing) {
          if (
            existing.direction !== 'incoming' ||
            existing.peerSiteId !== peer.siteId ||
            existing.requestHash !== requestHash
          )
            crossServerError('挑战编号已用于其他请求');
          return this.receipt(peer, invitation.id);
        }
        if (invitation.combatHash !== identity.combatHash)
          crossServerError('战斗规则不兼容', 422);
        const expiry = Date.parse(invitation.expiresAt);
        if (
          expiry <= Date.now() ||
          expiry >
            Date.now() +
              CROSS_SERVER_INVITE_TTL_MS +
              CROSS_SERVER_CLOCK_SKEW_SECONDS * 1000
        )
          crossServerError('邀战已过期或有效期无效', 422);
        await this.optedIn(invitation.targetId);
        const [target] = await this.db
          .select({
            id: cultivators.id,
            name: cultivators.name,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
          })
          .from(cultivators)
          .where(
            and(
              eq(cultivators.id, invitation.targetId),
              eq(cultivators.status, 'active'),
            ),
          )
          .limit(1);
        if (!target) crossServerError('对方角色不可挑战', 404);
        const open = await this.db
          .select({ id: challenges.id })
          .from(challenges)
          .where(
            and(
              eq(challenges.localCultivatorId, target.id),
              eq(challenges.direction, 'incoming'),
              eq(challenges.status, 'pending'),
              gt(challenges.expiresAt, new Date()),
            ),
          )
          .limit(10);
        if (open.length >= 10) crossServerError('对方待处理邀战已满', 429);
        lease.assertHeld();
        if (expiry <= Date.now()) crossServerError('邀战已过期', 422);
        await this.db
          .insert(challenges)
          .values({
            id: invitation.id,
            peerSiteId: peer.siteId,
            localCultivatorId: target.id,
            direction: 'incoming',
            status: 'pending',
            requestHash,
            invitation,
            receipt: { id: invitation.id, status: 'pending', defender: target },
            expiresAt: new Date(expiry),
            opponentName: invitation.challenger.cultivator.name,
          })
          .onConflictDoNothing();
        const [saved] = await this.db
          .select()
          .from(challenges)
          .where(eq(challenges.id, invitation.id))
          .limit(1);
        if (
          !saved ||
          saved.peerSiteId !== peer.siteId ||
          saved.direction !== 'incoming' ||
          saved.requestHash !== requestHash
        )
          crossServerError('挑战编号发生冲突');
        return this.receipt(peer, invitation.id);
      },
    );
  }
  async receipt(peer: SigningPeer, id: string): Promise<CrossServerReceipt> {
    await this.db
      .update(challenges)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          eq(challenges.id, id),
          eq(challenges.peerSiteId, peer.siteId),
          eq(challenges.direction, 'incoming'),
          eq(challenges.status, 'pending'),
          lte(challenges.expiresAt, new Date()),
        ),
      );
    const [row] = await this.db
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.id, id),
          eq(challenges.peerSiteId, peer.siteId),
          eq(challenges.direction, 'incoming'),
        ),
      )
      .limit(1);
    if (!row?.receipt || row.status === 'sending')
      crossServerError('挑战不存在', 404);
    return { ...row.receipt, status: row.status };
  }
  async lookup(peer: SigningPeer, id: string) {
    const [row] = await this.db
      .select({ id: challenges.id })
      .from(challenges)
      .where(
        and(
          eq(challenges.id, id),
          eq(challenges.peerSiteId, peer.siteId),
          eq(challenges.direction, 'incoming'),
        ),
      )
      .limit(1);
    return row
      ? this.receipt(peer, id)
      : { id, status: 'missing' as const, seenAt: new Date().toISOString() };
  }
  private simulate(
    row: Challenge,
    defender: CrossServerInvitation['challenger'],
  ) {
    const selfId = this.peers.manifest().siteId;
    const sites =
      row.direction === 'incoming'
        ? [row.peerSiteId, selfId]
        : [selfId, row.peerSiteId];
    const seed = Number.parseInt(sha256(row.id).slice(0, 8), 16);
    return crossServerBattle(
      row.invitation.challenger,
      defender,
      seed,
      (side, id) => namespacedCombatId(sites[side], id),
    );
  }
  private async saveCompleted(
    row: Challenge,
    actor: ActiveCultivatorRef,
    receipt: CrossServerReceipt,
    trace: ReturnType<typeof crossServerBattle>,
  ) {
    const side = row.direction === 'incoming' ? 1 : 0;
    const unit = trace.initialUnits.find(
      (unit) => unit.kind === 'player' && unit.side === side,
    );
    if (!unit?.id || !receipt.result) crossServerError('战报数据不完整', 422);
    const replay = createCombatV6Replay({
      battleId: row.id,
      participants: [
        {
          userId: actor.userId,
          cultivatorId: actor.cultivatorId,
          unitId: unit.id,
          side,
          slot: 0,
        },
      ],
      metadata: {
        schemaVersion: 1,
        sourceType: 'cross-server',
        battleType: 'pvp',
        idempotencyKey: row.id,
        payload: {
          peerSiteId: row.peerSiteId,
          protocol: CROSS_SERVER_PROTOCOL,
        },
      },
      startedAt: row.createdAt.toISOString(),
      finishedAt: receipt.result.finishedAt,
      reason: 'battle-ended',
      trace,
    });
    await this.db.transaction(async (tx) => {
      const changed = await tx
        .update(challenges)
        .set({
          status: 'completed',
          receipt,
          winner: String(receipt.result!.winner) as '0' | '1' | 'draw',
          roundCount: receipt.result!.roundCount,
          opponentName:
            row.direction === 'outgoing'
              ? receipt.result!.defender.cultivator.name
              : row.opponentName,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(challenges.id, row.id),
            eq(challenges.localCultivatorId, actor.cultivatorId),
            inArray(challenges.status, ['sending', 'pending']),
          ),
        )
        .returning({ id: challenges.id });
      if (!changed.length) crossServerError('挑战状态已变化，请刷新后重试');
      await archiveCombatV6Replay(replay, tx);
    });
  }
  async accept(actor: ActiveCultivatorRef, id: string) {
    await withRedisLock(
      {
        key: `lock:cross-server:challenge:${id}`,
        context: 'cross-server-accept',
        timeoutMs: 30000,
      },
      async (lease) => {
        const row = await this.owned(actor, id);
        if (row.direction !== 'incoming')
          crossServerError('只能接受发给自己的邀战');
        if (row.status === 'completed') return;
        if (row.status !== 'pending' || row.expiresAt.getTime() <= Date.now())
          crossServerError('邀战已结束或过期');
        await this.peers.trusted(row.peerSiteId);
        if (row.invitation.combatHash !== this.peers.manifest().combatHash)
          crossServerError('战斗规则已更新，请重新邀战');
        const defender = await this.freeze(actor);
        const trace = this.simulate(row, defender);
        const winner = trace.finalState.result?.winner;
        if (winner === undefined) crossServerError('未生成完整战斗结果', 422);
        const receipt: CrossServerReceipt = {
          ...row.receipt!,
          status: 'completed',
          result: {
            defender,
            winner,
            roundCount: trace.finalState.round,
            finishedAt: new Date().toISOString(),
            battleDigest: sha256(
              canonicalCrossServerJson({
                events: trace.events,
                finalState: trace.finalState,
              }),
            ),
          },
        };
        lease.assertHeld();
        await this.saveCompleted(row, actor, receipt, trace);
      },
    );
    return this.state(actor);
  }
  async decline(actor: ActiveCultivatorRef, id: string) {
    const row = await this.owned(actor, id);
    if (row.direction !== 'incoming')
      crossServerError('只能婉拒发给自己的邀战');
    await this.db
      .update(challenges)
      .set({ status: 'declined', updatedAt: new Date() })
      .where(
        and(
          eq(challenges.id, id),
          eq(challenges.localCultivatorId, actor.cultivatorId),
          eq(challenges.status, 'pending'),
        ),
      );
    return this.state(actor);
  }
  async cancelReceived(peer: SigningPeer, id: string) {
    await this.db
      .update(challenges)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(challenges.id, id),
          eq(challenges.peerSiteId, peer.siteId),
          eq(challenges.direction, 'incoming'),
          eq(challenges.status, 'pending'),
        ),
      );
    return this.receipt(peer, id);
  }
  async cancel(actor: ActiveCultivatorRef, id: string) {
    return this.sync(actor, id, true);
  }
  async sync(actor: ActiveCultivatorRef, id: string, cancel = false) {
    await withRedisLock(
      {
        key: `lock:cross-server:challenge:${id}`,
        context: 'cross-server-sync',
        timeoutMs: 30000,
      },
      async (lease) => {
        const row = await this.owned(actor, id);
        if (row.direction !== 'outgoing') crossServerError('此邀战由对站同步');
        if (!['sending', 'pending'].includes(row.status)) return;
        try {
          const peer = await this.peers.trusted(row.peerSiteId);
          let raw: unknown;
          if (row.status === 'sending') {
            const lookup = crossServerWire.lookup.safeParse(
              await this.peers.transport.call(peer, `/challenges/${id}`),
            );
            if (!lookup.success || lookup.data.id !== id)
              crossServerError('对站回执无效', 502);
            if (lookup.data.status === 'missing') {
              if (Date.parse(lookup.data.seenAt) >= row.expiresAt.getTime()) {
                lease.assertHeld();
                await this.db
                  .update(challenges)
                  .set({
                    status: 'expired',
                    lastError: null,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(challenges.id, id),
                      eq(challenges.localCultivatorId, actor.cultivatorId),
                      eq(challenges.status, 'sending'),
                    ),
                  );
                return;
              }
              if (cancel) crossServerError('邀战尚未送达，请先同步后再取消');
              raw = await this.peers.transport.call(
                peer,
                '/challenges',
                'POST',
                row.invitation,
              );
            } else raw = lookup.data;
          } else
            raw = await this.peers.transport.call(peer, `/challenges/${id}`);
          let parsed = crossServerWire.receipt.safeParse(raw);
          if (
            !parsed.success ||
            parsed.data.id !== id ||
            parsed.data.defender.id !== row.invitation.targetId
          )
            crossServerError('对站回执无效', 502);
          let receipt = parsed.data;
          if (cancel && receipt.status === 'pending') {
            parsed = crossServerWire.receipt.safeParse(
              await this.peers.transport.call(
                peer,
                `/challenges/${id}/cancel`,
                'POST',
                {},
              ),
            );
            if (
              !parsed.success ||
              parsed.data.id !== id ||
              parsed.data.defender.id !== row.invitation.targetId
            )
              crossServerError('对站取消回执无效', 502);
            receipt = parsed.data;
          }
          lease.assertHeld();
          if (receipt.status === 'completed' && receipt.result) {
            if (
              row.invitation.combatHash !== this.peers.manifest().combatHash ||
              receipt.result.defender.cultivator.id !== row.invitation.targetId
            )
              crossServerError('战报规则或角色不匹配');
            const trace = this.simulate(row, receipt.result.defender);
            const digest = sha256(
              canonicalCrossServerJson({
                events: trace.events,
                finalState: trace.finalState,
              }),
            );
            if (
              digest !== receipt.result.battleDigest ||
              trace.finalState.result?.winner !== receipt.result.winner ||
              trace.finalState.round !== receipt.result.roundCount
            )
              crossServerError('战报复算未通过，已保留原邀战');
            lease.assertHeld();
            await this.saveCompleted(row, actor, receipt, trace);
          } else {
            await this.db
              .update(challenges)
              .set({
                status: receipt.status,
                receipt,
                opponentName: receipt.defender.name,
                lastError: null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(challenges.id, id),
                  eq(challenges.localCultivatorId, actor.cultivatorId),
                  inArray(challenges.status, ['sending', 'pending']),
                ),
              );
          }
        } catch {
          lease.assertHeld();
          await this.db
            .update(challenges)
            .set({
              lastError: '同步未完成，已保留挑战编号；检查接入或稍后重试。',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(challenges.id, id),
                eq(challenges.localCultivatorId, actor.cultivatorId),
                inArray(challenges.status, ['sending', 'pending']),
              ),
            );
        }
      },
    );
    return this.state(actor);
  }
}
