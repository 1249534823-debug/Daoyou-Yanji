import type { Consumable } from '@shared/types/cultivator';

/** 仅由服务端秘境结算授予；不要加入 AI 炼丹输出字段。 */
export const TIANLING_PILL_SPECIAL_EFFECT = 'restore_qi_to_max' as const;

export const TIANLING_PILL = {
  name: '天灵丹',
  type: '丹药' as const,
  quality: '灵品' as const,
  quantity: 1,
  description: '服用后补满个人天地灵气；天地灵气已满时不会消耗丹药。',
  prompt: '',
  spec: {
    kind: 'pill' as const,
    family: 'mana' as const,
    specialEffect: TIANLING_PILL_SPECIAL_EFFECT,
    operations: [],
    consumeRules: {
      scene: 'out_of_battle_only' as const,
      quotaCategory: 'none' as const,
    },
    alchemyMeta: {
      source: 'improvised' as const,
      sourceMaterials: [] as string[],
      stability: 100,
      toxicityRating: 0,
      tags: ['天灵秘境', '天地灵气'],
      version: 4 as const,
      appearance: 'perfect' as const,
    },
  },
} satisfies Consumable & {
  spec: Extract<Consumable['spec'], { kind: 'pill' }> & {
    specialEffect: typeof TIANLING_PILL_SPECIAL_EFFECT;
  };
};

/** 名称不作为能力依据；仅认可背包中已持久化的服务端 spec。 */
export function restoresPersonalQi(consumable: unknown): boolean {
  if (typeof consumable !== 'object' || consumable === null) return false;
  const item = consumable as Record<string, unknown>;
  if (item.type !== '丹药') return false;
  if (typeof item.spec !== 'object' || item.spec === null) return false;
  const spec = item.spec as Record<string, unknown>;
  return spec.kind === 'pill' && spec.specialEffect === TIANLING_PILL_SPECIAL_EFFECT;
}
