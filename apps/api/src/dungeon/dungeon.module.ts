import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { DungeonBattleController } from './dungeon-battle.controller';
import { DungeonController } from './dungeon.controller';
import { DungeonService } from './dungeon.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DungeonController, DungeonBattleController],
  providers: [DungeonService],
})
export class DungeonModule {}
