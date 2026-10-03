import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types';
import { checkAndAcquireCooldown } from '@server/lib/redis/worldChatLimiter';
import {
  createMessage,
  listLatestMessages,
  listMessages,
} from '@server/lib/repositories/worldChatRepository';
import { createCultivatorChatMessage } from '@server/lib/services/chatMessageApplication';
import type {
  WorldChatCreateMessageRequest,
  WorldChatListQuery,
} from '@daoyou/shared/contracts/world-chat';

@Injectable()
export class WorldChatService {
  async list({ channel, limit, page, pageSize }: WorldChatListQuery) {
    if (limit)
      return { success: true, data: await listLatestMessages(limit, channel) };
    const currentPage = page || 1;
    const currentPageSize = pageSize || 20;
    const result = await listMessages({
      channel,
      page: currentPage,
      pageSize: currentPageSize,
    });
    return {
      success: true,
      data: result.messages,
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        hasMore: result.hasMore,
      },
    };
  }

  async create(
    actor: ActiveCultivatorRef,
    request: WorldChatCreateMessageRequest,
  ) {
    const message = await createCultivatorChatMessage({
      request,
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      channel: 'world',
      sectId: null,
      acquireCooldown: checkAndAcquireCooldown,
      persist: (input) => createMessage({ ...input, channel: 'world' }),
    });
    return { success: true, data: message };
  }
}
