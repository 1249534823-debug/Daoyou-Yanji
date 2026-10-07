import { getExecutor } from '@server/lib/drizzle/db';
import {
  secretRealmAudit,
  secretRealmRuns,
  secretRealms,
} from '@server/lib/drizzle/schema';
import {
  SECRET_REALMS,
  secretRealmDay,
  type SecretRealmId,
} from '@shared/config/secretRealms';
import {
  DEFAULT_SECRET_REALM_REWARDS,
  type SecretRealmReward,
} from '@shared/contracts/secretRealmRewards';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { compileSecretRealmRewards } from './SecretRealmRewards';

export class SecretRealmError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 409,
  ) {
    super(message);
  }
}

export async function listSecretRealms(cultivatorId?: string) {
  const q = getExecutor();
  const settings = await q.select().from(secretRealms);
  const now = new Date();
  const realms = [];
  for (const config of Object.values(SECRET_REALMS)) {
    const setting = settings.find((s) => s.id === config.id);
    if (!setting) continue;
    let rewardPreviews;
    let rewardsAvailable = true;
    try {
      rewardPreviews = (await compileSecretRealmRewards(setting.rewards))
        .previews;
    } catch {
      rewardsAvailable = false;
      rewardPreviews = (setting.rewards ?? DEFAULT_SECRET_REALM_REWARDS).map(
        (r) => ({
          type: r.type,
          name: r.type === 'item' ? '奖励道具暂不可用' : r.type,
          quantity: r.quantity,
        }),
      );
    }
    const rewardDescription = rewardPreviews
      .map((r) => `${r.name} ×${r.quantity}`)
      .join('、');
    if (!cultivatorId) {
      realms.push({
        ...config,
        rewardPreviews,
        rewardDescription,
        enabled: setting.enabled,
        version: setting.version,
        rewards: setting.rewards ?? DEFAULT_SECRET_REALM_REWARDS,
      });
      continue;
    }
    const [pending] = await q
      .select()
      .from(secretRealmRuns)
      .where(
        and(
          eq(secretRealmRuns.cultivatorId, cultivatorId),
          eq(secretRealmRuns.realmId, config.id),
          isNull(secretRealmRuns.claimedAt),
        ),
      )
      .orderBy(desc(secretRealmRuns.createdAt))
      .limit(1);
    const [today] = await q
      .select()
      .from(secretRealmRuns)
      .where(
        and(
          eq(secretRealmRuns.cultivatorId, cultivatorId),
          eq(secretRealmRuns.realmId, config.id),
          eq(secretRealmRuns.entryDay, secretRealmDay(now)),
        ),
      )
      .limit(1);
    const run = pending ?? today;
    realms.push({
      ...config,
      rewardPreviews,
      rewardDescription,
      enabled: setting.enabled && rewardsAvailable,
      rewardsAvailable,
      version: setting.version,
      serverNow: now.toISOString(),
      usedToday: today ? 1 : 0,
      run: run
        ? {
            id: run.id,
            readyAt: run.readyAt.toISOString(),
            claimedAt: run.claimedAt?.toISOString() ?? null,
          }
        : null,
    });
  }
  return { realms };
}

export async function toggleSecretRealm(
  id: SecretRealmId,
  enabled: boolean,
  version: number,
  actorId: string,
  rewards?: SecretRealmReward[],
) {
  await getExecutor().transaction(async (tx) => {
    if (rewards) {
      try {
        await compileSecretRealmRewards(rewards, tx);
      } catch (error) {
        throw new SecretRealmError(
          error instanceof Error ? error.message : '奖励配置无效',
          400,
        );
      }
    }
    const [updated] = await tx
      .update(secretRealms)
      .set({
        enabled,
        ...(rewards ? { rewards } : {}),
        version: sql`${secretRealms.version} + 1`,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(and(eq(secretRealms.id, id), eq(secretRealms.version, version)))
      .returning();
    if (!updated)
      throw new SecretRealmError('配置已被其他管理员修改，请刷新后再操作。');
    await tx
      .insert(secretRealmAudit)
      .values({
        realmId: id,
        actorId,
        enabled,
        rewards: updated.rewards ?? DEFAULT_SECRET_REALM_REWARDS,
        version: updated.version,
      });
  });
  return { ok: true };
}

export async function enterSecretRealm() {
  throw new SecretRealmError('请通过副本入口挑战天灵秘境。');
}
export async function claimSecretRealm() {
  throw new SecretRealmError(
    '击败全部守卫与首领后，由副本结算自动发放天灵丹。',
  );
}
