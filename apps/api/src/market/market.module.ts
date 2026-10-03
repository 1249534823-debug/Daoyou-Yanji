import { Module } from '@nestjs/common';
import { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service';
import { CultivatorModule } from '@server/cultivator/cultivator.module';
import { DatabaseModule } from '@server/database/database.module';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import { InventoryModule } from '@server/inventory/inventory.module';
import type { DbClient } from '@server/lib/drizzle/db';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors';
import { PlayerStateModule } from '@server/player/player-state.module';
import { MarketPurchaseService } from './application/MarketApplicationService';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  imports: [
    DatabaseModule,
    CultivatorModule,
    InventoryModule,
    PlayerStateModule,
  ],
  controllers: [MarketController],
  providers: [
    {
      provide: MarketPurchaseService,
      useFactory: (
        facts: CultivatorQueriesService,
        commands: PlayerCommandExecutor,
        database: DbClient,
      ) => new MarketPurchaseService(facts, commands, database),
      inject: [
        CultivatorQueriesService,
        PlayerCommandExecutor,
        DRIZZLE_DATABASE,
      ],
    },
    MarketService,
  ],
})
export class MarketModule {}
