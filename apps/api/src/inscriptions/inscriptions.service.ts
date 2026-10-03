import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import {
  mutateInscriptions,
  readInscriptions,
} from '@server/lib/services/InscriptionService';
import type { InscriptionRequest } from '@daoyou/shared/contracts/inscriptions';

@Injectable()
export class InscriptionsService {
  async read(actor: ActiveCultivatorRef) {
    return { success: true, data: await readInscriptions(actor) };
  }

  async mutate(actor: ActiveCultivatorRef, input: InscriptionRequest) {
    return { success: true, ...(await mutateInscriptions(actor, input)) };
  }
}
