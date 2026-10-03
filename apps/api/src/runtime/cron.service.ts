import { runtimeConfig } from '../config/runtime.config';
import type { ConfigType } from '@nestjs/config';
import { Inject, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BACKGROUND_SCHEDULES } from '@server/lib/jobs/schedules';
import { publishScheduledBackgroundCommand } from '@server/lib/mq/backgroundCommandPublisher';
import { CronJob } from 'cron';

@Injectable()
export class CronService {
  constructor(
    @Inject(runtimeConfig.KEY) private readonly config: ConfigType<typeof runtimeConfig>,
    @Inject(SchedulerRegistry) private readonly scheduler: SchedulerRegistry,
  ) {}

  start(): void {
    if (this.config.NODE_ENV !== 'production') return;
    for (const { type, expression } of BACKGROUND_SCHEDULES) {
      const job = CronJob.from({
        cronTime: expression,
        onTick: async () => {
          try {
            await publishScheduledBackgroundCommand(type);
          } catch (error) {
            console.error(`[cron] publish ${type} failed`, error);
          }
        },
        start: false,
        timeZone: 'UTC',
        waitForCompletion: true,
      });
      this.scheduler.addCronJob(type, job);
      job.start();
    }
  }

  async stop(): Promise<void> {
    await Promise.all(
      [...this.scheduler.getCronJobs().values()].map((job) => job.stop()),
    );
  }
}
