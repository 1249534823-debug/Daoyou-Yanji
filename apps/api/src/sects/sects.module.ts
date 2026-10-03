import { Module } from '@nestjs/common';
import { SectCombatController } from './sect-combat.controller';
import { SectCombatService } from './sect-combat.service';
import { SectOrganizationService } from './sect-organization.service';
import { SectSocialController } from './sect-social.controller';
import { SectSocialService } from './sect-social.service';
import { SectsController } from './sects.controller';
import { SectsService } from './sects.service';

@Module({
  controllers: [SectsController, SectCombatController, SectSocialController],
  providers: [
    SectsService,
    SectCombatService,
    SectOrganizationService,
    SectSocialService,
  ],
})
export class SectsModule {}
