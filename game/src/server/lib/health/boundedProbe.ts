export type HealthStatus = 'up' | 'down' | 'disabled';

/** A timeout never starts another probe while the original is still pending. */
export function boundedProbe(
  probe: () => Promise<HealthStatus>,
  timeoutMs = 1_500,
  cacheMs = 500,
): () => Promise<HealthStatus> {
  let pending: Promise<HealthStatus> | undefined;
  let cached: HealthStatus = 'down';
  let expires = 0;
  return () => {
    if (pending) return pending;
    if (Date.now() < expires) return Promise.resolve(cached);
    let timer: ReturnType<typeof setTimeout>;
    let timedOut = false;
    const operation = Promise.resolve()
      .then(probe)
      .catch(() => 'down' as const);
    pending = Promise.race([
      operation,
      new Promise<HealthStatus>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve('down');
        }, timeoutMs);
      }),
    ]).then((status) => {
      cached = status;
      expires = Date.now() + cacheMs;
      return status;
    });
    void operation.finally(() => {
      clearTimeout(timer);
      // Clear after the race's handlers; a late success is not cached as healthy.
      void pending?.finally(() => {
        pending = undefined;
      });
      if (timedOut) expires = 0;
    });
    return pending;
  };
}
