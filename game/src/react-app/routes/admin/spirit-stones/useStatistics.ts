import { useEffect, useState } from 'react';

export function useStatistics<T>(url: string, revision: number) {
  const key = url + ':' + revision;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loadedAt: string;
  }>({ key: '', data: null, error: '', loadedAt: '' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    async function load() {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401)
          throw new Error('登录已失效，请重新登录后台。');
        if (response.status === 403)
          throw new Error('当前账号没有查看统计的权限。');
        const payload = await response.json();
        if (!response.ok || !payload.success || !payload.data)
          throw new Error(payload.error || '统计加载失败，请重试。');
        if (active)
          setState({
            key,
            data: payload.data as T,
            error: '',
            loadedAt: new Date().toISOString(),
          });
      } catch (error) {
        if (active)
          setState({
            key,
            data: null,
            error: controller.signal.aborted
              ? '请求超时，请检查网络后重试。'
              : error instanceof Error
                ? error.message
                : '网络异常，请重试。',
            loadedAt: '',
          });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [url, key]);
  return state.key === key
    ? { ...state, loading: false }
    : { data: null, error: '', loadedAt: '', loading: true };
}

export function beijingDay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function changeDay(date: string, offset: number) {
  const day = new Date(date + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
export function amount(value: string | number) {
  return new Intl.NumberFormat('zh-CN').format(BigInt(value));
}
export function moment(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}
