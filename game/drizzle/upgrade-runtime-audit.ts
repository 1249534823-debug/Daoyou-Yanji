/** Read-only runtime cutover inventory. No topology/bootstrap or app imports. */
import pg from 'pg';
import Redis from 'ioredis';
import { connect } from 'nats';
const args = process.argv.slice(2);
const expected = args.includes('--database') ? args[args.indexOf('--database') + 1] : undefined;
if (!expected || !process.env.DATABASE_URL || !process.env.REDIS_URL) throw new Error('Explicit database target and DB/Redis env are required');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  const target = await client.query('SELECT current_database() AS name');
  if (target.rows[0]?.name !== expected) throw new Error('Database identity mismatch');
  const pending = await client.query('SELECT message_key,count(*)::int AS count FROM wanjiedaoyou_transactional_messages WHERE published_at IS NULL GROUP BY message_key');
  console.log(JSON.stringify({ outboxPending: pending.rows }));
  await client.query('ROLLBACK');
} finally { await client.end(); }
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000 });
try {
  await redis.connect();
  const patterns = ['active-cultivator:user:*','auction:listings:*','market:v2:listings:*','market:v2:bought:*',
    'temp_cultivator:*','dungeon:active:*','dungeon:battle-result:*','arena:room:v1:*','battle:online:*','combat:v6:*'];
  const keyCounts: Record<string, number> = {};
  for (const pattern of patterns) {
    const keys = new Set<string>(); let cursor = '0';
    do { const page = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200); cursor = page[0]; page[1].forEach(k=>keys.add(k)); } while (cursor !== '0');
    keyCounts[pattern] = keys.size;
  }
  const queueSizes: Record<string, { type: string; count: number }> = {};
  for (const key of ['battle:online:matches','battle:online:deadlines','battle:online:deadline-claims','battle:online:resolving',
    'battle:online:waiting','battle:online:waiting-claims','battle:resolution:task:pending','battle:terminal:outbox:pending',
    'battle:terminal:cleanup:pending','battle:replay:archive:pending','battle:replay:archive:unconfirmed']) {
    const type = await redis.type(key);
    const count = type === 'set' ? await redis.scard(key) : type === 'zset' ? await redis.zcard(key) : type === 'list' ? await redis.llen(key) : type === 'none' ? 0 : -1;
    queueSizes[key] = { type, count };
  }
  console.log(JSON.stringify({ redisKeyCounts: keyCounts, legacyBattleQueues: queueSizes }));
} finally { redis.disconnect(); }
const servers = process.env.NATS_SERVERS?.split(',').map(x=>x.trim()).filter(Boolean);
if (!servers?.length) throw new Error('NATS_SERVERS is required');
const nc = await connect({ servers, user: process.env.NATS_USER, pass: process.env.NATS_PASSWORD, timeout: 5000, maxReconnectAttempts: 0 });
try {
  const manager = await nc.jetstreamManager();
  const streams: unknown[] = [];
  for await (const stream of manager.streams.list()) {
    const consumers: unknown[] = [];
    for await (const consumer of manager.consumers.list(stream.config.name)) {
      consumers.push({ name: consumer.name, pending: consumer.num_pending, ackPending: consumer.num_ack_pending, redelivered: consumer.num_redelivered });
    }
    streams.push({ name: stream.config.name, storedMessages: stream.state.messages, consumers });
  }
  console.log(JSON.stringify({ nats: streams }));
} finally { await nc.close(); }
