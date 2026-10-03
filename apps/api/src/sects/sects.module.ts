import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { SectCombatController } from './sect-combat.controller';
import { SectCombatService } from './sect-combat.service';
import { sectOrganizationProvider } from './sect-organization.provider';
import { SectOrganizationService } from './sect-organization.service';
import { SectSocialController } from './sect-social.controller';
import { SectSocialService } from './sect-social.service';
import { SectsController } from './sects.controller';
import { SectsService } from './sects.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SectsController, SectCombatController, SectSocialController],
  providers: [
    sectOrganizationProvider,
    SectsService,
    SectCombatService,
    SectOrganizationService,
    SectSocialService,
  ],
})
export class SectsModule {}
