import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { DungeonFlowService } from './application/flow/DungeonFlowService';
import { generateDungeonRound } from './application/flow/DungeonRoundGenerator';
import { DungeonBattleController } from './dungeon-battle.controller';
import { DungeonController } from './dungeon.controller';
import { DungeonService } from './dungeon.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DungeonController, DungeonBattleController],
  providers: [
    {
      provide: DungeonFlowService,
      useFactory: () => new DungeonFlowService(generateDungeonRound),
    },
    DungeonService,
  ],
})
export class DungeonModule {}
