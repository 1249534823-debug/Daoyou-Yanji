import { Module } from '@nestjs/common';
import {
  BlackMarketConversationService,
  blackMarketConversationService,
} from '@server/black-market/application/BlackMarketConversationService';
import { BlackMarketController } from './black-market.controller';
import { BlackMarketService } from './black-market.service';

@Module({
  controllers: [BlackMarketController],
  providers: [
    {
      provide: BlackMarketConversationService,
      useValue: blackMarketConversationService,
    },
    BlackMarketService,
  ],
})
export class BlackMarketModule {}
