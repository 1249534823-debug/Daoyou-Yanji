import { Module } from '@nestjs/common';
import {
  GenerateCharacterController,
  GenerateFatesController,
  SaveCharacterController,
} from './genesis.controller';
import { GenesisService } from './genesis.service';
@Module({
  controllers: [
    GenerateCharacterController,
    GenerateFatesController,
    SaveCharacterController,
  ],
  providers: [GenesisService],
})
export class GenesisModule {}
