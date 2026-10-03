import { DatabaseModule } from '../database/database.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestWorkService } from '../http/request-work.service';
import { CronService } from './cron.service';
import { InternalCronController } from './internal-cron.controller';
import { InternalCronGuard } from './internal-cron.guard';
import { InternalCronService } from './internal-cron.service';
import { RuntimeService } from './runtime.service';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
  controllers: [InternalCronController],
  providers: [
    RuntimeService,
    RequestWorkService,
    CronService,
    InternalCronGuard,
    InternalCronService,
  ],
  exports: [RequestWorkService],
})
export class RuntimeModule {}
