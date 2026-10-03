import { Controller, Get, Inject } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { Access, CurrentCultivator } from '../auth/access';
import { CombatActivityService } from './combat-activity.service';

@Controller('api/combat-v6/activity')
@Access('active')
export class CombatActivityController {
  constructor(
    @Inject(CombatActivityService)
    private readonly activity: CombatActivityService,
  ) {}

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.activity.read(actor.cultivatorId);
  }
}
