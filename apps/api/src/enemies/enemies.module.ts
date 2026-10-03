import { Module } from '@nestjs/common';
import { EnemiesController } from './enemies.controller';
import { EnemiesService } from './enemies.service';

@Module({ controllers: [EnemiesController], providers: [EnemiesService] })
export class EnemiesModule {}
