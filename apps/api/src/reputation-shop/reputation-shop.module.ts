import { Module } from '@nestjs/common';
import { ReputationShopController } from './reputation-shop.controller';
import { ReputationShopService } from './reputation-shop.service';

@Module({
  controllers: [ReputationShopController],
  providers: [ReputationShopService],
})
export class ReputationShopModule {}
