import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AdminController } from './admin.controller';
import { AdminFeedbackService } from './feedback.service';
import { AdminItemLibraryController } from './item-library.controller';
import { AdminItemLibraryService } from './item-library.service';
import { MonitoringService } from './monitoring.service';
import { AdminRedeemCodesController } from './redeem-codes.controller';
import { AdminRedeemCodesService } from './redeem-codes.service';
import { AdminReputationShopController } from './reputation-shop.controller';
import { AdminReputationShopService } from './reputation-shop.service';
import { AdminRewardItemsController } from './reward-items.controller';
import { AdminRewardItemsService } from './reward-items.service';
import { AdminSectShopController } from './sect-shop.controller';
import { AdminSectShopService } from './sect-shop.service';
import { SettingsService } from './settings.service';
import { AdminSponsorshipController } from './sponsorship.controller';
import { AdminSponsorshipService } from './sponsorship.service';
import { AdminSystemMailsController } from './system-mails.controller';
import { AdminSystemMailsService } from './system-mails.service';
import { AdminTowerController } from './tower.controller';
import { AdminTowerService } from './tower.service';

@Module({
  controllers: [
    AdminSystemMailsController,
    AdminItemLibraryController,
    AdminRedeemCodesController,
    AdminSponsorshipController,
    AdminController,
    AccountsController,
    AdminReputationShopController,
    AdminSectShopController,
    AdminRewardItemsController,
    AdminTowerController,
  ],
  providers: [
    AdminSystemMailsService,
    AdminItemLibraryService,
    AdminRedeemCodesService,
    AdminSponsorshipService,
    AccountsService,
    SettingsService,
    MonitoringService,
    AdminFeedbackService,
    AdminReputationShopService,
    AdminSectShopService,
    AdminRewardItemsService,
    AdminTowerService,
  ],
})
export class AdminModule {}
