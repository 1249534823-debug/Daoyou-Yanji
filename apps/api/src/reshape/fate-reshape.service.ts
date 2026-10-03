import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import {
  confirmFateReshapeCommand,
  startFateReshapeCommand,
} from '@server/lib/services/FateReshapeApplicationService';
import { FateReshapeService as FateSessions } from '@server/lib/services/FateReshapeService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { z } from 'zod';
const ConfirmSchema = z.object({
  selectedIndices: z.array(z.number().int().nonnegative()).length(3),
});
@Injectable()
export class FateReshapeService {
  async read(actor: ActiveCultivatorRef) {
    const [session, talismanCount] = await Promise.all([
      FateSessions.getSession(actor.cultivatorId),
      FateSessions.getAvailableTalismanCount(actor.cultivatorId),
    ]);
    return { success: true, data: { session, talismanCount } };
  }
  async start(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await startFateReshapeCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
      }),
    );
  }
  async reroll(actor: ActiveCultivatorRef) {
    const session = await FateSessions.rerollSession(actor.cultivatorId);
    return { success: true, data: { session } };
  }
  async confirm(actor: ActiveCultivatorRef, input: unknown) {
    const parsed = ConfirmSchema.safeParse(input);
    if (!parsed.success)
      throw new HttpException(
        { success: false, error: '请求参数格式错误' },
        400,
      );
    return toPlayerStateMutationResponse(
      await confirmFateReshapeCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        selectedIndices: parsed.data.selectedIndices,
      }),
    );
  }
  async abandon(actor: ActiveCultivatorRef) {
    await FateSessions.abandonSession(actor.cultivatorId);
    return { success: true };
  }
}
