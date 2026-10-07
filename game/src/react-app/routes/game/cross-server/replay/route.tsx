import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { CombatV6ReplayPlayer } from '@app/components/feature/combat-v6/CombatV6ReplayPlayer';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CombatV6ReplayView } from '@shared/combat-v6/replay';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

export default function CrossServerReplayRoute() {
  const { id = '' } = useParams();
  const characterId = usePlayerSession().data?.activeCultivator?.id;
  return <ReplayLoader key={`${characterId}:${id}`} id={id} />;
}
function ReplayLoader({ id }: { id: string }) {
  const [record, setRecord] = useState<CombatV6ReplayView>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void combatV6Request<CombatV6ReplayView>(
      `/api/cross-server/replays/${encodeURIComponent(id)}`,
      { signal: abort.signal, cache: 'no-store' },
    )
      .then((data) => {
        if (!abort.signal.aborted) setRecord(data);
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setError(error instanceof Error ? error.message : '读取战报失败');
      });
    return () => abort.abort();
  }, [id, attempt]);
  return (
    <CombatV6Page
      title="跨服战报"
      active={!!record}
      loading={!record && !error}
      error={error}
      back="/game/cross-server"
      backLabel="返回跨服切磋"
      onRetry={() => {
        setError('');
        setAttempt((n) => n + 1);
      }}
    >
      {record ? (
        <CombatV6ReplayPlayer
          record={record}
          title="跨服战报"
          back="/game/cross-server"
          backLabel="返回跨服切磋"
        />
      ) : null}
    </CombatV6Page>
  );
}
