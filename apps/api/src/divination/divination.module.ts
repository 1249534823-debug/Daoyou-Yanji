import { Module } from '@nestjs/common';
import { DivinationController } from './divination.controller';
import { DivinationService } from './divination.service';
import { DivineFortuneController } from './divine-fortune.controller';
import { DivineFortuneService } from './divine-fortune.service';

@Module({
  controllers: [DivinationController, DivineFortuneController],
  providers: [DivinationService, DivineFortuneService],
})
export class DivinationModule {}
