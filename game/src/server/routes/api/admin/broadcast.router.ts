import {
  RecipientResolveError,
  resolveEmailRecipients,
  resolveGameMailRecipients,
} from '@server/lib/admin/recipient-resolver';
import { sendViaSmtp } from '@server/lib/admin/smtp';
import {
  normalizeTemplatePayload,
  renderTemplate,
} from '@server/lib/admin/template';
import { db, getExecutor } from '@server/lib/drizzle/db';
import {
  adminMessageTemplates,
  mails,
  systemMailCampaigns,
} from '@server/lib/drizzle/schema';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  MailService,
  type MailAttachment,
} from '@server/lib/services/MailService';
import {
  RewardSelectionsSchema as GameMailRewardSelectionsSchema,
  materializeRewardAttachments,
  rewardAttachments,
} from '@shared/contracts/adminRewards';
import { SystemMailConditionsSchema } from '@shared/contracts/systemMail';
import { summarizeMailAttachments } from '@shared/lib/itemLibrary';
import { REALM_VALUES } from '@shared/types/constants';
import { eq, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';

import { Hono } from 'hono';
import { z } from 'zod';

const EmailBroadcastSchema = z
  .object({
    templateId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    payload: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({}),
    filters: z
      .object({
        registeredFrom: z.string().optional(),
        registeredTo: z.string().optional(),
        hasActiveCultivator: z.boolean().optional(),
        realmMin: z.enum(REALM_VALUES).optional(),
        realmMax: z.enum(REALM_VALUES).optional(),
      })
      .default({}),
    dryRun: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.templateId && (!value.subject || !value.content)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject'],
        message: '未使用模板时，subject/content 必填',
      });
    }
  });

const GameMailBroadcastSchema = z
  .object({
    requestId: z.uuid().optional(),
    templateId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    rewardSelections: GameMailRewardSelectionsSchema.default([]),
    payload: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({}),
    filters: z
      .object({
        targetCultivatorId: z.string().uuid().optional(),
        cultivatorCreatedFrom: z.string().optional(),
        cultivatorCreatedTo: z.string().optional(),
        realmMin: z.enum(REALM_VALUES).optional(),
        realmMax: z.enum(REALM_VALUES).optional(),
      })
      .default({}),
    dryRun: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.templateId && (!value.title || !value.content)) {
      ctx.addIssue({
        code: 'custom',
        path: ['title'],
        message: '未使用模板时，title/content 必填',
      });
    }
  });

const router = new Hono<AppEnv>();

router.post('/email', requireAdmin(), async (c) => {
  const q = getExecutor();
  const body = await c.req.json().catch(() => null);
  const parsed = EmailBroadcastSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const { templateId, payload, filters, dryRun } = parsed.data;
  const resolvedRecipients = await resolveEmailRecipients(filters);

  if (dryRun) {
    return c.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let finalSubject = parsed.data.subject ?? '';
  let finalContent = parsed.data.content ?? '';

  if (templateId) {
    const template = await q.query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, templateId),
    });

    if (!template) {
      return c.json({ error: '模板不存在' }, 404);
    }
    if (template.channel !== 'email') {
      return c.json({ error: '模板频道不匹配' }, 400);
    }
    if (template.status !== 'active') {
      return c.json({ error: '模板已停用' }, 400);
    }
    if (!template.subjectTemplate) {
      return c.json({ error: 'email 模板缺少 subjectTemplate' }, 400);
    }

    const mergedPayload = normalizeTemplatePayload(
      template.defaultPayload,
      payload,
    );
    finalSubject = renderTemplate(template.subjectTemplate, mergedPayload);
    finalContent = renderTemplate(template.contentTemplate, mergedPayload);
  }

  const recipients = resolvedRecipients.recipients.map(
    (item) => item.recipientKey,
  );
  const batchSize = Math.min(
    50,
    Math.max(1, Number(process.env.ADMIN_BROADCAST_BATCH_SIZE) || 20),
  );

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((email) => sendViaSmtp(email, finalSubject, finalContent)),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent += 1;
      } else {
        failed += 1;
        if (errors.length < 20) {
          errors.push(
            `${batch[index]}: ${result.reason?.message ?? 'unknown'}`,
          );
        }
      }
    });
  }

  return c.json({
    success: failed === 0,
    totalRecipients: recipients.length,
    sent,
    failed,
    errors,
  });
});

router.post('/game-mail', requireAdmin(), async (c) => {
  const q = getExecutor();
  const body = await c.req.json().catch(() => null);
  const parsed = GameMailBroadcastSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const { templateId, filters, payload, dryRun } = parsed.data;
  let resolvedRecipients;
  try {
    resolvedRecipients = await resolveGameMailRecipients(filters);
  } catch (error) {
    if (error instanceof RecipientResolveError) {
      return c.json(
        { error: error.message },
        { status: error.status as 400 | 404 },
      );
    }
    throw error;
  }

  if (dryRun) {
    return c.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let finalTitle = parsed.data.title ?? '';
  let finalContent = parsed.data.content ?? '';

  if (templateId) {
    const template = await q.query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, templateId),
    });

    if (!template) {
      return c.json({ error: '模板不存在' }, 404);
    }
    if (template.channel !== 'game_mail') {
      return c.json({ error: '模板频道不匹配' }, 400);
    }
    if (template.status !== 'active') {
      return c.json({ error: '模板已停用' }, 400);
    }

    const mergedPayload = normalizeTemplatePayload(
      template.defaultPayload,
      payload,
    );
    finalContent = renderTemplate(template.contentTemplate, mergedPayload);

    if (template.subjectTemplate) {
      finalTitle = renderTemplate(template.subjectTemplate, mergedPayload);
    } else if (!finalTitle) {
      return c.json(
        { error: '模板缺少标题，请填写 title 或配置 subjectTemplate' },
        400,
      );
    }
  }

  const requestId = parsed.data.requestId;
  if (!requestId)
    return c.json({ error: '请刷新后台后重试，以保证赠送不会重复提交' }, 400);
  const attachments: MailAttachment[] = rewardAttachments(
    parsed.data.rewardSelections,
  );
  if (resolvedRecipients.totalCount > 5000)
    return c.json(
      { error: '一次定向赠送最多5000人，请使用系统邮件分批投递' },
      400,
    );
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ ...parsed.data, dryRun: false }))
    .digest('hex');
  const conditions = SystemMailConditionsSchema.parse({
    targetCultivatorId: filters.targetCultivatorId,
    createdBeforePublication: true,
  });
  const actorId = c.get('user')!.id;
  const outcome = await db.transaction(async (tx) => {
    const now = new Date();
    const inserted = await tx
      .insert(systemMailCampaigns)
      .values({
        id: requestId,
        creationFingerprint: fingerprint,
        createdBy: actorId,
        title: finalTitle,
        content: finalContent,
        rewardSelections: parsed.data.rewardSelections,
        conditions,
        startsAt: now,
        endsAt: new Date(now.getTime() + 1000),
        publishedAt: now,
        status: 'stopped',
      })
      .onConflictDoNothing({ target: systemMailCampaigns.id })
      .returning({ id: systemMailCampaigns.id });
    const [record] = await tx
      .select()
      .from(systemMailCampaigns)
      .where(eq(systemMailCampaigns.id, requestId));
    if (
      !record ||
      record.createdBy !== actorId ||
      record.creationFingerprint !== fingerprint
    )
      return { conflict: true as const };
    if (inserted.length) {
      for (const recipient of resolvedRecipients.recipients) {
        await MailService.sendCampaignRewardMail(
          {
            campaignId: requestId,
            cultivatorId: recipient.recipientKey,
            title: finalTitle,
            content: finalContent,
            attachments: materializeRewardAttachments(attachments, randomUUID),
          },
          tx,
        );
      }
    }
    const [count] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(mails)
      .where(eq(mails.systemMailCampaignId, requestId));
    return {
      conflict: false as const,
      totalRecipients: count?.total ?? 0,
      replayed: !inserted.length,
    };
  });
  if (outcome.conflict)
    return c.json({ error: '此请求已用于其他内容，请重新打开赠送窗口' }, 409);
  return c.json({
    success: true,
    totalRecipients: outcome.totalRecipients,
    replayed: outcome.replayed,
    mailType: attachments.length ? 'reward' : 'system',
    rewardSummary: summarizeMailAttachments(attachments),
  });
});

export default router;
