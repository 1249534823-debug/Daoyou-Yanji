import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { useEffect, useRef, useState } from 'react';
import { AdminButton } from './AdminButton';

export interface AdminPlayerChoice {
  id: string;
  name: string;
  realm: string;
  stage: string;
}
export function AdminPlayerPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: AdminPlayerChoice | null;
  onChange: (value: AdminPlayerChoice | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<AdminPlayerChoice[] | null>(null),
    [searching, setSearching] = useState(false),
    [error, setError] = useState('');
  const sequence = useRef(0),
    request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      sequence.current++;
      request.current?.abort();
    },
    [],
  );
  function resetQuery(next: string) {
    sequence.current++;
    request.current?.abort();
    setSearching(false);
    setQuery(next.slice(0, 100));
    setResults(null);
    setError('');
    onChange(null);
  }
  async function search() {
    const q = query.trim();
    if (!q) {
      setError('请输入玩家名称');
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++sequence.current;
    setSearching(true);
    setError('');
    setResults(null);
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(
        '/api/admin/players?q=' + encodeURIComponent(q),
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || '搜索失败，请重试');
      if (current === sequence.current) setResults(data.data.players);
    } catch (cause) {
      if (current === sequence.current)
        setError(
          controller.signal.aborted
            ? '搜索超时，请重试'
            : cause instanceof Error
              ? cause.message
              : '搜索失败，请重试',
        );
    } finally {
      window.clearTimeout(timer);
      if (current === sequence.current) setSearching(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <InkInput
            label="搜索玩家名称"
            value={query}
            onChange={resetQuery}
            placeholder="输入玩家名称，例如：叶无垢"
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void search();
              }
            }}
          />
        </div>
        <AdminButton
          type="button"
          onClick={() => void search()}
          disabled={disabled || searching}
          pending={searching}
          pendingLabel="搜索中……"
        >
          搜索玩家
        </AdminButton>
      </div>
      {error && <InkNotice tone="danger">{error}</InkNotice>}
      {results?.length === 0 && (
        <InkNotice tone="muted">
          没有找到该名称的活跃角色，请检查名称后重试。
        </InkNotice>
      )}
      {results && results.length > 0 && (
        <div className="space-y-2" aria-label="玩家搜索结果">
          {results.map((player) => (
            <button
              type="button"
              key={player.id}
              disabled={disabled}
              className="border-ink/15 bg-paper/80 flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left"
              onClick={() => {
                onChange(player);
                setQuery(player.name);
                setResults(null);
              }}
            >
              <span className="min-w-0">
                <strong className="break-words">{player.name}</strong>
                <span className="text-ink-secondary mt-1 block text-sm">
                  {player.realm}·{player.stage} · 标识 {player.id.slice(-6)}
                </span>
              </span>
              <span className="shrink-0 text-sm">选择</span>
            </button>
          ))}
          {results.length === 20 && (
            <p className="text-ink-secondary text-sm">
              最多显示 20 位，请补充名称缩小搜索范围。
            </p>
          )}
        </div>
      )}
      {value && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-700/30 bg-emerald-50 p-3 text-sm">
          <p>
            已选玩家：<strong>{value.name}</strong> · {value.realm}
            {value.stage}
          </p>
          <AdminButton
            type="button"
            disabled={disabled}
            onClick={() => resetQuery('')}
          >
            重新选择
          </AdminButton>
        </div>
      )}
    </div>
  );
}
