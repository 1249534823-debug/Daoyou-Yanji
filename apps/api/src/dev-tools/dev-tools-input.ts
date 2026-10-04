import { createDevCultivatorPatchSchema } from '@daoyou/contracts/devTools';
import { createDevGrantSchema } from '@daoyou/contracts/forging';
import { COMPREHENSION_INSIGHT_CAP } from '@daoyou/game-content/cultivation/cultivationTuning';
import { SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP } from '@daoyou/game-rules/body-cultivation/marrow-wash';
import { ItemGrantSchema } from '@daoyou/game-rules/inventory';
import { MailAttachmentsSchema } from '@daoyou/game-rules/mail/attachments';

export const DevCultivatorPatchSchema = createDevCultivatorPatchSchema({
  comprehensionInsightCap: COMPREHENSION_INSIGHT_CAP,
  spiritualRootStrengthCap: SPIRITUAL_ROOT_EFFECTIVE_STRENGTH_CAP,
});
export const DevGrantSchema = createDevGrantSchema({
  ItemGrantSchema,
  MailAttachmentsSchema,
});
