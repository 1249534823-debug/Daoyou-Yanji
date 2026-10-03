import { Injectable } from '@nestjs/common';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { createFeedback } from '@server/lib/repositories/feedbackRepository';
import type { FeedbackCreateRequest } from '@daoyou/shared/contracts/feedback';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class FeedbackService {
  async create(userId: string, input: FeedbackCreateRequest) {
    const active = await getExecutor().query.cultivators.findFirst({
      where: and(
        eq(cultivators.userId, userId),
        eq(cultivators.status, 'active'),
      ),
    });
    const feedback = await createFeedback({
      userId,
      cultivatorId: active?.id ?? null,
      ...input,
    });
    return { success: true, data: { feedbackId: feedback.id } };
  }
}
