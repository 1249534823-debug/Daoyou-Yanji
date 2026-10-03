import { Module } from '@nestjs/common';
import { AlchemyFormulasController } from './alchemy-formulas.controller';
import { AlchemyFormulasService } from './alchemy-formulas.service';
import { CraftController } from './craft.controller';
import { CraftService } from './craft.service';

@Module({
  controllers: [AlchemyFormulasController, CraftController],
  providers: [AlchemyFormulasService, CraftService],
})
export class AlchemyModule {}
