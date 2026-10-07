import { getNextStage } from '@server/utils/breakthroughCalculator';
import type { RealmType, RealmStage } from '@shared/types/constants';
import type { CultivationProgressData } from './useRetreatViewModel';

export function BreakthroughGuidance({ realm, stage, progress, blocked, loading, error, missing }: {
  realm: RealmType; stage: RealmStage; progress: CultivationProgressData | null;
  blocked: boolean; loading: boolean; error?: string; missing: string[];
}) {
  const next = getNextStage(realm, stage);
  const major = Boolean(next && next.realm !== realm);
  if (!next) return <p className="text-ink-secondary text-sm leading-7">已至渡劫圆满，现有境界已修至尽头，可继续完善功法、法宝与道体。</p>;
  if (!progress) return <p role="status" className="text-ink-secondary text-sm">正在核对修为，稍后显示破境建议。</p>;
  const remaining = Math.max(0, Math.ceil(progress.exp_cap * 0.6) - progress.cultivation_exp);
  const suggestion = major && error ? '卷宗暂未同步，请稍后刷新，先不要重复冲关。'
    : major && loading ? '正在核对破境卷宗，暂不急于冲关。'
    : major && blocked ? (missing[0] ? `先完成：${missing[0]}` : '先到任务卷宗完成当前破境任务，再回静室冲关。')
    : !progress.canBreakthrough ? '先闭关积累修为；寿元紧张时，可通过历练稳步积累。'
    : progress.breakthroughType === 'forced' ? '已能强行突破，但根基尚浅；不急时建议继续闭关。'
    : progress.breakthroughType === 'perfect' ? '修为与感悟已具备圆满火候，可查看推演后自行决定。'
    : progress.percent >= 100 ? '修为已满，可通过历练或明悟类丹药补足感悟，争取圆满火候。'
    : '已具常规突破火候；可查看推演，或继续积累以求稳妥。';
  return (
    <div className="text-ink-secondary space-y-1 text-sm leading-7" aria-live="polite">
      <p><span className="text-ink">{major ? '大境界' : '小境界'} · 下一步：{next.realm}{next.stage}</span></p>
      <p>{suggestion}</p>
      <details className="text-xs leading-6">
        <summary className="cursor-pointer">查看准备建议</summary>
        <ul className="mt-2 space-y-1">
          <li>{remaining > 0 ? `距最早尝试门槛还差 ${remaining} 修为。` : '修为已达到最早尝试门槛，仍需留意成功率。'}</li>
          <li>稳妥目标：修为圆满，感悟至少 50；丹药为辅助，并非必备。</li>
          {major ? <li>大境界需完成当前破境任务；具体缺项以任务卷宗为准。</li> : <li>小境界无需大境界卷宗，确认灵气、寿元与当前状态后再尝试。</li>}
          <li>成功率与失败代价以确认窗口为准；满足条件也不保证突破成功。</li>
        </ul>
      </details>
    </div>
  );
}
