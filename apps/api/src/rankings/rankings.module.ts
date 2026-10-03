import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RankingsController],
  providers: [RankingsService],
})
export class RankingsModule {}
