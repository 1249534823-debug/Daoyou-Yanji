import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import {
  InventoryActionSchema,
  InventoryQuerySchema,
} from '@daoyou/shared/contracts/inventory';
import type { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access';
import { CombatErrors } from '../combat/combat-errors';
import { FirstQuery } from '../http/first-query';
import { JsonBody } from '../http/json-body';
import { ZodPipe } from '../http/zod.pipe';
import { InventoryService } from './inventory.service';

@Controller('api/combat-v6/inventory')
@Access('active')
@UseFilters(CombatErrors)
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(InventoryQuerySchema))
    query: z.infer<typeof InventoryQuerySchema>,
  ) {
    return this.inventory.read(actor.cultivatorId, query);
  }

  @Post()
  @HttpCode(200)
  mutate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(InventoryActionSchema))
    action: z.infer<typeof InventoryActionSchema>,
  ) {
    return this.inventory.mutate(actor.cultivatorId, action);
  }
}
