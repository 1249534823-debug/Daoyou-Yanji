import {
  SPONSORSHIP_TIER_IDS,
  SPONSORSHIP_TIER_META,
  type SponsorshipTierId,
} from '@shared/lib/sponsorship';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminButton as InkButton } from '../_components/AdminButton';
import { AdminDisclosure, AdminSection } from '../_components/AdminSection';
import './sponsorship.css';

type TierConfig = { planId: string; minimumAmountFen: number };
type Config = {
  ordersAcceptedAfter: string | null;
  tiers: Record<SponsorshipTierId, TierConfig>;
};
type Order = {
  id: string;
  providerOrderId: string;
  resolvedTier: SponsorshipTierId | null;
  verificationStatus: string;
  fulfillmentStatus: string;
  lastErrorMessage: string | null;
  createdAt: string;
};
type OrderDetail = {
  order: Order;
  claims: {
    id: string;
    status: string;
    messageStatus: string;
    expiresAt: string;
  }[];
  records: {
    id: string;
    cultivatorId: string;
    tier: SponsorshipTierId;
    revokedAt: string | null;
  }[];
  snapshots: {
    id: string;
    source: string;
    createdAt: string;
    purgeAfter: string;
  }[];
};
type OrderFilter =
  'all' | 'attention' | 'awaiting_claim' | 'fulfilled' | 'revoked';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '请求失败');
  return data as T;
}

export default function SponsorshipAdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('');
  const [cultivatorId, setCultivatorId] = useState('');
  const [manualTier, setManualTier] =
    useState<SponsorshipTierId>('faint_light');
  const [manualSupportedAt, setManualSupportedAt] = useState('');
  const [manualPublic, setManualPublic] = useState(true);
  const [manualSendMail, setManualSendMail] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const ordersRef = useRef<HTMLDivElement>(null);
  const configChanged = useRef(false);
  const [revealedSnapshot, setRevealedSnapshot] = useState<unknown>(null);

  const load = useCallback(async () => {
    const [nextConfig, nextOrders] = await Promise.all([
      request<Config>('/api/admin/sponsorship/config'),
      request<{ orders: Order[]; total: number }>(
        `/api/admin/sponsorship/orders?page=${orderPage}&pageSize=50&filter=${orderFilter}`,
      ),
    ]);
    if (!configChanged.current) setConfig(nextConfig);
    setOrders(nextOrders.orders);
    setOrderTotal(nextOrders.total);
  }, [orderFilter, orderPage]);
  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '加载失败');
      }
    })();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    try {
      await request('/api/admin/sponsorship/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tiers: config.tiers }),
      });
      configChanged.current = false;
      await load();
      setMessage('档位映射已保存');
    } finally {
      setBusy(false);
    }
  };
  const act = async (
    orderId: string,
    action: 'retry' | 'revoke' | 'rotate-claim',
  ) => {
    if (
      action === 'revoke' &&
      !window.confirm(
        '确认撤销该订单的功德记录？此操作会重新计算角色最高档位。',
      )
    )
      return;
    setBusy(true);
    try {
      await request(`/api/admin/sponsorship/orders/${orderId}/${action}`, {
        method: 'POST',
      });
      await load();
      setMessage('操作完成');
    } finally {
      setBusy(false);
    }
  };
  const manualGrant = async () => {
    if (!window.confirm('确认向该角色手动写入历史功德？')) return;
    setBusy(true);
    try {
      await request('/api/admin/sponsorship/manual-grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cultivatorId,
          tier: manualTier,
          supportedAt: manualSupportedAt
            ? new Date(manualSupportedAt).toISOString()
            : undefined,
          publicListing: manualPublic,
          sendMail: manualSendMail,
        }),
      });
      setCultivatorId('');
      setManualSupportedAt('');
      setMessage('历史功德已手动发放');
    } finally {
      setBusy(false);
    }
  };
  const showDetail = async (orderId: string) => {
    setRevealedSnapshot(null);
    setDetail(
      await request<OrderDetail>(`/api/admin/sponsorship/orders/${orderId}`),
    );
    setDetailOpen(true);
    window.requestAnimationFrame(() => focusSection(detailRef.current));
  };
  const focusSection = (section: HTMLDivElement | null) => {
    section?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
    section?.focus({ preventScroll: true });
  };
  const revealSnapshot = async (snapshotId: string) => {
    if (!window.confirm('原始快照可能包含支付相关敏感信息，确认审计查看？'))
      return;
    const result = await request<{ snapshot: unknown }>(
      `/api/admin/sponsorship/snapshots/${snapshotId}/reveal`,
      { method: 'POST' },
    );
    setRevealedSnapshot(result.snapshot);
  };

  return (
    <div className="sponsorship-admin-page">
      <header className="admin-page-heading">
        <div>
          <h2>功德簿管理</h2>
          <p>核查赞助订单，管理档位映射与历史功德。</p>
        </div>
      </header>
      {message && (
        <p className="sponsorship-notice" role="status">
          {message}
        </p>
      )}

      <div
        ref={ordersRef}
        className="sponsorship-focus-section"
        tabIndex={-1}
        aria-label="赞助订单"
      >
        <AdminSection
          title="赞助订单"
          description={`共 ${orderTotal} 条订单 · 查看认领与履约状态`}
          icon="gift"
          actions={
            <label className="sponsorship-filter">
              <span>订单状态</span>
              <select
                className="admin-field"
                value={orderFilter}
                onChange={(event) => {
                  setOrderFilter(event.target.value as OrderFilter);
                  setOrderPage(1);
                }}
              >
                <option value="all">全部</option>
                <option value="attention">需人工关注</option>
                <option value="awaiting_claim">待认领</option>
                <option value="fulfilled">已履约</option>
                <option value="revoked">已撤销</option>
              </select>
            </label>
          }
        >
          <div className="sponsorship-table-scroll">
            <table className="sponsorship-orders-table">
              <thead>
                <tr>
                  <th scope="col">订单</th>
                  <th scope="col">档位</th>
                  <th scope="col">校验</th>
                  <th scope="col">履约</th>
                  <th scope="col">错误</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="订单" className="sponsorship-order-id">
                      {order.providerOrderId}
                    </td>
                    <td data-label="档位">
                      {order.resolvedTier
                        ? SPONSORSHIP_TIER_META[order.resolvedTier].name
                        : '-'}
                    </td>
                    <td data-label="校验">{order.verificationStatus}</td>
                    <td data-label="履约">{order.fulfillmentStatus}</td>
                    <td data-label="错误" className="sponsorship-order-error">
                      {order.lastErrorMessage ?? '-'}
                    </td>
                    <td
                      data-label="操作"
                      className="sponsorship-order-controls"
                    >
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={busy}
                        aria-expanded={
                          detailOpen && detail?.order.id === order.id
                        }
                        aria-controls="sponsorship-order-detail"
                        onClick={() =>
                          void showDetail(order.id).catch((error) =>
                            setMessage(error.message),
                          )
                        }
                      >
                        查看详情
                      </button>
                      <details className="sponsorship-order-actions">
                        <summary className="admin-btn admin-btn-quiet">
                          更多操作
                        </summary>
                        <div className="sponsorship-order-action-list">
                          <InkButton
                            variant="secondary"
                            disabled={
                              busy || order.fulfillmentStatus === 'revoked'
                            }
                            onClick={() =>
                              void act(order.id, 'retry').catch((error) =>
                                setMessage(error.message),
                              )
                            }
                          >
                            重试
                          </InkButton>
                          <InkButton
                            variant="secondary"
                            disabled={
                              busy ||
                              order.fulfillmentStatus === 'fulfilled' ||
                              order.fulfillmentStatus === 'revoked'
                            }
                            onClick={() =>
                              void act(order.id, 'rotate-claim').catch(
                                (error) => setMessage(error.message),
                              )
                            }
                          >
                            轮换认领码
                          </InkButton>
                          <InkButton
                            variant="danger"
                            disabled={
                              busy || order.fulfillmentStatus === 'revoked'
                            }
                            onClick={() =>
                              void act(order.id, 'revoke').catch((error) =>
                                setMessage(error.message),
                              )
                            }
                          >
                            撤销
                          </InkButton>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr className="sponsorship-empty-row">
                    <td colSpan={6} className="admin-empty">
                      当前筛选下暂无订单
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav className="sponsorship-pagination" aria-label="赞助订单分页">
            <InkButton
              variant="secondary"
              disabled={orderPage <= 1 || busy}
              onClick={() => setOrderPage((page) => page - 1)}
            >
              上一页
            </InkButton>
            <span>
              第 {orderPage} 页 · 共 {orderTotal} 条
            </span>
            <InkButton
              variant="secondary"
              disabled={orderPage * 50 >= orderTotal || busy}
              onClick={() => setOrderPage((page) => page + 1)}
            >
              下一页
            </InkButton>
          </nav>
        </AdminSection>
      </div>

      <div
        id="sponsorship-order-detail"
        ref={detailRef}
        className="sponsorship-focus-section"
        hidden={!detailOpen || !detail}
        tabIndex={-1}
        aria-label={
          detail ? `订单详情 ${detail.order.providerOrderId}` : '订单详情'
        }
      >
        {detail && (
          <AdminSection
            title="订单详情"
            description={`订单号：${detail.order.providerOrderId}`}
            icon="monitor"
            actions={
              <InkButton
                variant="secondary"
                onClick={() => {
                  setDetailOpen(false);
                  window.requestAnimationFrame(() =>
                    focusSection(ordersRef.current),
                  );
                }}
              >
                收起详情
              </InkButton>
            }
          >
            <div className="sponsorship-detail-grid">
              <section className="sponsorship-detail-block">
                <h4>认领记录</h4>
                {detail.claims.length ? (
                  detail.claims.map((claim) => (
                    <p key={claim.id}>
                      {claim.status} · 私信 {claim.messageStatus} ·{' '}
                      {new Date(claim.expiresAt).toLocaleString('zh-CN')}
                    </p>
                  ))
                ) : (
                  <p>无认领码</p>
                )}
              </section>
              <section className="sponsorship-detail-block">
                <h4>功德记录</h4>
                {detail.records.length ? (
                  detail.records.map((record) => (
                    <p key={record.id}>
                      {record.cultivatorId} ·{' '}
                      {SPONSORSHIP_TIER_META[record.tier].name}
                      {record.revokedAt ? ' · 已撤销' : ''}
                    </p>
                  ))
                ) : (
                  <p>无功德记录</p>
                )}
              </section>
            </div>
            <AdminDisclosure
              key={detail.order.id}
              title="原始快照"
              description="仅在排障时展开；审计查看会写入管理员审计日志。"
              className="sponsorship-snapshots"
            >
              {detail.snapshots.length ? (
                detail.snapshots.map((snapshot) => (
                  <div key={snapshot.id} className="sponsorship-snapshot-row">
                    <span>
                      {snapshot.source} ·{' '}
                      {new Date(snapshot.createdAt).toLocaleString('zh-CN')}
                    </span>
                    <InkButton
                      variant="secondary"
                      onClick={() =>
                        void revealSnapshot(snapshot.id).catch((error) =>
                          setMessage(error.message),
                        )
                      }
                    >
                      审计查看
                    </InkButton>
                  </div>
                ))
              ) : (
                <p className="sponsorship-muted">暂无原始快照</p>
              )}
              {revealedSnapshot !== null && (
                <pre className="sponsorship-snapshot-content">
                  {JSON.stringify(revealedSnapshot, null, 2)}
                </pre>
              )}
            </AdminDisclosure>
          </AdminSection>
        )}
      </div>

      <div className="sponsorship-settings">
        <AdminDisclosure
          title="档位映射"
          description="配置爱发电方案与最低金额，或测试连接。"
          icon="game"
        >
          <p className="sponsorship-muted">
            仅方案 ID 与最低金额（分）可修改，档位名称和主题固定。
          </p>
          {config?.ordersAcceptedAfter && (
            <p className="sponsorship-muted">
              自动处理起始：
              {new Date(config.ordersAcceptedAfter).toLocaleString('zh-CN')}
              （更早订单仅手动发放）
            </p>
          )}
          <div className="sponsorship-tier-grid">
            {config &&
              SPONSORSHIP_TIER_IDS.map((tier) => (
                <fieldset key={tier} className="sponsorship-tier">
                  <legend>{SPONSORSHIP_TIER_META[tier].name}</legend>
                  <label className="sponsorship-field">
                    <span>爱发电方案 ID</span>
                    <input
                      className="admin-field"
                      value={config.tiers[tier].planId}
                      placeholder="爱发电 plan_id"
                      disabled={busy}
                      onChange={(event) => {
                        configChanged.current = true;
                        setConfig({
                          ...config,
                          tiers: {
                            ...config.tiers,
                            [tier]: {
                              ...config.tiers[tier],
                              planId: event.target.value,
                            },
                          },
                        });
                      }}
                    />
                  </label>
                  <label className="sponsorship-field">
                    <span>最低金额（分）</span>
                    <input
                      className="admin-field"
                      type="number"
                      min={1}
                      value={config.tiers[tier].minimumAmountFen}
                      disabled={busy}
                      onChange={(event) => {
                        configChanged.current = true;
                        setConfig({
                          ...config,
                          tiers: {
                            ...config.tiers,
                            [tier]: {
                              ...config.tiers[tier],
                              minimumAmountFen: Number(event.target.value),
                            },
                          },
                        });
                      }}
                    />
                  </label>
                </fieldset>
              ))}
          </div>
          <div className="sponsorship-form-actions">
            <InkButton
              variant="primary"
              disabled={busy || !config}
              onClick={() =>
                void save().catch((error) => setMessage(error.message))
              }
            >
              保存映射
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void request('/api/admin/sponsorship/ping', { method: 'POST' })
                  .then(() => setMessage('爱发电连接正常'))
                  .catch((error) => setMessage(error.message))
              }
            >
              测试连接
            </InkButton>
          </div>
        </AdminDisclosure>

        <AdminDisclosure
          title="历史手动发放"
          description="为历史订单补录角色功德，发放前需确认。"
          icon="users"
        >
          <div className="sponsorship-manual-fields">
            <label className="sponsorship-field sponsorship-field-wide">
              <span>角色 UUID</span>
              <input
                className="admin-field"
                value={cultivatorId}
                onChange={(event) => setCultivatorId(event.target.value)}
                placeholder="填写需要补录的角色 UUID"
              />
            </label>
            <label className="sponsorship-field">
              <span>功德档位</span>
              <select
                className="admin-field"
                value={manualTier}
                onChange={(event) =>
                  setManualTier(event.target.value as SponsorshipTierId)
                }
              >
                {SPONSORSHIP_TIER_IDS.map((tier) => (
                  <option key={tier} value={tier}>
                    {SPONSORSHIP_TIER_META[tier].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sponsorship-field">
              <span>赞助时间</span>
              <input
                className="admin-field"
                type="datetime-local"
                value={manualSupportedAt}
                onChange={(event) => setManualSupportedAt(event.target.value)}
              />
            </label>
          </div>
          <div className="sponsorship-manual-options">
            <label>
              <input
                type="checkbox"
                checked={manualPublic}
                onChange={(event) => setManualPublic(event.target.checked)}
              />
              公开留名
            </label>
            <label>
              <input
                type="checkbox"
                checked={manualSendMail}
                onChange={(event) => setManualSendMail(event.target.checked)}
              />
              寄送谢信
            </label>
          </div>
          <div className="sponsorship-form-actions">
            <InkButton
              variant="primary"
              disabled={!cultivatorId || busy}
              onClick={() =>
                void manualGrant().catch((error) => setMessage(error.message))
              }
            >
              手动发放
            </InkButton>
          </div>
        </AdminDisclosure>
      </div>
    </div>
  );
}
