import type { CompiledTowerEncounter } from '@daoyou/game-domain/tower/encounter';
import type { TowerSeasonMeta } from '@daoyou/game-domain/tower/state';
import type { TowerEnemyPreview } from '@daoyou/game-domain/tower/preview';
import type { RealmType } from '@daoyou/constants/realms';

export interface AdminTowerWeekSummary {
  seasonKey: string;
  schemaVersion: number;
  contentVersion: string;
  generatorVersion: string;
  publishedAt: string;
}

export interface AdminTowerView {
  currentSeason: TowerSeasonMeta;
  nextSeason: TowerSeasonMeta;
  weeks: AdminTowerWeekSummary[];
  seasonKey: string;
  realm: RealmType;
  floor: number;
  fingerprint: string | null;
  published: AdminTowerWeekSummary | null;
  configuration: {
    season: TowerSeasonMeta;
    previews: TowerEnemyPreview[];
    encounter: CompiledTowerEncounter;
  } | null;
}
