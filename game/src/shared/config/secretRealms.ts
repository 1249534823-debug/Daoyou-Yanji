export const TIANLING_MAP_NODE_ID = 'SAT_TIANLING_01';
export const SECRET_REALMS = {
  tianling: {
    id: 'tianling',
    name: '天灵秘境',
    description:
      '连闯两名守卫与镇境灵君，通关获得秘境奖励。敌人按入场战力匹配，沿用副本战斗与战损规则。',
    dailyLimit: 1,
    rewardName: '通关奖励',
    rewardDescription: '服用后补满个人天地灵气；已满时不会消耗丹药。',
  },
} as const;
export type SecretRealmId = keyof typeof SECRET_REALMS;
export function secretRealmDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function hasClearedTianling(defeatedRounds: readonly number[]): boolean {
  return [1, 2, 3].every((round) => defeatedRounds.includes(round));
}
