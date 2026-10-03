import { Module } from '@nestjs/common';
import { SpiritFieldController } from './spirit-field.controller';
import { SpiritFieldService } from './spirit-field.service';

@Module({
  controllers: [SpiritFieldController],
  providers: [SpiritFieldService],
})
export class SpiritFieldModule {}
