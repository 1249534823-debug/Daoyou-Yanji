import { Injectable } from '@nestjs/common';
import {
  mutateInventory,
  readInventory,
} from '@server/lib/services/InventoryService';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import type {
  InventoryActionSchema,
  InventoryQuerySchema,
} from '@daoyou/shared/contracts/inventory';
import type { z } from 'zod';

@Injectable()
export class InventoryService {
  async read(owner: string, query: z.infer<typeof InventoryQuerySchema>) {
    if (query.location === 'bag' && query.kind === 'all' && !query.search) {
      return readResourceWithMeta(
        { kind: 'cultivator', id: owner },
        'inventory.bag',
        (tx) => readInventory(owner, query, tx),
      );
    }
    return { success: true, data: await readInventory(owner, query) };
  }

  async mutate(owner: string, action: z.infer<typeof InventoryActionSchema>) {
    return { success: true, ...(await mutateInventory(owner, action)) };
  }
}
