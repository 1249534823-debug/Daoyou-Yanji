import type { FeedbackCreateRequest } from '@daoyou/shared/contracts/feedback';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service';
import type { DbClient } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { createFeedback } from '@server/lib/repositories/feedbackRepository';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class FeedbackService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async create(userId: string, input: FeedbackCreateRequest) {
    const active = await this.database.query.cultivators.findFirst({
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
