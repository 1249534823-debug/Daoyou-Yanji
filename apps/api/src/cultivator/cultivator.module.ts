import { Module } from '@nestjs/common';
import { ConditionController } from './condition.controller';
import { ConditionService } from './condition.service';
import { CultivationController } from './cultivation.controller';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RetreatService } from './retreat.service';
import { YieldService } from './yield.service';

@Module({
  controllers: [
    ProfileController,
    ConditionController,
    LifecycleController,
    CultivationController,
  ],
  providers: [
    ProfileService,
    ConditionService,
    LifecycleService,
    RetreatService,
    YieldService,
  ],
})
export class CultivatorModule {}
