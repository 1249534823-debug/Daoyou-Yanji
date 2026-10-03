import { Module } from '@nestjs/common';
import { TowerController } from './tower.controller';
import { TowerService } from './tower.service';

@Module({ controllers: [TowerController], providers: [TowerService] })
export class TowerModule {}
