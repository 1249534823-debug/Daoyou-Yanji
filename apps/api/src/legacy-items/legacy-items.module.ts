import {
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import type { NextFunction, Request, Response } from 'express';
import { LegacyBattleRecordsController } from './battle-records.controller';
import { LegacyInventoryController } from './inventory.controller';
import { LegacyInventoryService } from './inventory.service';
import {
  ArtifactMigrationController,
  ManualMigrationAdminController,
  ManualMigrationController,
} from './migration.controller';
import { MigrationService } from './migration.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    LegacyBattleRecordsController,
    LegacyInventoryController,
    ProductsController,
    ArtifactMigrationController,
    ManualMigrationController,
    ManualMigrationAdminController,
  ],
  providers: [ProductsService, MigrationService, LegacyInventoryService],
})
export class LegacyItemsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply before access guards, including denied and unknown migration requests.
    consumer
      .apply((_request: Request, response: Response, next: NextFunction) => {
        response.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes(
        { path: 'api/artifact-migration{/*path}', method: RequestMethod.ALL },
        { path: 'api/manual-migration{/*path}', method: RequestMethod.ALL },
        {
          path: 'api/admin/manual-migration{/*path}',
          method: RequestMethod.ALL,
        },
      );
  }
}
