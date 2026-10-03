import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import { claimTaskRewardCommand } from '@server/lib/services/TaskApplicationService';
import { TaskService } from '@server/lib/services/TaskService';
import { startBreakthroughBattle } from '@server/lib/services/combat-v6/CombatV6BreakthroughService';

@Injectable()
export class TasksService {
  list(actor: ActiveCultivatorRef, status?: 'active' | 'completed') {
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'player.tasks',
      (tx) => TaskService.readCultivatorTasks(actor.cultivatorId, status, tx),
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
