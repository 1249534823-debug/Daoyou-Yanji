import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import {
  COMBAT_V6_TRAINING_CONTENT_VIEW,
  combatV6TrainingSessionStore,
} from '@server/lib/services/combat-v6/CombatV6TrainingSessionService';
import type {
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingCreateRequest,
} from '@daoyou/shared/contracts/combatV6';
import type { z } from 'zod';

@Injectable()
export class TrainingService {
  content() {
    return { success: true, data: COMBAT_V6_TRAINING_CONTENT_VIEW };
  }
  async current(actor: ActiveCultivatorRef, after: number) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.current(actor, after),
    };
  }
  async create(
    actor: ActiveCultivatorRef,
    input: CombatV6TrainingCreateRequest,
  ) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.create(
        actor,
        input.encounterId,
        input.tier,
      ),
    };
  }
  async read(actor: ActiveCultivatorRef, id: string, after: number) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.get(actor, id, after),
    };
  }
  async submit(
    actor: ActiveCultivatorRef,
    id: string,
    unitId: string,
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.submit(
        actor,
        id,
        input.expectedRevision,
        unitId,
        input.commands,
      ),
    };
  }
  async resolve(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    round?: number,
  ) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.resolve(
        actor,
        id,
        revision,
        round,
      ),
    };
  }
  async abandon(actor: ActiveCultivatorRef, id: string, revision: number) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.abandon(actor, id, revision),
    };
  }
  async trace(actor: ActiveCultivatorRef, id: string) {
    return {
      success: true,
      data: await combatV6TrainingSessionStore.trace(actor, id),
    };
  }
}
