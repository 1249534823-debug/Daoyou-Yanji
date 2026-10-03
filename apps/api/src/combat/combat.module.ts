import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import type { DbClient } from '@server/lib/drizzle/db';
import { CombatV6RuntimeStore } from './application/CombatV6RuntimeStore';
import { CombatV6TrainingSessionService } from './application/CombatV6TrainingSessionService';
import { AutoStrategyController } from './auto-strategy.controller';
import { AutoStrategyService } from './auto-strategy.service';
import { BreakthroughController } from './breakthrough.controller';
import { BreakthroughService } from './breakthrough.service';
import { CombatActivityController } from './combat-activity.controller';
import { CombatActivityService } from './combat-activity.service';
import {
  ReplaysController,
  SharedReplaysController,
} from './replays.controller';
import { ReplaysService } from './replays.service';
import { SectTaskBattleController } from './sect-task.controller';
import { SectTaskBattleService } from './sect-task.service';
import { TraceParamsPipe, TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { WildController } from './wild.controller';
import { WildService } from './wild.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    CombatActivityController,
    ReplaysController,
    SharedReplaysController,
    TrainingController,
    WildController,
    AutoStrategyController,
    BreakthroughController,
    SectTaskBattleController,
  ],
  providers: [
    {
      provide: CombatV6RuntimeStore,
      useFactory: () => new CombatV6RuntimeStore(),
    },
    {
      provide: CombatV6TrainingSessionService,
      useFactory: (store: CombatV6RuntimeStore, database: DbClient) =>
        new CombatV6TrainingSessionService(store, database),
      inject: [CombatV6RuntimeStore, DRIZZLE_DATABASE],
    },
    TraceParamsPipe,
    CombatActivityService,
    ReplaysService,
    TrainingService,
    WildService,
    AutoStrategyService,
    BreakthroughService,
    SectTaskBattleService,
  ],
  exports: [CombatV6TrainingSessionService],
})
export class CombatModule {}
