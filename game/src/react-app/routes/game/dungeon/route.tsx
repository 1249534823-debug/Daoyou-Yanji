import { SecretRealmPanel } from '@app/components/feature/secret-realm/SecretRealmPanel';
import { TIANLING_MAP_NODE_ID } from '@shared/config/secretRealms';
import { GameSceneLoading } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { useDungeonViewModel } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import { Suspense, useCallback } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { DungeonViewRenderer } from './components/DungeonViewRenderer';
import { DungeonSceneScreen } from './dungeonScene';
import { resolveDungeonSceneDescriptor } from './dungeonSceneRegistry';

/**
 * 副本主页面内容组件
 *
 * 重构后的设计原则：
 * 1. 单一职责：仅负责数据获取和视图渲染协调
 * 2. 状态管理：使用 ViewModel Hook 统一管理所有状态
 * 3. 视图渲染：委托给 DungeonViewRenderer 处理
 */
export function DungeonContent({ tianling = false }: { tianling?: boolean }) {
  const identity = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const cultivator = identity.data?.cultivator
    ? { ...identity.data.cultivator, condition: condition.data }
    : null;
  const resource = (
    point: { current: number; max?: number } | undefined,
    authorityMax?: number,
  ) => {
    const max = authorityMax ?? point?.max ?? 0;
    const current = Math.min(max, Math.max(0, point?.current ?? 0));
    return { current, max, percent: max ? (current / max) * 100 : 0 };
  };
  const battleEntryResources = condition.data
    ? {
        hp: resource(
          condition.data.resources.hp,
          condition.data.combatV6?.maxHp,
        ),
        mp: resource(
          condition.data.resources.mp,
          condition.data.combatV6?.maxMp,
        ),
      }
    : undefined;
  const isCultivatorLoading = identity.loading || condition.loading;
  const { tasks, loading: tasksLoading } = useTaskList(cultivator?.id);
  const [searchParams] = useSearchParams();
  const preSelectedNodeId = tianling ? TIANLING_MAP_NODE_ID : searchParams.get('nodeId');
  const navigate = useNavigate();

  // 使用 ViewModel Hook 管理所有业务逻辑和状态
  const {
    viewState,
    state,
    processing,
    actions,
    readError,
    refreshing,
    refresh,
    dismissSettlement,
  } = useDungeonViewModel(!!cultivator, cultivator?.id, preSelectedNodeId);

  // 结算确认回调：刷新库存后跳转首页
  const handleSettlementConfirm = useCallback(() => {
    dismissSettlement();
    if (!tianling) navigate('/game');
  }, [navigate, dismissSettlement, tianling]);

  // 修正加载状态：ViewModel 内部已经处理了副本状态的加载
  // 这里只需要处理用户信息的加载
  if ((isCultivatorLoading && !cultivator) || (!tianling && tasksLoading && !tasks)) {
    const descriptor = resolveDungeonSceneDescriptor('loading');
    return (
      <DungeonSceneScreen descriptor={descriptor}>
        <GameSceneLoading message={descriptor.loadingMessage} />
      </DungeonSceneScreen>
    );
  }

  const isTianlingRun = state?.mapNodeId === TIANLING_MAP_NODE_ID;
  if (!tianling && (isTianlingRun || preSelectedNodeId === TIANLING_MAP_NODE_ID)) {
    return <Navigate to="/game/secret-realms/tianling" replace />;
  }
  const entranceDescriptor = {
    ...resolveDungeonSceneDescriptor('map_selection'),
    sceneLabel: '天灵秘境',
    subtitle: '灵气深处，守境之灵静候来者。',
    density: 'card' as const,
  };
  const renderEntrance = () => {
    if (state && !isTianlingRun) {
      return (
        <DungeonSceneScreen descriptor={entranceDescriptor}>
          <InkNotice tone="warning">
            你还有一段云游历练尚未处理，请先返回原历练继续或结束，再进入天灵秘境。
          </InkNotice>
          <InkButton className="mt-4" href="/game/dungeon" variant="primary">
            返回当前历练
          </InkButton>
        </DungeonSceneScreen>
      );
    }
    return (
      <DungeonSceneScreen descriptor={entranceDescriptor}>
        <SecretRealmPanel onStart={actions.startDungeon} isStarting={processing} />
      </DungeonSceneScreen>
    );
  };

  // 委托给视图渲染器
  return (
    <>
      {readError ? (
        <div className="mx-auto w-full max-w-3xl p-4" role="alert">
          <InkNotice tone="warning">{readError}</InkNotice>
          <InkButton disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? '正在确认探索结果…' : '重新读取'}
          </InkButton>
        </div>
      ) : null}
      <fieldset
        className={
          viewState.type === 'in_battle' ? 'h-full min-w-0' : 'min-w-0'
        }
        disabled={!!readError || refreshing}
        inert={!!readError || refreshing}
      >
        {readError && viewState.type === 'map_selection' ? (
          <p className="p-4 text-center">探索状态暂不可用</p>
        ) : tianling && (viewState.type === 'map_selection' || (state && !isTianlingRun && viewState.type !== 'loading')) ? (
          renderEntrance()
        ) : (
          <DungeonViewRenderer
            viewState={viewState}
            cultivator={cultivator}
            displayResources={battleEntryResources}
            tasks={tasks ?? []}
            processing={processing}
            actions={actions}
            onSettlementConfirm={handleSettlementConfirm}
          />
        )}
      </fieldset>
    </>
  );
}

export default function DungeonPage() {
  const descriptor = resolveDungeonSceneDescriptor('loading');

  return (
    <Suspense
      fallback={
        <DungeonSceneScreen descriptor={descriptor}>
          <GameSceneLoading message={descriptor.loadingMessage} />
        </DungeonSceneScreen>
      }
    >
      <DungeonContent />
    </Suspense>
  );
}
