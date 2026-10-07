import { CrossServerConfirm } from '@app/components/feature/cross-server/Confirm';
import {
  crossServerJson,
  crossServerRequest,
} from '@app/components/feature/cross-server/request';
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  CrossServerChallengeView,
  CrossServerPublicPlayer,
  CrossServerState,
} from '@daoyou/contracts/cross-server';
import { useCallback, useEffect, useRef, useState } from 'react';

const statuses = {
  sending: '等待送达',
  pending: '等待应战',
  completed: '已完成',
  declined: '已婉拒',
  cancelled: '已取消',
  expired: '已过期',
};
const outcomes = { victory: '胜利', defeat: '落败', draw: '平局' };
type Invitation = {
  peerId: string;
  player: CrossServerPublicPlayer;
  requestId: string;
};

export default function CrossServerRoute() {
  const characterId = usePlayerSession().data?.activeCultivator?.id;
  return <CrossServerPage key={characterId} />;
}
function CrossServerPage() {
  const [data, setData] = useState<CrossServerState>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'sites' | 'invites' | 'history'>('sites');
  const [peerId, setPeerId] = useState('');
  const [invite, setInvite] = useState<Invitation>();
  const [consent, setConsent] = useState<boolean>();
  const generation = useRef(0);
  const refreshSequence = useRef(0);
  const syncIndex = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++refreshSequence.current;
    const revision = generation.current;
    try {
      const state = await crossServerRequest<CrossServerState>(
        '/api/cross-server/state',
        { signal },
      );
      if (
        !signal?.aborted &&
        revision === generation.current &&
        sequence === refreshSequence.current
      ) {
        setData(state);
        setError('');
      }
    } catch (error) {
      if (
        !signal?.aborted &&
        revision === generation.current &&
        sequence === refreshSequence.current
      )
        setError(error instanceof Error ? error.message : '无法读取跨服状态');
    }
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const sequence = ++refreshSequence.current;
    const revision = generation.current;
    const current = () =>
      !abort.signal.aborted &&
      revision === generation.current &&
      sequence === refreshSequence.current;
    void crossServerRequest<CrossServerState>('/api/cross-server/state', {
      signal: abort.signal,
    })
      .then((state) => {
        if (current()) {
          setData(state);
          setError('');
        }
      })
      .catch((error) => {
        if (current())
          setError(error instanceof Error ? error.message : '无法读取跨服状态');
      });
    return () => abort.abort();
  }, []);

  const action = useCallback(
    async (path: string, input: unknown = {}, method = 'POST') => {
      generation.current++;
      setBusy(true);
      setError('');
      setMessage('');
      try {
        const next = await crossServerRequest<CrossServerState>(
          `/api/cross-server/${path}`,
          crossServerJson(input, method),
        );
        setData(next);
        return next;
      } catch (error) {
        setError(error instanceof Error ? error.message : '操作未完成');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    if (busy || !data?.configured) return;
    const abort = new AbortController();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const outgoing = data.challenges.filter(
        (item) =>
          item.direction === 'outgoing' &&
          ['sending', 'pending'].includes(item.status),
      );
      if (outgoing.length) {
        const item = outgoing[syncIndex.current++ % outgoing.length];
        void action(`challenges/${item.id}/sync`);
      } else void refresh(abort.signal);
    }, 10000);
    return () => {
      window.clearInterval(timer);
      abort.abort();
    };
  }, [data, busy, action, refresh]);

  const open =
    data?.challenges.filter((item) =>
      ['sending', 'pending'].includes(item.status),
    ) ?? [];
  const history =
    data?.challenges.filter(
      (item) => !['sending', 'pending'].includes(item.status),
    ) ?? [];
  return (
    <GameSceneFrame
      variant="workflow"
      description="诸界道友在此留名，邀一场不耗资源的切磋。"
    >
      <div className="space-y-5">
        {error ? (
          <div role="alert" className="text-crimson text-sm leading-6">
            {error}
            <InkButton onClick={() => void refresh()} disabled={busy}>
              重试读取
            </InkButton>
          </div>
        ) : null}
        {message ? (
          <p role="status" className="text-teal text-sm">
            {message}
          </p>
        ) : null}
        {!data ? (
          <p role="status" className="text-ink-secondary py-6">
            正在读取跨服通道……
          </p>
        ) : !data.configured ? (
          <p className="text-ink-secondary py-6 leading-7">
            跨服通道尚未开启。管理员完成站点接入后，即可在此邀战。
          </p>
        ) : (
          <>
            <div className="border-ink/10 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <p className="text-sm">
                {data.profileEnabled
                  ? '已开启跨服切磋'
                  : '开启切磋后，可向异界道友邀战。'}
              </p>
              <InkButton
                variant={data.profileEnabled ? 'secondary' : 'primary'}
                disabled={busy}
                onClick={() => setConsent(!data.profileEnabled)}
                className="min-h-11"
              >
                {data.profileEnabled ? '关闭切磋' : '开启跨服切磋'}
              </InkButton>
            </div>
            <nav
              aria-label="跨服切磋分类"
              className="border-ink/10 flex flex-wrap gap-5 border-b"
            >
              {(
                [
                  ['sites', '异界道友'],
                  ['invites', `邀战${open.length ? ` · ${open.length}` : ''}`],
                  ['history', '战报'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                  className={`min-h-11 border-b-2 px-1 text-sm ${tab === id ? 'border-crimson text-crimson font-semibold' : 'text-ink-secondary border-transparent'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'sites' ? (
              <>
                {!data.peers.length ? (
                  <p className="text-ink-secondary py-5 text-sm leading-7">
                    还没有接入其他站点。双方管理员完成互信后，异界道友便会出现在这里。
                  </p>
                ) : (
                  <>
                    <label className="block space-y-2 text-sm">
                      <span>选择站点</span>
                      <select
                        value={peerId}
                        onChange={(event) => setPeerId(event.target.value)}
                        className="border-ink/20 bg-paper min-h-11 w-full border px-3"
                      >
                        <option value="">请选择已接入的站点</option>
                        {data.peers.map((peer) => (
                          <option
                            value={peer.siteId}
                            key={peer.siteId}
                            disabled={!peer.compatible}
                          >
                            {peer.name}
                            {peer.compatible ? '' : ' · 规则不兼容'}
                          </option>
                        ))}
                      </select>
                    </label>
                    {peerId ? (
                      <RemoteDirectory
                        key={peerId}
                        peerId={peerId}
                        enabled={data.profileEnabled && !busy}
                        onInvite={(player) =>
                          setInvite({
                            peerId,
                            player,
                            requestId: crypto.randomUUID(),
                          })
                        }
                      />
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <div className="divide-ink/10 divide-y">
                {(tab === 'invites' ? open : history).length === 0 ? (
                  <p className="text-ink-secondary py-6 text-sm">
                    {tab === 'invites' ? '暂无待处理邀战。' : '尚无跨服战报。'}
                  </p>
                ) : null}
                {(tab === 'invites' ? open : history).map((item) => (
                  <ChallengeRow
                    key={item.id}
                    item={item}
                    busy={busy}
                    onAction={(kind) =>
                      void action(`challenges/${item.id}/${kind}`)
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {consent !== undefined ? (
        <CrossServerConfirm
          title={consent ? '开启跨服切磋' : '关闭跨服切磋'}
          pending={busy}
          onClose={() => setConsent(undefined)}
          onConfirm={() => {
            void action('profile', { enabled: consent }, 'PATCH').then(
              (next) => {
                if (next) setConsent(undefined);
              },
            );
          }}
        >
          <p>
            {consent
              ? '角色名、境界和出战构筑会提供给已信任的接入站点，用于目录展示和战斗复算。账号、登录会话和个人资产仍由本站管理。'
              : '关闭后不再进入对站道友目录，尚未接受的邀战将被婉拒。已完成的战报会保留。'}
          </p>
          {consent ? (
            <p>
              每场切磋都需双方同意，以各自提交时的构筑自动斗法，不扣除角色资源。
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-crimson">
              {error}
            </p>
          ) : null}
        </CrossServerConfirm>
      ) : null}
      {invite ? (
        <CrossServerConfirm
          title={`向 ${invite.player.name} 邀战`}
          pending={busy}
          onClose={() => setInvite(undefined)}
          onConfirm={() => {
            void action('challenges', {
              requestId: invite.requestId,
              peerId: invite.peerId,
              targetId: invite.player.id,
            }).then((next) => {
              if (next) {
                setInvite(undefined);
                setTab('invites');
                setMessage('邀战已保留，对方确认后即可查看战报。');
              }
            });
          }}
        >
          <p>
            {invite.player.realm} · {invite.player.realmStage}
            。对方接受后，将使用你现在的构筑自动切磋；邀战有效期为 15 分钟。
          </p>
          <p>切磋不扣除资源，也不跨站转移物品。</p>
          {error ? (
            <p role="alert" className="text-crimson">
              {error}
            </p>
          ) : null}
        </CrossServerConfirm>
      ) : null}
    </GameSceneFrame>
  );
}

function RemoteDirectory({
  peerId,
  enabled,
  onInvite,
}: {
  peerId: string;
  enabled: boolean;
  onInvite: (player: CrossServerPublicPlayer) => void;
}) {
  const [players, setPlayers] = useState<CrossServerPublicPlayer[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void crossServerRequest<{
      players: CrossServerPublicPlayer[];
      nextCursor: string | null;
    }>(
      `/api/cross-server/peers/${peerId}/players${cursor ? `?cursor=${cursor}` : ''}`,
      { signal: abort.signal },
    )
      .then((value) => {
        if (!abort.signal.aborted) {
          setPlayers((old) =>
            cursor
              ? [
                  ...old,
                  ...value.players.filter(
                    (p) => !old.some((o) => o.id === p.id),
                  ),
                ]
              : value.players,
          );
          setNext(value.nextCursor);
          setError('');
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setError(error instanceof Error ? error.message : '读取失败');
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [peerId, cursor, attempt]);
  return (
    <div aria-busy={loading}>
      {error ? (
        <p role="alert" className="text-crimson py-4 text-sm">
          {error}
          <InkButton
            onClick={() => {
              setLoading(true);
              setAttempt((v) => v + 1);
            }}
            disabled={loading}
          >
            重试
          </InkButton>
        </p>
      ) : null}
      {!loading && !error && !players.length ? (
        <p className="text-ink-secondary py-5 text-sm">
          此站暂无开启切磋的道友。
        </p>
      ) : null}
      <ul className="divide-ink/10 divide-y">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div className="min-w-0">
              <p className="font-semibold break-all">{player.name}</p>
              <p className="text-ink-secondary mt-1 text-sm">
                {player.realm} · {player.realmStage}
              </p>
            </div>
            <InkButton
              variant="primary"
              disabled={!enabled}
              onClick={() => onInvite(player)}
              className="min-h-11"
            >
              邀战
            </InkButton>
          </li>
        ))}
      </ul>
      {loading ? (
        <p role="status" className="text-ink-secondary py-4 text-sm">
          正在联络对站……
        </p>
      ) : null}
      {next && !loading && !error ? (
        <InkButton
          onClick={() => {
            setLoading(true);
            setCursor(next);
          }}
        >
          更多道友
        </InkButton>
      ) : null}
    </div>
  );
}
function ChallengeRow({
  item,
  busy,
  onAction,
}: {
  item: CrossServerChallengeView;
  busy: boolean;
  onAction: (kind: string) => void;
}) {
  return (
    <article className="space-y-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 font-semibold break-all">
          {item.opponentName}
          <span className="text-ink-secondary ml-2 text-sm font-normal">
            {item.peerName}
          </span>
        </p>
        <span
          className={
            item.outcome === 'victory'
              ? 'text-teal text-sm'
              : 'text-ink-secondary text-sm'
          }
        >
          {item.outcome ? outcomes[item.outcome] : statuses[item.status]}
        </span>
      </div>
      <p className="text-ink-secondary text-xs leading-6">
        {item.direction === 'incoming' ? '对方向你邀战' : '你向对方邀战'} ·{' '}
        {new Date(item.createdAt).toLocaleString('zh-CN')}
        {item.roundCount ? ` · ${item.roundCount} 回合` : ''}
      </p>
      {item.lastError ? (
        <p className="text-crimson text-sm leading-6">{item.lastError}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {item.direction === 'incoming' && item.status === 'pending' ? (
          <>
            <InkButton
              variant="primary"
              disabled={busy}
              onClick={() => onAction('accept')}
              className="min-h-11"
            >
              接受切磋
            </InkButton>
            <InkButton
              disabled={busy}
              onClick={() => onAction('decline')}
              className="min-h-11"
            >
              婉拒
            </InkButton>
          </>
        ) : null}
        {item.direction === 'outgoing' &&
        ['sending', 'pending'].includes(item.status) ? (
          <>
            <InkButton
              disabled={busy}
              onClick={() => onAction('sync')}
              className="min-h-11"
            >
              同步状态
            </InkButton>
            {item.status === 'pending' ? (
              <InkButton
                disabled={busy}
                onClick={() => onAction('cancel')}
                className="min-h-11"
              >
                取消邀战
              </InkButton>
            ) : null}
          </>
        ) : null}
        {item.status === 'completed' ? (
          <InkButton
            href={`/game/cross-server/replay/${item.id}`}
            variant="primary"
            className="min-h-11"
          >
            查看战报
          </InkButton>
        ) : null}
      </div>
    </article>
  );
}
