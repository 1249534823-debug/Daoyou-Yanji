import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import type { SecretRealmCombatProgress } from './SecretRealmCombat';

type Task = {
  id: string;
  player: CombatV6TrainingPlayerInput;
  seed: string;
  now: Date;
  resolve: (value: SecretRealmCombatProgress) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};

/** Separate from online battle workers: preview admission is bounded independently. */
export class SecretRealmMatcher {
  private worker?: Worker;
  private ready = false;
  private stopped = false;
  private active?: Task;
  private queue: Task[] = [];
  private startupTimer?: ReturnType<typeof setTimeout>;
  private restartTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly options: {
      workerUrl?: URL;
      queueTimeoutMs?: number;
      executionTimeoutMs?: number;
    } = {},
  ) {
    this.spawn();
  }

  health(): 'up' | 'down' {
    return !this.stopped && this.ready ? 'up' : 'down';
  }

  match(
    player: CombatV6TrainingPlayerInput,
    seed: string,
    now = new Date(),
  ): Promise<SecretRealmCombatProgress> {
    if (this.stopped)
      return Promise.reject(new Error('秘境匹配服务正在关闭，请稍后重试。'));
    if (this.queue.length >= 4)
      return Promise.reject(new Error('秘境准备人数较多，请稍后重试。'));
    return new Promise((resolve, reject) => {
      const task: Task = {
        id: crypto.randomUUID(),
        player,
        seed,
        now,
        resolve,
        reject,
      };
      task.timer = setTimeout(() => {
        const index = this.queue.indexOf(task);
        if (index < 0) return;
        this.queue.splice(index, 1);
        reject(new Error('秘境准备排队超时，请稍后重试。'));
      }, this.options.queueTimeoutMs ?? 10_000);
      this.queue.push(task);
      this.dispatch();
    });
  }

  close(): void {
    this.stopped = true;
    this.ready = false;
    clearTimeout(this.startupTimer);
    clearTimeout(this.restartTimer);
    this.worker?.terminate();
    this.worker = undefined;
    for (const task of [...this.queue, ...(this.active ? [this.active] : [])]) {
      clearTimeout(task.timer);
      task.reject(new Error('秘境匹配服务正在关闭，请稍后重试。'));
    }
    this.queue = [];
    this.active = undefined;
  }

  private spawn(): void {
    if (this.stopped) return;
    try {
      const url =
        this.options.workerUrl ??
        (import.meta.env.PROD
          ? new URL('./secret-realm-matcher.js', import.meta.url)
          : new URL(
              '../../workers/secretRealmMatcher.worker.ts',
              import.meta.url,
            ));
      const worker = new Worker(url.href, { type: 'module' });
      this.worker = worker;
      this.startupTimer = setTimeout(() => this.fail(worker), 30_000);
      worker.onmessage = (event: MessageEvent) => {
        if (this.worker !== worker || this.stopped) return;
        const data = event.data;
        if (data?.type === 'ready' && !this.ready) {
          clearTimeout(this.startupTimer);
          this.ready = true;
          this.dispatch();
          return;
        }
        const task = this.active;
        if (!task || data?.id !== task.id || typeof data.ok !== 'boolean') {
          this.fail(worker);
          return;
        }
        clearTimeout(task.timer);
        this.active = undefined;
        if (data.ok) task.resolve(data.result as SecretRealmCombatProgress);
        else
          task.reject(
            new Error(
              typeof data.error === 'string'
                ? data.error
                : '秘境匹配失败，请稍后重试。',
            ),
          );
        this.dispatch();
      };
      worker.onerror = () => this.fail(worker);
      worker.onmessageerror = () => this.fail(worker);
    } catch {
      this.ready = false;
      this.restartTimer = setTimeout(() => this.spawn(), 1_000);
    }
  }

  private fail(worker: Worker): void {
    if (this.worker !== worker) return;
    this.ready = false;
    clearTimeout(this.startupTimer);
    worker.terminate();
    this.worker = undefined;
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.reject(new Error('秘境准备中断，尚未扣除本次消耗，请重试。'));
      this.active = undefined;
    }
    if (!this.stopped)
      this.restartTimer = setTimeout(() => this.spawn(), 1_000);
  }

  private dispatch(): void {
    if (!this.ready || this.stopped || this.active || !this.worker) return;
    const task = this.queue.shift();
    if (!task) return;
    const worker = this.worker;
    clearTimeout(task.timer);
    this.active = task;
    task.timer = setTimeout(
      () => this.fail(worker),
      this.options.executionTimeoutMs ?? 20_000,
    );
    try {
      worker.postMessage({
        id: task.id,
        player: task.player,
        seed: task.seed,
        now: task.now,
      });
    } catch {
      this.fail(worker);
    }
  }
}

let matcher: SecretRealmMatcher | undefined;
export function getSecretRealmMatcher(workerUrl?: URL): SecretRealmMatcher {
  return (matcher ??= new SecretRealmMatcher({ workerUrl }));
}
export function getSecretRealmMatcherHealth(): 'up' | 'down' {
  return matcher?.health() ?? 'down';
}
export function stopSecretRealmMatcher(): void {
  matcher?.close();
}
