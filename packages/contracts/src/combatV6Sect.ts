import type { SectV6Cost } from '@daoyou/game-domain/sects/actions';

import type { SectCombatProgressV6 } from '@daoyou/game-domain/combat/content';

import type { SectCombatView } from '@daoyou/game-domain/sects/build';

export interface SectV6View {
  build: SectCombatView;
  progress: SectCombatProgressV6 | null;
  characterLevel: number;
  resources: SectV6Cost;
  blockedReason: string | null;
}
