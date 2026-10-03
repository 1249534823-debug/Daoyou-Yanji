import { Module } from '@nestjs/common';
import { ForgingController } from './forging.controller';
import { ForgingService } from './forging.service';

@Module({ controllers: [ForgingController], providers: [ForgingService] })
export class ForgingModule {}
