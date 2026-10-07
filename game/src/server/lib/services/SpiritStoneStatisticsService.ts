import { db } from '@server/lib/drizzle/db';
import {
  beijingDate,
  type SpiritStoneDailyQuery,
  type SpiritStoneDailyResult,
  type SpiritStoneLedgerQuery,
  type SpiritStoneLedgerResult,
  type SpiritStonePlayer,
} from '@shared/contracts/spiritStoneStatistics';
import { sql } from 'drizzle-orm';

function sourceLabel(source: string): string {
  if (source.startsWith('admin')) return '后台调整';
  if (source.includes('mail')) return '邮件领取';
  if (source.includes('auction')) return '拍卖交易';
  if (source.includes('recycle')) return '物品回收';
  if (source.includes('black_market')) return '黑市交易';
  if (source.includes('market')) return '坊市交易';
  if (source.includes('alchemy')) return '炼丹';
  if (source.includes('creation')) return '造物';
  if (source.includes('sect')) return '宗门事务';
  if (source.includes('bet_battle')) return '赌斗';
  if (source.includes('yield')) return '修炼收益';
  if (source.includes('task')) return '任务奖励';
  if (source.includes('dungeon') || source.includes('secret_realm'))
    return '历练秘境';
  if (source === 'character_initial') return '创角初始灵石';
  if (source.includes('recovery')) return '状态恢复';
  return '其他余额变动';
}
const zeroSummary = {
  income: '0',
  expense: '0',
  net: '0',
  transactionCount: 0,
  activePlayers: 0,
};
export async function getSpiritStoneDaily(
  query: SpiritStoneDailyQuery,
): Promise<SpiritStoneDailyResult> {
  return db.transaction(
    async (tx) => {
      const config = await tx.execute<{ startedAt: Date }>(
        sql`select started_at as "startedAt" from wanjiedaoyou_spirit_stone_tracking where id = 1`,
      );
      if (!config.rows[0]) throw new Error('灵石统计尚未初始化');
      const startedAt = new Date(config.rows[0].startedAt);
      const meta = {
        date: query.date,
        timezone: 'Asia/Shanghai' as const,
        trackingStartedAt: startedAt.toISOString(),
        partialDay: query.date === beijingDate(startedAt),
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
      };
      if (query.date < beijingDate(startedAt))
        return { ...meta, summary: zeroSummary, players: [] };
      // UNION preserves historical daily entries even if a character is deleted later.
      // Filter only by current name or the last name recorded that day; never expose account details.
      const rowsCte = sql`with players as (
      select c.id as "cultivatorId", c.name,c.realm,c.realm_stage as stage,c.status,false as deleted,c.spirit_stones as "currentBalance",
        coalesce(d.income,0)::text as income,coalesce(d.expense,0)::text as expense,
        (coalesce(d.income,0)-coalesce(d.expense,0))::text as net,coalesce(d.transaction_count,0)::integer as "transactionCount"
      from wanjiedaoyou_cultivators c left join wanjiedaoyou_spirit_stone_daily d on d.cultivator_id=c.id and d.day=${query.date}::date
      where (c.created_at is null or c.created_at < (${query.date}::date + interval '1 day' - interval '8 hours'))
      and (${query.q}='' or position(lower(${query.q}) in lower(c.name))>0)
      union all
      select d.cultivator_id,d.player_name,d.realm,d.stage,'deleted',true,null,d.income::text,d.expense::text,(d.income-d.expense)::text,d.transaction_count::integer
      from wanjiedaoyou_spirit_stone_daily d where d.day=${query.date}::date and not exists(select 1 from wanjiedaoyou_cultivators c where c.id=d.cultivator_id)
      and (${query.q}='' or position(lower(${query.q}) in lower(d.player_name))>0)
    )`;
      const totals = await tx.execute<
        SpiritStoneDailyResult['summary'] & { total: number }
      >(
        sql`${rowsCte} select count(*)::integer as total,coalesce(sum(income::numeric),0)::text as income,coalesce(sum(expense::numeric),0)::text as expense,coalesce(sum(net::numeric),0)::text as net,coalesce(sum("transactionCount"),0)::integer as "transactionCount",count(*) filter(where "transactionCount">0)::integer as "activePlayers" from players`,
      );
      const rows = await tx.execute<SpiritStoneDailyResult['players'][number]>(
        sql`${rowsCte} select * from players order by "transactionCount" desc,name,"cultivatorId" limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`,
      );
      const { total, ...summary } = totals.rows[0];
      return { ...meta, total, summary, players: rows.rows };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export async function getSpiritStoneLedger(
  query: SpiritStoneLedgerQuery,
): Promise<SpiritStoneLedgerResult> {
  return db.transaction(
    async (tx) => {
      const config = await tx.execute<{ startedAt: Date }>(
        sql`select started_at as "startedAt" from wanjiedaoyou_spirit_stone_tracking where id=1`,
      );
      if (!config.rows[0]) throw new Error('灵石统计尚未初始化');
      const startedAt = new Date(config.rows[0].startedAt);
      const players =
        await tx.execute<SpiritStonePlayer>(sql`select id as "cultivatorId",name,realm,realm_stage as stage,status,false as deleted,spirit_stones as "currentBalance" from wanjiedaoyou_cultivators where id=${query.cultivatorId}::uuid
    union all select cultivator_id,player_name,realm,stage,'deleted',true,null from wanjiedaoyou_spirit_stone_daily where cultivator_id=${query.cultivatorId}::uuid and day=${query.date}::date and not exists(select 1 from wanjiedaoyou_cultivators where id=${query.cultivatorId}::uuid) limit 1`);
      const where = sql`cultivator_id=${query.cultivatorId}::uuid and day=${query.date}::date`;
      const count = await tx.execute<{ total: number }>(
        sql`select count(*)::integer as total from wanjiedaoyou_spirit_stone_ledger where ${where}`,
      );
      const entries = await tx.execute<{
        id: string;
        occurredAt: Date;
        source: string;
        delta: number;
        balanceBefore: number;
        balanceAfter: number;
      }>(
        sql`select id::text,occurred_at as "occurredAt",source,delta,balance_before as "balanceBefore",balance_after as "balanceAfter" from wanjiedaoyou_spirit_stone_ledger where ${where} order by wanjiedaoyou_spirit_stone_ledger.id desc limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`,
      );
      return {
        date: query.date,
        timezone: 'Asia/Shanghai',
        trackingStartedAt: startedAt.toISOString(),
        partialDay: query.date === beijingDate(startedAt),
        page: query.page,
        pageSize: query.pageSize,
        total: count.rows[0].total,
        player: players.rows[0] ?? null,
        entries: entries.rows.map((row) => ({
          ...row,
          occurredAt: new Date(row.occurredAt).toISOString(),
          sourceLabel: sourceLabel(row.source),
        })),
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
