import { Module } from '@nestjs/common';
import { EnlightenmentController } from './enlightenment.controller';
import { EnlightenmentService } from './enlightenment.service';

@Module({
  controllers: [EnlightenmentController],
  providers: [EnlightenmentService],
})
export class EnlightenmentModule {}
