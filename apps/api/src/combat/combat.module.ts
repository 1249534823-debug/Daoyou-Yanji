import { Module } from '@nestjs/common';
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
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { WildController } from './wild.controller';
import { WildService } from './wild.service';

@Module({
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
    CombatActivityService,
    ReplaysService,
    TrainingService,
    WildService,
    AutoStrategyService,
    BreakthroughService,
    SectTaskBattleService,
  ],
})
export class CombatModule {}
