import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import type { DbClient } from '@server/lib/drizzle/db';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService';
import {
  completeStoryGuideCommand,
  completeStoryPerformanceCommand,
} from '@server/story/application/StoryApplicationService';
import { StoryService as StoryDomain } from '@server/story/application/StoryService';

@Injectable()
export class StoryService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  read(actor: ActiveCultivatorRef) {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'player.story',
      (tx) => StoryDomain.read(actor.cultivatorId, tx),
      this.database,
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
