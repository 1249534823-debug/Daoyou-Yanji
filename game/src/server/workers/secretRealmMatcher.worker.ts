import { matchSecretRealmEncounters } from '../lib/services/SecretRealmCombat';

const worker = globalThis as unknown as {
 onmessage: (event: MessageEvent) => void;
 postMessage: (value: unknown) => void;
};
worker.onmessage = (event: MessageEvent) => {
  const { id, player, seed } = event.data;
  try {
    const result = matchSecretRealmEncounters(player, seed);
    worker.postMessage({ id, ok: true, result });
  } catch (error) {
    worker.postMessage({
      id,
      ok: false,
      error:
        error instanceof Error ? error.message : '秘境匹配失败，请稍后重试。',
    });
  }
};
worker.postMessage({ type: 'ready' });
