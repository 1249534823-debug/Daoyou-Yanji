import Link from '@app/components/router/AppLink';
import { useEffect, useRef, useState } from 'react';
import { AdminIcon, type AdminIconName } from './_components/AdminIcon';
import { adminNavItems } from './_config/nav';

const metrics = [
  {
    label: '总账号',
    href: '/admin/accounts',
    url: '/api/admin/accounts?limit=1&page=1',
    icon: 'users' as const,
    value: (data: { data?: { total?: number } }) => data.data?.total,
    hint: '查看与管理玩家账号',
  },
  {
    label: '当前在线',
    href: '/admin/online-users',
    url: '/api/admin/online-users',
    icon: 'monitor' as const,
    value: (data: { data?: { currentOnline?: number } }) =>
      data.data?.currentOnline,
    hint: '查看在线人数与峰值',
  },
  {
    label: '待处理反馈',
    href: '/admin/feedback',
    url: '/api/admin/feedback?status=pending&limit=1&page=1',
    icon: 'message' as const,
    value: (data: { total?: number }) => data.total,
    hint: '查看玩家提交的问题',
  },
];
const shortcuts: { href: string; icon: AdminIconName }[] = [
  { href: '/admin/accounts', icon: 'users' },
  { href: '/admin/secret-realms', icon: 'game' },
  { href: '/admin/announcement', icon: 'message' },
  { href: '/admin/broadcast/game-mail', icon: 'gift' },
];
export default function AdminOverviewPage() {
  const [values, setValues] = useState<(number | null)[]>([null, null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState('');
  const loadingRef = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let active = true;
    loadingRef.current = true;
    void Promise.allSettled(
      metrics.map(async (metric) => {
        const response = await fetch(metric.url, {
          signal: controller.signal,
          credentials: 'include',
        });
        if (!response.ok)
          throw new Error(
            response.status === 401 || response.status === 403
              ? '没有读取权限，请重新登录后确认管理员权限。'
              : '部分数据暂时无法读取，请重试。',
          );
        const value = metric.value(await response.json());
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new Error('部分数据暂时无法读取，请重试。');
        return value;
      }),
    ).then((results) => {
      if (!active) return;
      const failed = results.find((result) => result.status === 'rejected');
      setValues(
        results.map((result) =>
          result.status === 'fulfilled' ? result.value : null,
        ),
      );
      setError(
        failed?.status === 'rejected'
          ? controller.signal.aborted
            ? '读取超时，请稍后重试。'
            : failed.reason instanceof Error
              ? failed.reason.message
              : '部分数据暂时无法读取，请重试。'
          : '',
      );
      setUpdatedAt(
        new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
      setLoading(false);
      loadingRef.current = false;
      window.clearTimeout(timeout);
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [revision]);
  const refresh = () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setRevision((value) => value + 1);
  };
  return (
    <div className="admin-overview">
      <div className="admin-page-heading">
        <div>
          <h2>运营总览</h2>
          <p>
            万界道友•衍极界 · 今日管理从这里开始
            {updatedAt && ` · ${updatedAt} 更新`}
          </p>
        </div>
        <button
          className="admin-btn"
          type="button"
          onClick={refresh}
          disabled={loading}
        >
          <AdminIcon name="refresh" />
          {loading ? '读取中' : '刷新数据'}
        </button>
      </div>
      {error && (
        <p className="admin-overview-error" role="alert">
          {error}
        </p>
      )}
      <section
        className="admin-overview-stats"
        aria-label="运营数据"
        aria-busy={loading}
      >
        {metrics.map((metric, index) => (
          <Link href={metric.href} className="admin-stat" key={metric.href}>
            <span className="admin-stat-label">
              {metric.label}
              <AdminIcon name={metric.icon} />
            </span>
            <strong className="admin-stat-number">
              {loading ? '…' : (values[index]?.toLocaleString('zh-CN') ?? '—')}
            </strong>
            <small>{metric.hint}</small>
          </Link>
        ))}
      </section>
      <section className="admin-panel admin-shortcuts">
        <h3>常用操作</h3>
        <div className="admin-shortcut-grid">
          {shortcuts.map(({ href, icon }) => {
            const item = adminNavItems.find((entry) => entry.href === href)!;
            return (
              <Link key={href} href={href}>
                <AdminIcon name={icon} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
