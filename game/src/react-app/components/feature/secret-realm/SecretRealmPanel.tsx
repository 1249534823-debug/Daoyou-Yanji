import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { TIANLING_MAP_NODE_ID } from '@shared/config/secretRealms';
import { useEffect, useState } from 'react';

type RealmPreview = {
  id: string;
  enabled: boolean;
  usedToday: number;
  dailyLimit: number;
  rewardPreviews: {
    type: string;
    name: string;
    quantity: number;
    description?: string;
  }[];
};

export function SecretRealmPanel({
  onStart,
  isStarting,
}: {
  onStart: (id: string) => Promise<void>;
  isStarting: boolean;
}) {
  const [realm, setRealm] = useState<RealmPreview | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      setLoading(true);
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetch('/api/secret-realms', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('秘境信息暂未同步，请重试。');
        const data = (await response.json()) as { realms: RealmPreview[] };
        const current = data.realms.find((item) => item.id === 'tianling');
        if (!current || !Array.isArray(current.rewardPreviews))
          throw new Error('秘境信息暂未同步，请重试。');
        if (!disposed) {
          setRealm(current);
          setError('');
        }
      } catch {
        if (!disposed) setError('秘境信息暂未同步，请重试。');
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (!disposed) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      controller?.abort();
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [revision]);
  const exhausted = Boolean(realm && realm.usedToday >= realm.dailyLimit);
  return (
    <div className="space-y-5">
      <InkCard className="space-y-4 p-4 md:p-5">
        <p className="text-ink-secondary text-sm leading-7">
          连闯两名守卫与镇境灵君，击败全部敌人后获得通关奖励。敌手随入境时的实力匹配，离开页面后仍可回来继续。
        </p>
        {realm && (
          <p className="text-ink-secondary text-sm">
            今日挑战：{realm.usedToday} / {realm.dailyLimit}
          </p>
        )}
        {error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>{error}</p>
            <InkButton
              disabled={loading}
              onClick={() => setRevision((v) => v + 1)}
            >
              重新同步
            </InkButton>
          </div>
        ) : null}
        <InkButton
          variant="primary"
          className="min-h-11"
          pending={isStarting}
          pendingLabel="正在开启秘境……"
          disabled={
            loading || !realm || !realm.enabled || exhausted || Boolean(error)
          }
          onClick={async () => {
            try {
              await onStart(TIANLING_MAP_NODE_ID);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : '挑战启动失败，请重试。',
              );
            }
          }}
        >
          {loading
            ? '正在同步秘境'
            : !realm
              ? '秘境暂不可用'
              : !realm.enabled
                ? '暂未开放'
                : exhausted
                  ? '今日挑战已用尽'
                  : '进入天灵秘境'}
        </InkButton>
      </InkCard>
      <InkCard className="space-y-3 p-4 md:p-5">
        <h2 className="text-ink text-base font-medium">通关可得</h2>
        <p className="text-ink-secondary text-xs leading-6">
          入境后锁定本次奖励；以下为当前开放的奖品。资源按游戏规则结算，以通关所得为准。
        </p>
        {realm ? (
          realm.rewardPreviews.length ? (
            <ul className="divide-ink/10 divide-y">
              {realm.rewardPreviews.map((reward, index) => (
                <li
                  key={`${reward.type}-${index}`}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{reward.name}</span>
                    <span className="shrink-0 tabular-nums">
                      × {reward.quantity.toLocaleString()}
                    </span>
                  </div>
                  {reward.description && (
                    <p className="text-ink-secondary mt-1 text-xs leading-6 break-words">
                      {reward.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-secondary text-sm">本次暂无额外通关奖励。</p>
          )
        ) : (
          <p className="text-ink-secondary text-sm">
            {loading ? '正在查看奖品……' : '奖品暂未同步，请重试。'}
          </p>
        )}
      </InkCard>
    </div>
  );
}
