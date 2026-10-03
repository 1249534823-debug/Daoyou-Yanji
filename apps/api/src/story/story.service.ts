import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import {
  completeStoryGuideCommand,
  completeStoryPerformanceCommand,
} from '@server/lib/services/StoryApplicationService';
import { StoryService as StoryDomain } from '@server/lib/services/StoryService';

@Injectable()
export class StoryService {
  read(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'player.story',
      (tx) => StoryDomain.read(actor.cultivatorId, tx),
    );
  }

  async performance(
    actor: ActiveCultivatorRef,
    scriptId: string,
    outcome: string,
  ) {
    return toPlayerStateMutationResponse(
      await completeStoryPerformanceCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        scriptId,
        outcome,
      }),
    );
  }

  async guide(actor: ActiveCultivatorRef, lessonId: string) {
    return toPlayerStateMutationResponse(
      await completeStoryGuideCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        lessonId,
      }),
    );
  }
}
