import { Module } from '@nestjs/common';
import { ManualsController } from './manuals.controller';
import { ManualsService } from './manuals.service';

@Module({ controllers: [ManualsController], providers: [ManualsService] })
export class ManualsModule {}
