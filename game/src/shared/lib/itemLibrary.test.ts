import { describe, expect, it } from 'vitest';

import { consumableSchema } from '@shared/contracts/resources/inventory';
import {
  GameMailRewardSelectionsSchema,
  ItemLibraryConsumablePayloadSchema,
  ItemLibraryMaterialPayloadSchema,
  ItemLibraryRewardSelectionsSchema,
  MailAttachmentsSchema,
  attachmentsToResourceOperations,
  parseMailAttachments,
  resolveItemLibrarySelections,
  summarizeMailAttachments,
} from './itemLibrary';

function buildPillPayload() {
  return {
    name: '养元丹',
    type: '丹药',
    quality: '凡品',
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'flat',
          value: 100,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        analysisVersion: 2,
        propertyVector: [],
        sourceMaterialVectors: [],
        stability: 80,
        toxicityRating: 5,
        tags: ['healing'],
      },
    },
  };
}

describe('ItemLibraryConsumablePayloadSchema', () => {
  it('preserves complete pill analysis metadata', () => {
    const parsed = ItemLibraryConsumablePayloadSchema.parse(buildPillPayload());

    expect(parsed.spec.kind).toBe('pill');
    if (parsed.spec.kind !== 'pill') return;
    expect(parsed.spec.alchemyMeta).toMatchObject({
      analysisVersion: 2,
      propertyVector: [],
      sourceMaterialVectors: [],
    });
  });

  it('accepts pills without optional analysis metadata', () => {
    const payload = buildPillPayload();
    const incomplete = {
      ...payload,
      spec: {
        ...payload.spec,
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: [],
          stability: 80,
          toxicityRating: 5,
          tags: ['healing'],
        },
      },
    };

    const parsed = ItemLibraryConsumablePayloadSchema.parse(incomplete);

    expect(parsed.spec.kind).toBe('pill');
    if (parsed.spec.kind !== 'pill') return;
    expect(parsed.spec.alchemyMeta.analysisVersion).toBeUndefined();
    expect(parsed.spec.alchemyMeta.propertyVector).toBeUndefined();
    expect(parsed.spec.alchemyMeta.sourceMaterialVectors).toBeUndefined();
  });

  it('allows inventory responses to omit analysis metadata', () => {
    const payload = buildPillPayload();
    const { analysisVersion, propertyVector, sourceMaterialVectors, ...meta } =
      payload.spec.alchemyMeta;

    expect(
      consumableSchema.parse({
        ...payload,
        quantity: 1,
        spec: {
          ...payload.spec,
          alchemyMeta: meta,
        },
      }),
    ).toMatchObject({
      name: '养元丹',
      quantity: 1,
    });

    expect(analysisVersion).toBe(2);
    expect(propertyVector).toEqual([]);
    expect(sourceMaterialVectors).toEqual([]);
  });
});

describe('ItemLibraryMaterialPayloadSchema', () => {
  it('preserves historical spirit-seed attachment snapshots', () => {
    const payload = ItemLibraryMaterialPayloadSchema.parse({
      name: '青纹眠籽',
      type: 'seed',
      rank: '玄品',
      element: '木',
      description: '种壳中蕴着尚未定形的生机。',
      details: {
        seedSpec: {
          version: 1,
          fingerprint: 'seed-v1-example',
          plant: { seedName: '青纹眠籽' },
        },
      },
    });
    const [attachment] = MailAttachmentsSchema.parse([
      {
        type: 'material',
        name: payload.name,
        quantity: 2,
        data: { ...payload, quantity: 2 },
      },
    ]);

    expect(attachment.type).toBe('material');
    if (attachment.type !== 'material') return;
    expect(attachment.data.details).toEqual(payload.details);
    expect(attachment.data.quantity).toBe(2);
  });
});

describe('game mail sect contribution rewards', () => {
  it('accepts a mixed game-mail reward and preserves its contribution label', () => {
    const selections = GameMailRewardSelectionsSchema.parse([
      { type: 'spirit_stones', quantity: 20 },
      { type: 'sect_contribution', quantity: 50 },
    ]);
    const attachments = parseMailAttachments(
      resolveItemLibrarySelections(selections, []),
    );
    expect(summarizeMailAttachments(attachments)).toEqual([
      '灵石 x20',
      '宗门贡献 x50',
    ]);
  });

  it.each([0, -1, 1.5, 100_000_001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid sect contribution quantity %s',
    (quantity) => {
      expect(
        GameMailRewardSelectionsSchema.safeParse([
          { type: 'sect_contribution', quantity },
        ]).success,
      ).toBe(false);
    },
  );

  it('keeps sect rewards out of reward channels without sect settlement', () => {
    expect(
      ItemLibraryRewardSelectionsSchema.safeParse([
        { type: 'sect_contribution', quantity: 50 },
      ]).success,
    ).toBe(false);
    expect(() =>
      attachmentsToResourceOperations([
        { type: 'sect_contribution', name: '宗门贡献', quantity: 50 },
      ]),
    ).toThrow('宗门贡献须通过邮件领取流程结算');
    expect(
      attachmentsToResourceOperations([
        { type: 'spirit_stones', name: '灵石', quantity: 20 },
        { type: 'reputation', name: '声望', quantity: 10 },
      ]),
    ).toEqual([
      { type: 'spirit_stones', value: 20 },
      { type: 'reputation', value: 10 },
    ]);
  });
});
