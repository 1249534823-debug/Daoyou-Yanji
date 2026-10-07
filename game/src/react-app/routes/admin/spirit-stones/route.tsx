import type {
  SpiritStoneDailyResult,
  SpiritStoneLedgerResult,
} from '@shared/contracts/spiritStoneStatistics';
import { useState, type FormEvent } from 'react';
import { AdminButton } from '../_components/AdminButton';
import { AdminDrawer } from '../_components/AdminDrawer';
import { AdminSection } from '../_components/AdminSection';
import './statistics.css';
import {
  amount,
  beijingDay,
  changeDay,
  moment,
  useStatistics,
} from './useStatistics';

function Paging({
  page,
  total,
  pageSize,
  loading,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="stone-paging" aria-label="统计分页">
      <span>
        共 {total} 条 · 第 {page} / {pages} 页
      </span>
      <div>
        <AdminButton
          disabled={loading || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </AdminButton>
        <AdminButton
          disabled={loading || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </AdminButton>
      </div>
    </nav>
  );
}

function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="stone-error">
      <p>{message}</p>
      <AdminButton onClick={retry}>重新加载</AdminButton>
    </div>
  );
}

function Ledger({ id, date }: { id: string; date: string }) {
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const query = new URLSearchParams({
    date,
    cultivatorId: id,
    page: String(page),
    pageSize: '20',
  });
  const { data, error, loading } = useStatistics<SpiritStoneLedgerResult>(
    '/api/admin/spirit-stones/ledger?' + query,
    revision,
  );
  return (
    <div className="stone-ledger">
      <p className="stone-hint">{date} · 北京时间 · 按最新记录在前排列</p>
      {loading && (
        <p role="status" className="admin-empty">
          正在读取收支明细…
        </p>
      )}
      {error && (
        <Failure message={error} retry={() => setRevision((x) => x + 1)} />
      )}
      {data && !data.player && (
        <p className="admin-empty">该玩家已不存在，所选日期也没有留存记录。</p>
      )}
      {data && data.player && (
        <>
          <div className="admin-readout">
            <strong>{data.player.name}</strong>
            <p className="stone-hint">
              {data.player.realm} · {data.player.stage}
              {data.player.deleted ? ' · 角色已删除' : ''}
            </p>
            <p>
              当前余额：
              {data.player.currentBalance === null
                ? '—'
                : amount(data.player.currentBalance)}{' '}
              灵石
            </p>
          </div>
          <p className="stone-hint">
            正数为收入，负数为支出。奖励实际领取后计入；失败或回滚的操作不计入。
          </p>
          {data.entries.length === 0 ? (
            <p className="admin-empty">该玩家当天暂无已记录的灵石变动。</p>
          ) : (
            <ol className="stone-entry-list">
              {data.entries.map((entry) => (
                <li key={entry.id}>
                  <div className="stone-entry-top">
                    <strong>{entry.sourceLabel}</strong>
                    <strong
                      className={
                        entry.delta > 0 ? 'stone-income' : 'stone-expense'
                      }
                    >
                      {entry.delta > 0 ? '+' : ''}
                      {amount(entry.delta)}
                    </strong>
                  </div>
                  <time dateTime={entry.occurredAt}>
                    {moment(entry.occurredAt)}
                  </time>
                  <dl>
                    <div>
                      <dt>变动前余额</dt>
                      <dd>{amount(entry.balanceBefore)}</dd>
                    </div>
                    <div>
                      <dt>变动后余额</dt>
                      <dd>{amount(entry.balanceAfter)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
          )}
          <Paging
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            loading={loading}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function SpiritStoneStatisticsPage() {
  const today = beijingDay();
  const [dateDraft, setDateDraft] = useState(today),
    [nameDraft, setNameDraft] = useState('');
  const [filters, setFilters] = useState({ date: today, q: '', page: 1 });
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    date: string;
  } | null>(null);
  const query = new URLSearchParams({
    date: filters.date,
    q: filters.q,
    page: String(filters.page),
    pageSize: '20',
  });
  const { data, error, loading, loadedAt } =
    useStatistics<SpiritStoneDailyResult>(
      '/api/admin/spirit-stones/daily?' + query,
      revision,
    );
  const beforeTracking = data
    ? filters.date <
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(data.trackingStartedAt))
    : false;
  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters({ date: dateDraft, q: nameDraft.trim(), page: 1 });
    setRevision((x) => x + 1);
  }
  function navigateDay(date: string) {
    setDateDraft(date);
    setNameDraft(filters.q);
    setFilters((previous) => ({ ...previous, date, page: 1 }));
  }
  return (
    <div className="admin-form-page stone-statistics">
      <header className="admin-page-heading">
        <h2>灵石收支</h2>
        <p>每位玩家独立记账，查看每日收入、支出与净变化。</p>
      </header>
      <AdminSection
        title="查询条件"
        description="每天按北京时间 00:00 至次日 00:00 统计。"
        icon="monitor"
      >
        <form onSubmit={apply} className="stone-filter">
          <label htmlFor="stone-date">
            <span>统计日期</span>
            <input
              id="stone-date"
              type="date"
              required
              max={today}
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
            />
          </label>
          <label htmlFor="stone-name">
            <span>玩家名称</span>
            <input
              id="stone-name"
              type="search"
              maxLength={100}
              placeholder="输入玩家名称，留空查看全部"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
          </label>
          <AdminButton
            type="submit"
            variant="primary"
            pending={loading}
            pendingLabel="查询中…"
          >
            查询统计
          </AdminButton>
        </form>
        <div className="stone-day-controls">
          <AdminButton
            disabled={loading}
            onClick={() => navigateDay(changeDay(filters.date, -1))}
          >
            前一天
          </AdminButton>
          <AdminButton
            disabled={loading || filters.date >= today}
            onClick={() => navigateDay(changeDay(filters.date, 1))}
          >
            后一天
          </AdminButton>
          <AdminButton
            disabled={loading}
            onClick={() => {
              navigateDay(today);
              setRevision((x) => x + 1);
            }}
          >
            今天
          </AdminButton>
          <AdminButton
            disabled={loading}
            onClick={() => setRevision((x) => x + 1)}
          >
            刷新
          </AdminButton>
        </div>
      </AdminSection>
      {error && (
        <Failure message={error} retry={() => setRevision((x) => x + 1)} />
      )}
      <AdminSection
        title="当日汇总"
        description={
          filters.date +
          (filters.q ? ' · 名称包含“' + filters.q + '”的玩家' : ' · 全部玩家')
        }
      >
        <div className="stone-summary" aria-busy={loading}>
          {[
            ['收入灵石', data?.summary.income, 'stone-income'],
            ['支出灵石', data?.summary.expense, 'stone-expense'],
            ['净变化', data?.summary.net, ''],
          ].map(([label, value, cls]) => (
            <div className="admin-readout" key={label}>
              <span>{label}</span>
              <strong className={cls}>
                {value === undefined ? '—' : amount(value)}
              </strong>
            </div>
          ))}
        </div>
        <p className="stone-hint">
          {data
            ? '有收支玩家 ' +
              data.summary.activePlayers +
              ' 人 · 已记录 ' +
              data.summary.transactionCount +
              ' 笔 · 刷新于 ' +
              moment(loadedAt)
            : loading
              ? '正在加载统计…'
              : '数据未加载，请重试。'}
        </p>
        {data && (
          <div className="stone-coverage" role="note">
            {beforeTracking
              ? '所选日期尚未启用记录，无法还原历史收支。'
              : data.partialDay
                ? '当天为启用首日，只包含启用后的收支，并非全天数据。'
                : '只统计已成功入账的灵石变动；当前余额不代表所选日期的日终余额。'}
            <span>
              记录开始于 {moment(data.trackingStartedAt)}，此前历史不补算。
            </span>
          </div>
        )}
      </AdminSection>
      <AdminSection
        title="玩家每日收支"
        description="按名称查找玩家，点击明细查看每笔变动。"
        icon="users"
      >
        {loading && (
          <p className="admin-empty" role="status">
            正在查询玩家收支…
          </p>
        )}
        {!loading &&
          data &&
          (data.players.length === 0 ? (
            <p className="admin-empty">
              {beforeTracking
                ? '该日期没有可查询的记录。'
                : filters.q
                  ? '没有找到匹配的玩家，请换个名称搜索。'
                  : '暂无玩家记录。'}
            </p>
          ) : (
            <div className="admin-results-scroll">
              <table className="admin-responsive-list stone-table">
                <thead>
                  <tr>
                    <th scope="col">玩家</th>
                    <th scope="col">收入</th>
                    <th scope="col">支出</th>
                    <th scope="col">净变化</th>
                    <th scope="col">笔数</th>
                    <th scope="col">当前余额</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((player) => (
                    <tr key={player.cultivatorId}>
                      <td data-label="玩家">
                        <div>
                          <strong>{player.name}</strong>
                          <small>
                            {player.realm} · {player.stage}
                            {player.deleted ? ' · 已删除' : ''}
                          </small>
                          <small>标识 {player.cultivatorId.slice(-6)}</small>
                        </div>
                      </td>
                      <td data-label="收入" className="stone-income">
                        {amount(player.income)}
                      </td>
                      <td data-label="支出" className="stone-expense">
                        {amount(player.expense)}
                      </td>
                      <td data-label="净变化">{amount(player.net)}</td>
                      <td data-label="笔数">{player.transactionCount}</td>
                      <td data-label="当前余额">
                        {player.currentBalance === null
                          ? '—'
                          : amount(player.currentBalance)}
                      </td>
                      <td data-label="操作">
                        <AdminButton
                          onClick={() =>
                            setSelected({
                              id: player.cultivatorId,
                              name: player.name,
                              date: filters.date,
                            })
                          }
                        >
                          查看明细
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {data && (
          <Paging
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            loading={loading}
            onChange={(page) =>
              setFilters((previous) => ({ ...previous, page }))
            }
          />
        )}
      </AdminSection>
      <AdminDrawer
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.name + ' · 收支明细' : '收支明细'}
        className="stone-detail-drawer"
      >
        {selected && (
          <Ledger
            key={selected.id + selected.date}
            id={selected.id}
            date={selected.date}
          />
        )}
      </AdminDrawer>
    </div>
  );
}
