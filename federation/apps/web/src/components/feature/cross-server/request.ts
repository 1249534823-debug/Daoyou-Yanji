import { apiFetch } from '@app/lib/api/fetch';

export async function crossServerRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value?.error === 'string' ? value.error : '操作未完成，请稍后重试',
    );
  return value as T;
}
export const crossServerJson = (
  value: unknown,
  method = 'POST',
): RequestInit => ({ method, body: JSON.stringify(value) });
