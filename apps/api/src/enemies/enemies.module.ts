import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { EnemiesController } from './enemies.controller';
import { EnemiesService } from './enemies.service';

@Module({
  imports: [DatabaseModule],
  controllers: [EnemiesController],
  providers: [EnemiesService],
})
export class EnemiesModule {}
