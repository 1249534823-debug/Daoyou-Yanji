import { getRuntimeEnvironment } from '@server/lib/config/environment';
import { ConfigurationModule } from './config/configuration.module';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { allowsLocalDevTools } from '@daoyou/shared/config/deployment';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AlchemyModule } from './alchemy/alchemy.module';
import { ArenaModule } from './arena/arena.module';
import { AuctionModule } from './auction/auction.module';
import { AuthModule } from './auth/auth.module';
import { BeastsModule } from './beasts/beasts.module';
import { BlackMarketModule } from './black-market/black-market.module';
import { CombatModule } from './combat/combat.module';
import { CommunityModule } from './community/community.module';
import { CultivatorModule } from './cultivator/cultivator.module';
import { DevToolsModule } from './dev-tools/dev-tools.module';
import { DivinationModule } from './divination/divination.module';
import { DungeonModule } from './dungeon/dungeon.module';
import { EnemiesModule } from './enemies/enemies.module';
import { EnlightenmentModule } from './enlightenment/enlightenment.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ForgingModule } from './forging/forging.module';
import { GenesisModule } from './genesis/genesis.module';
import { HealthModule } from './health/health.module';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { NotFoundModule } from './http/not-found.module';
import { RequestContextInterceptor } from './http/request-context.interceptor';
import { HuntsModule } from './hunts/hunts.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { InventoryModule } from './inventory/inventory.module';
import { LegacyItemsModule } from './legacy-items/legacy-items.module';
import { MailModule } from './mail/mail.module';
import { ManualsModule } from './manuals/manuals.module';
import { MarketModule } from './market/market.module';
import { PlayerModule } from './player/player.module';
import { RankingsModule } from './rankings/rankings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReputationShopModule } from './reputation-shop/reputation-shop.module';
import { ReshapeModule } from './reshape/reshape.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SectsModule } from './sects/sects.module';
import { SocialModule } from './social/social.module';
import { SpiritFieldModule } from './spirit-field/spirit-field.module';
import { SponsorshipModule } from './sponsorship/sponsorship.module';
import { StoryModule } from './story/story.module';
import { TasksModule } from './tasks/tasks.module';
import { TowerModule } from './tower/tower.module';

@Module({
  imports: [
    ConfigurationModule,
    ...(allowsLocalDevTools(getRuntimeEnvironment().APP_ENV, getRuntimeEnvironment().NODE_ENV)
      ? [DevToolsModule]
      : []),
    AuthModule,
    SponsorshipModule,
    GenesisModule,
    ReshapeModule,
    CommunityModule,
    EnemiesModule,
    RankingsModule,
    AccountModule,
    AdminModule,
    AuctionModule,
    BlackMarketModule,
    MarketModule,
    ReputationShopModule,
    SpiritFieldModule,
    AlchemyModule,
    EnlightenmentModule,
    ForgingModule,
    InscriptionsModule,
    ArenaModule,
    HealthModule,
    RuntimeModule,
    DivinationModule,
    RealtimeModule,
    PlayerModule,
    SocialModule,
    StoryModule,
    TasksModule,
    MailModule,
    CultivatorModule,
    FeedbackModule,
    CombatModule,
    SectsModule,
    BeastsModule,
    InventoryModule,
    LegacyItemsModule,
    ManualsModule,
    HuntsModule,
    DungeonModule,
    TowerModule,
    // Namespace authorization fallbacks must follow every concrete route.
    NotFoundModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
