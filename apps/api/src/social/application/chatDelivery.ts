import { createSectChatMessage } from '@server/lib/repositories/sectChatRepository';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import { publishSectChatMessage } from '@server/realtime/infrastructure/sectChatBroadcaster';
import { publishWorldChatMessage } from '@server/realtime/infrastructure/worldChatBroadcaster';

export async function createAndPublishWorldChatMessage(
  input: Parameters<typeof createMessage>[0],
) {
  const message = await createMessage(input);
  publishWorldChatMessage(message);
  return message;
}

export async function createAndPublishSectChatMessage(
  input: Parameters<typeof createSectChatMessage>[0],
) {
  const message = await createSectChatMessage(input);
  publishSectChatMessage(input.sectId, message);
  return message;
}
