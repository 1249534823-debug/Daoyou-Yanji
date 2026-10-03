import { Module } from '@nestjs/common';
import { BeastsController } from './beasts.controller';
import { BeastsService } from './beasts.service';

@Module({ controllers: [BeastsController], providers: [BeastsService] })
export class BeastsModule {}
