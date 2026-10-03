import { Module } from '@nestjs/common';
import { FateReshapeController } from './fate-reshape.controller';
import { FateReshapeService } from './fate-reshape.service';
import { IdentityReshapeController } from './identity-reshape.controller';
import { IdentityReshapeService } from './identity-reshape.service';
@Module({
  controllers: [FateReshapeController, IdentityReshapeController],
  providers: [FateReshapeService, IdentityReshapeService],
})
export class ReshapeModule {}
