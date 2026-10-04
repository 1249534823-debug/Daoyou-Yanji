import type { DivineFortune } from '@daoyou/game-domain/divination/fortune';
import { FALLBACK_FORTUNES } from '@daoyou/game-content/divination/fortunes';

export function getRandomFallbackFortune(): DivineFortune {
  const index = Math.floor(Math.random() * FALLBACK_FORTUNES.length);
  return FALLBACK_FORTUNES[index];
}
