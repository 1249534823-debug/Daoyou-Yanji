import { InkNotice } from '@app/components/ui/InkNotice';
import { AdminButton as InkButton } from '@app/routes/admin/_components/AdminButton';
import { rewardDisplayItem } from '@shared/contracts/adminRewards';
import {
  SecretRealmRewardsSchema,
  type SecretRealmReward as RealmReward,
  type SecretRealmRewardPreview as RewardPreview,
} from '@shared/contracts/secretRealmRewards';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDrawer } from '../_components/AdminDrawer';
import { AdminSection } from '../_components/AdminSection';
import { RealmRewardsEditor } from './RealmRewardsEditor';

interface AdminSecretRealm {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: number;

  dailyLimit: number;
  rewardName: string;
  rewardDescription: string;
  rewards: RealmReward[];
  rewardPreviews?: RewardPreview[];
}

export default function SecretRealmsAdminPage() {
  const [realms, setRealms] = useState<AdminSecretRealm[] | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<AdminSecretRealm | null>(null);
  const [draftRewards, setDraftRewards] = useState<RealmReward[]>([]);
  const mounted = useRef(false);
  const saving = useRef(false);
  const request = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    if (!mounted.current || request.current || saving.current) return;
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch('/api/admin/secret-realms', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        if (mounted.current) {
          setForbidden(true);
          setRealms(null);
        }
        throw new Error(
          response.status === 401
            ? '登录已过期，请重新登录。'
            : '当前账号无权管理秘境。',
        );
      }
      if (!response.ok) throw new Error('秘境配置加载失败，请重试。');
      const data: { realms: AdminSecretRealm[] } = await response.json();
      if (mounted.current && request.current === controller) {
        setRealms(data.realms);
        setForbidden(false);
        setError('');
      }
    } catch (cause) {
      if (mounted.current && request.current === controller)
        setError(
          controller.signal.aborted
            ? '连接超时，请重新加载。'
            : cause instanceof Error
              ? cause.message
              : '配置加载失败，请重试。',
        );
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        if (mounted.current) setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initial = window.setTimeout(() => {
      void reload();
    }, 0);
    const resume = () => {
      if (!document.hidden && navigator.onLine) void reload();
    };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearTimeout(initial);
      mounted.current = false;
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      request.current?.abort();
      request.current = null;
    };
  }, [reload]);

  async function save(realm: AdminSecretRealm, rewards?: RealmReward[]) {
    if (saving.current || forbidden) return;
    const enabled = rewards ? realm.enabled : !realm.enabled;
    if (rewards) {
      const parsed = SecretRealmRewardsSchema.safeParse(rewards);
      if (!parsed.success) {
        setActionError(
          '请检查奖励数量、类型和道具选择，数量须为上限内的正整数。',
        );
        return;
      }
    }
    const confirmed =
      rewards ||
      window.confirm(
        enabled
          ? `开启${realm.name}？开启后玩家可进入探索。`
          : `关闭${realm.name}？关闭后暂停新入场，已开始的探索仍可完成并领取奖励。`,
      );
    if (!confirmed) return;
    saving.current = true;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(false);
    setPending(realm.id);
    setActionError('');
    setMessage('');
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`/api/admin/secret-realms/${realm.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          enabled,
          version: realm.version,
          ...(rewards ? { rewards } : {}),
        }),
      });
      if (response.status === 401 || response.status === 403) {
        if (mounted.current) {
          setForbidden(true);
          setRealms(null);
        }
        throw new Error('当前登录状态无权修改秘境，请重新登录管理员账号。');
      }
      if (response.status === 409) {
        if (mounted.current) setEditing(null);
        throw new Error(
          '配置已发生变化，已重新加载。请重新打开奖励面板后操作。',
        );
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          typeof detail?.error === 'string'
            ? detail.error
            : '未能保存配置，请检查奖励后重试。',
        );
      }
      if (mounted.current) {
        setMessage(
          rewards
            ? `${realm.name}奖励已保存，新入场挑战将使用新配置。`
            : `${realm.name}已${enabled ? '开启' : '关闭'}。`,
        );
        if (rewards) setEditing(null);
      }
    } catch (cause) {
      if (mounted.current)
        setActionError(
          controller.signal.aborted
            ? '暂未收到保存结果，正在重新确认秘境状态。'
            : cause instanceof Error
              ? cause.message
              : '保存失败，请重试。',
        );
    } finally {
      window.clearTimeout(timeout);
      saving.current = false;
      request.current = null;
      if (mounted.current) {
        setPending(null);
        void reload();
      }
    }
  }

  return (
    <div className="admin-form-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">秘境管理</h1>
        <InkButton
          onClick={() => void reload()}
          disabled={pending !== null}
          pending={refreshing}
          pendingLabel="刷新中……"
        >
          刷新状态
        </InkButton>
      </div>
      {error || actionError ? (
        <div role="alert">
          <InkNotice tone="warning">{error || actionError}</InkNotice>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {forbidden ? (
        <InkButton href="/login">前往登录</InkButton>
      ) : realms === null ? (
        <p role="status" className="text-ink-secondary">
          {error ? '暂未取得秘境配置。' : '正在加载秘境配置……'}
        </p>
      ) : realms.length === 0 ? (
        <AdminSection title="秘境列表">
          <p>暂无可管理的秘境。</p>
        </AdminSection>
      ) : (
        realms.map((realm) => (
          <AdminSection
            key={realm.id}
            title={realm.name}
            description={realm.description}
            icon="game"
            actions={
              <span
                className={`admin-status-badge ${realm.enabled ? 'is-enabled' : ''}`}
              >
                {realm.enabled ? '已开启' : '已关闭'}
              </span>
            }
          >
            <div className="admin-readout space-y-2 text-sm">
              <h3>通关奖励</h3>
              <ul className="space-y-2">
                {(
                  realm.rewardPreviews ??
                  realm.rewards?.map((reward) => ({
                    name:
                      reward.type === 'inventory_v1'
                        ? rewardDisplayItem(reward.inventory).name
                        : reward.type === 'item'
                          ? '道具奖励'
                          : realm.rewardName,
                    quantity: reward.quantity,
                  })) ?? [{ name: realm.rewardName, quantity: 1 }]
                ).map((reward, index) => (
                  <li key={index}>
                    {reward.name} × {reward.quantity.toLocaleString()}
                  </li>
                ))}
              </ul>
              <p className="text-ink-secondary">
                每次 {3} 关 · 每人每日 {realm.dailyLimit} 次（北京时间）
              </p>
            </div>
            <div className="admin-form-actions">
              <InkButton
                disabled={pending !== null || refreshing}
                onClick={() => {
                  setActionError('');
                  setEditing(realm);
                  setDraftRewards(
                    structuredClone(
                      realm.rewards ?? [{ type: 'tianling_pill', quantity: 1 }],
                    ),
                  );
                }}
              >
                配置通关奖励
              </InkButton>
              <InkButton
                className="min-h-11"
                variant={realm.enabled ? 'outline' : 'primary'}
                disabled={pending !== null || refreshing}
                pending={pending === realm.id}
                pendingLabel="保存中……"
                onClick={() => void save(realm)}
              >
                {realm.enabled ? '关闭秘境' : '开启秘境'}
              </InkButton>
            </div>
          </AdminSection>
        ))
      )}
      <AdminDrawer
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title="配置通关奖励"
        busy={pending !== null}
        footer={
          <div className="admin-form-actions">
            <InkButton
              disabled={pending !== null}
              onClick={() => setEditing(null)}
            >
              取消
            </InkButton>
            <InkButton
              variant="primary"
              pending={pending !== null}
              pendingLabel="保存中……"
              disabled={forbidden}
              onClick={() => editing && void save(editing, draftRewards)}
            >
              保存奖励
            </InkButton>
          </div>
        }
      >
        {actionError && (
          <div role="alert">
            <InkNotice tone="warning">{actionError}</InkNotice>
          </div>
        )}
        <RealmRewardsEditor
          value={draftRewards}
          onChange={setDraftRewards}
          disabled={pending !== null || forbidden}
        />
      </AdminDrawer>
    </div>
  );
}
