import { describe, it, expect } from 'vitest';
import { secretRealmDay, hasClearedTianling } from './secretRealms';
describe('天灵秘境通关规则', () => {
  it('使用上海时区每日重置', () => { expect(secretRealmDay(new Date('2026-09-10T15:59:59Z'))).toBe('2026-09-10'); expect(secretRealmDay(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-11'); });
  it('必须击败两名守卫和首领', () => { expect(hasClearedTianling([])).toBe(false); expect(hasClearedTianling([1,2])).toBe(false); expect(hasClearedTianling([3])).toBe(false); expect(hasClearedTianling([1,1,3])).toBe(false); expect(hasClearedTianling([1,2,3])).toBe(true); });
});
