import { HttpException, Inject, Injectable } from '@nestjs/common';
import { startBreakthroughBattle } from '@server/combat/application/CombatV6BreakthroughService';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import type { DbClient } from '@server/lib/drizzle/db';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService';
import { claimTaskRewardCommand } from '@server/tasks/application/TaskApplicationService';
import { TaskService } from '@server/tasks/application/TaskService';

@Injectable()
export class TasksService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  list(actor: ActiveCultivatorRef, status?: 'active' | 'completed') {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'player.tasks',
      (tx) => TaskService.readCultivatorTasks(actor.cultivatorId, status, tx),
      this.database,
    );
  }

  async detail(actor: ActiveCultivatorRef, id: string) {
    const task = await TaskService.getCultivatorTask(actor.cultivatorId, id);
    if (!task) throw new HttpException({ error: '任务不存在' }, 404);
    return { success: true, data: { task } };
  }

  async challenge(actor: ActiveCultivatorRef, id: string) {
    return {
      success: true,
      data: await startBreakthroughBattle(
        { userId: actor.userId, cultivatorId: actor.cultivatorId },
        id,
      ),
    };
  }

  async claim(actor: ActiveCultivatorRef, taskId: string) {
    return toPlayerStateMutationResponse(
      await claimTaskRewardCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        taskId,
      }),
    );
  }
}
