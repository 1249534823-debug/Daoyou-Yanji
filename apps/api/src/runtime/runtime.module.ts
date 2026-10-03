import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CombatModule } from '../combat/combat.module';
import { DatabaseModule } from '../database/database.module';
import { RequestWorkService } from '../http/request-work.service';
import { CronService } from './cron.service';
import { InternalCronController } from './internal-cron.controller';
import { InternalCronGuard } from './internal-cron.guard';
import { InternalCronService } from './internal-cron.service';
import { RuntimeService } from './runtime.service';

@Module({
  imports: [DatabaseModule, CombatModule, ScheduleModule.forRoot()],
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
