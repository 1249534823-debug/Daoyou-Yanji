import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { PlayerStateModule } from '@server/player/player-state.module';
import { InventoryRecycleService } from './inventory-recycle.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [DatabaseModule, PlayerStateModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRecycleService],
  exports: [InventoryRecycleService],
})
export class InventoryModule {}
