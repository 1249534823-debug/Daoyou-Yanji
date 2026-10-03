import { Module } from '@nestjs/common';
import { DungeonBattleController } from './dungeon-battle.controller';
import { DungeonController } from './dungeon.controller';
import { DungeonService } from './dungeon.service';

@Module({
  controllers: [DungeonController, DungeonBattleController],
  providers: [DungeonService],
})
export class DungeonModule {}
