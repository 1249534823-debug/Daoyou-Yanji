import { CrossServerConfirm } from '@app/components/feature/cross-server/Confirm';
import {
  crossServerJson,
  crossServerRequest,
} from '@app/components/feature/cross-server/request';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import type {
  CrossServerManifest,
  CrossServerPeerView,
} from '@shared/contracts/crossServer';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';

type AdminState = {
  configured: boolean;
  manifest: CrossServerManifest | null;
  peers: CrossServerPeerView[];
};
type Inspected = {
  manifest: CrossServerManifest;
  fingerprint: string;
  compatible: boolean;
};

export default function CrossServerAdminRoute() {
  const [data, setData] = useState<AdminState>();
  const [url, setUrl] = useState('');
  const [inspected, setInspected] = useState<Inspected>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void crossServerRequest<AdminState>('/api/admin/cross-server', {
      signal: abort.signal,
    })
      .then((state) => {
        if (!abort.signal.aborted) {
          setData(state);
          setError('');
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setError(error instanceof Error ? error.message : '读取失败');
      });
    return () => abort.abort();
  }, [attempt]);
  async function act(path: string, input: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const state = await crossServerRequest<AdminState>(
        `/api/admin/cross-server/${path}`,
        crossServerJson(input, method),
      );
      setData(state);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="跨服接入"
        description="核验站点身份，建立双向互信，开放跨服切磋。"
      />
      {error ? (
        <p role="alert" className="text-crimson text-sm leading-7">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-teal text-sm">
          {message}
        </p>
      ) : null}
      {!data ? (
        <div>
          <p role="status" className="text-ink-secondary">
            正在读取接入配置……
          </p>
          {error ? (
            <InkButton onClick={() => setAttempt((n) => n + 1)}>重试</InkButton>
          ) : null}
        </div>
      ) : !data.configured ? (
        <div className="border-ink/10 border-b py-4 text-sm leading-7">
          <p>本站尚未配置跨服身份。</p>
          <p className="text-ink-secondary">
            请按项目的跨服接入文档配置站点 ID、接入地址与签名密钥，重启 API
            后刷新此页。
          </p>
          <InkButton onClick={() => setAttempt((n) => n + 1)}>
            刷新配置
          </InkButton>
        </div>
      ) : (
        <>
          <section
            aria-label="本站接入信息"
            className="border-ink/10 space-y-4 border-b pb-5"
          >
            <h2 className="font-semibold">本站接入信息</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
              <dt className="text-ink-secondary">站点名称</dt>
              <dd>{data.manifest!.name}</dd>
              <dt className="text-ink-secondary">站点 ID</dt>
              <dd className="font-mono text-xs leading-6 break-all">
                {data.manifest!.siteId}
              </dd>
              <dt className="text-ink-secondary">接入地址</dt>
              <dd className="break-all">{data.manifest!.apiBaseUrl}</dd>
              <dt className="text-ink-secondary">战斗规则</dt>
              <dd className="font-mono text-xs leading-6 break-all">
                {data.manifest!.combatHash}
              </dd>
            </dl>
            <InkButton
              onClick={() => {
                void navigator.clipboard
                  .writeText(JSON.stringify(data.manifest, null, 2))
                  .then(() => setMessage('本站公开接入信息已复制。'))
                  .catch(() =>
                    setError('复制失败，请从下方展开的公开信息中复制。'),
                  );
              }}
            >
              复制公开接入信息
            </InkButton>
            <details className="text-sm">
              <summary className="text-ink-secondary min-h-11 cursor-pointer leading-11">
                查看公开接入信息
              </summary>
              <pre className="bg-ink/3 mt-2 overflow-auto p-3 text-xs leading-6 break-all whitespace-pre-wrap">
                {JSON.stringify(data.manifest, null, 2)}
              </pre>
            </details>
          </section>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              setMessage('');
              void crossServerRequest<Inspected>(
                '/api/admin/cross-server/inspect',
                crossServerJson({ url: url.trim() }),
              )
                .then(setInspected)
                .catch((error) =>
                  setError(error instanceof Error ? error.message : '读取失败'),
                )
                .finally(() => setBusy(false));
            }}
          >
            <InkInput
              label="对站接入地址"
              type="url"
              value={url}
              onChange={setUrl}
              placeholder="https://对站域名/api/cross-server/v1"
              hint="向对方管理员获取接入地址和公钥指纹。"
            />
            <InkButton
              type="submit"
              variant="primary"
              pending={busy}
              disabled={!url.trim()}
            >
              读取对站信息
            </InkButton>
          </form>
          <section aria-label="已登记站点" className="space-y-3">
            <h2 className="font-semibold">已登记站点</h2>
            {!data.peers.length ? (
              <p className="text-ink-secondary py-3 text-sm">
                尚未登记其他站点。
              </p>
            ) : null}
            <div className="divide-ink/10 divide-y">
              {data.peers.map((peer) => (
                <article key={peer.siteId} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 font-semibold break-all">
                      {peer.name}
                    </h3>
                    <span className="text-ink-secondary text-sm">
                      {peer.enabled ? '已启用' : '已关闭'} ·{' '}
                      {peer.compatible ? '规则兼容' : '规则不兼容'}
                    </span>
                  </div>
                  <p className="text-ink-secondary text-sm break-all">
                    {peer.apiBaseUrl}
                  </p>
                  <p className="font-mono text-xs leading-6 break-all">
                    <span className="font-sans">公钥指纹：</span>
                    {peer.fingerprint}
                  </p>
                  {peer.checkedAt ? (
                    <p className="text-ink-secondary text-xs">
                      上次检查：
                      {new Date(peer.checkedAt).toLocaleString('zh-CN')}
                    </p>
                  ) : null}
                  {peer.lastError ? (
                    <p className="text-crimson text-sm leading-6">
                      {peer.lastError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <InkButton
                      disabled={busy || (!peer.enabled && !peer.compatible)}
                      variant={peer.enabled ? 'secondary' : 'primary'}
                      onClick={() =>
                        void act(
                          `peers/${peer.siteId}`,
                          { enabled: !peer.enabled },
                          'PATCH',
                        )
                      }
                    >
                      {peer.enabled ? '关闭接入' : '启用接入'}
                    </InkButton>
                    <InkButton
                      disabled={busy}
                      onClick={() => void act(`peers/${peer.siteId}/check`, {})}
                    >
                      检查双向接入
                    </InkButton>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {inspected ? (
        <CrossServerConfirm
          title="核验对站身份"
          pending={busy}
          onClose={() => setInspected(undefined)}
          onConfirm={() => {
            void act('peers', {
              manifest: inspected.manifest,
              fingerprint: inspected.fingerprint,
            }).then((ok) => {
              if (ok) {
                setInspected(undefined);
                setMessage('站点已登记。双方分别启用接入后，请检查双向接入。');
              }
            });
          }}
        >
          <p className="break-all">
            {inspected.manifest.name}
            <br />
            {inspected.manifest.apiBaseUrl}
          </p>
          <p className="font-mono text-xs break-all">{inspected.fingerprint}</p>
          <p>
            请通过站外渠道与对方管理员核对上述公钥指纹。确认后登记站点，默认关闭接入。
          </p>
          <p className={inspected.compatible ? 'text-teal' : 'text-crimson'}>
            {inspected.compatible
              ? '双方战斗规则兼容。'
              : '战斗规则不兼容，需要双方更新到相同的战斗规则版本。'}
          </p>
          {error ? (
            <p role="alert" className="text-crimson">
              {error}
            </p>
          ) : null}
        </CrossServerConfirm>
      ) : null}
    </div>
  );
}
