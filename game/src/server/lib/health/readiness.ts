import { getDatabaseHealthStatus } from '@server/lib/drizzle/db';
import { getMessageInfrastructureHealthStatus } from '@server/lib/mq/domainEventRegistry';
import { getNatsHealthStatus } from '@server/lib/nats';
import { getRedisHealthStatus } from '@server/lib/redis';
import { boundedProbe, type HealthStatus } from './boundedProbe';

const checkRedis = boundedProbe(getRedisHealthStatus);
const checkNats = boundedProbe(getNatsHealthStatus, 2_500);
const runtimeChecks = new Map<string, () => HealthStatus>();

/** Runtime startup registers required workers here; no worker is started by a probe. */
export function registerRuntimeReadiness(
  name: string,
  check: () => HealthStatus,
) {
  if (['database', 'redis', 'nats', 'messaging'].includes(name)) {
    throw new Error('Reserved readiness check name');
  }
  runtimeChecks.set(name, check);
}

export async function getReadinessStatus() {
  const [database, redis, nats] = await Promise.all([
    getDatabaseHealthStatus(),
    checkRedis(),
    checkNats(),
  ]);
  const messaging = getMessageInfrastructureHealthStatus();
  const checks: Record<string, HealthStatus> = {
    database,
    redis,
    nats,
    messaging,
  };
  for (const [name, check] of runtimeChecks) {
    try {
      checks[name] = check();
    } catch {
      checks[name] = 'down';
    }
  }
  // Redis is required for safe writes, even when unconfigured.
  const success = Object.values(checks).every((status) => status === 'up');
  return { success, ...checks };
}
