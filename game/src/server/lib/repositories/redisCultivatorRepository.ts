import type { Cultivator } from '@shared/types/cultivator';
import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';

const TEMP_CHAR_TTL = 3600;
const TEMP_PREFIX = 'temp_cultivator:';

// Keep domain JSON opaque to Lua: Redis cjson turns empty arrays into objects.
type TempCharacter = {
  ownerUserId: string;
  cultivatorJson: string;
  fatesJson?: string;
  rerolls: number;
};

export async function saveTempCharacter(
  cultivator: Cultivator,
  userId: string,
): Promise<string> {
  if (!userId) throw new Error('临时角色缺少所属账号');
  const tempId = crypto.randomUUID();
  await redis.set(
    `${TEMP_PREFIX}${tempId}`,
    JSON.stringify({
      ownerUserId: userId,
      cultivatorJson: JSON.stringify(cultivator),
      rerolls: 0,
    } satisfies TempCharacter),
    'EX',
    TEMP_CHAR_TTL,
  );
  return tempId;
}

async function getOwnedTemp(
  tempId: string,
  userId: string,
): Promise<TempCharacter | null> {
  const key = `${TEMP_PREFIX}${tempId}`;
  const data = parseRedisJson<TempCharacter>(await redis.get(key), key);
  // Ownerless legacy data cannot be safely assigned to a caller.
  return userId && data?.ownerUserId === userId && data.cultivatorJson
    ? data
    : null;
}

export async function getTempCharacter(
  tempId: string,
  userId: string,
): Promise<Cultivator | null> {
  const data = await getOwnedTemp(tempId, userId);
  return data ? (JSON.parse(data.cultivatorJson) as Cultivator) : null;
}

export async function getTempFates(
  tempId: string,
  userId: string,
): Promise<Cultivator['pre_heaven_fates'] | null> {
  const data = await getOwnedTemp(tempId, userId);
  return data?.fatesJson
    ? (JSON.parse(data.fatesJson) as Cultivator['pre_heaven_fates'])
    : null;
}

export async function getTempRerollsRemaining(
  tempId: string,
  userId: string,
  maxRerolls: number,
): Promise<number | null> {
  const data = await getOwnedTemp(tempId, userId);
  return data ? Math.max(0, maxRerolls - data.rerolls) : null;
}

// Atomic owner check, reroll budget and replacement. KEEPTTL never extends
// the original character lifetime and an expired record cannot be resurrected.
export async function saveTempFates(
  tempId: string,
  userId: string,
  fates: Cultivator['pre_heaven_fates'],
  maxRerolls: number,
): Promise<{ allowed: boolean; remaining: number; expired: boolean }> {
  const result = (await redis.eval(
    `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return {-1, 0} end
    local data = cjson.decode(raw)
    if data.ownerUserId ~= ARGV[1] or not data.cultivatorJson then return {-1, 0} end
    local count = data.rerolls or 0
    if data.fatesJson then
      if count >= tonumber(ARGV[3]) then return {0, 0} end
      count = count + 1
    end
    data.fatesJson = ARGV[2]
    data.rerolls = count
    redis.call('SET', KEYS[1], cjson.encode(data), 'KEEPTTL')
    return {1, tonumber(ARGV[3]) - count}
  `,
    1,
    `${TEMP_PREFIX}${tempId}`,
    userId,
    JSON.stringify(fates),
    maxRerolls,
  )) as [number, number];
  return {
    allowed: result[0] === 1,
    remaining: result[1],
    expired: result[0] === -1,
  };
}

export async function deleteTempData(
  tempId: string,
  userId: string,
): Promise<void> {
  await redis.eval(
    `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local data = cjson.decode(raw)
    if data.ownerUserId ~= ARGV[1] then return 0 end
    return redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
  `,
    3,
    `${TEMP_PREFIX}${tempId}`,
    `temp_fates:${tempId}`,
    `reroll_count:${tempId}`,
    userId,
  );
}
