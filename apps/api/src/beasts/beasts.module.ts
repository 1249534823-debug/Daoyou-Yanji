import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { BeastsController } from './beasts.controller';
import { BeastsService } from './beasts.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BeastsController],
  providers: [BeastsService],
})
export class BeastsModule {}
