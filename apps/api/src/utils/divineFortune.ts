import { renderPrompt } from '@server/lib/prompts/index.js';

export { type DivineFortune } from '@daoyou/game-domain/divination/fortune';
export { getRandomFallbackFortune } from '@daoyou/game-rules/divination/fortune';

export function getDivineFortunePrompt(): [string, string] {
  const { system, user } = renderPrompt('divine-fortune');
  return [system, user];
}
