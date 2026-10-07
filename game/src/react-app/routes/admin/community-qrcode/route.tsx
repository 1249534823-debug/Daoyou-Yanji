import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkInput } from '@app/components/ui/InkInput';
import { AdminButton as InkButton } from '@app/routes/admin/_components/AdminButton';
import { useCallback, useEffect, useState } from 'react';
import { AdminSection } from '../_components/AdminSection';

type LoadState = {
  groupNumber: string;
  customized: boolean;
};

export default function CommunityQqGroupAdminPage() {
  const { pushToast } = useInkUI();
  const [groupNumber, setGroupNumber] = useState('');
  const [customized, setCustomized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/community-group');
    const data = (await response.json()) as LoadState & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? '加载配置失败');
    }
    setGroupNumber(data.groupNumber ?? '');
    setCustomized(Boolean(data.customized));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载配置失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, pushToast]);

  const submit = async () => {
    const trimmed = groupNumber.trim();
    if (!trimmed) {
      pushToast({ message: '请填写 QQ 群号', tone: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/community-group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupNumber: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '保存失败');
      }
      setGroupNumber(data.groupNumber ?? trimmed);
      setCustomized(true);
      pushToast({
        message: '已保存，玩家端将显示新的 QQ 群号',
        tone: 'success',
      });
      await load();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-form-page">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          COMMUNITY
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">QQ 交流群</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          在这里维护玩家端展示的 QQ
          群号。保存后即时生效，玩家页会直接读取最新配置；
          若数据库没有配置，则回退为默认群号 `1107586928`。
        </p>
      </header>

      <AdminSection title="交流群设置" icon="users">
        {!customized && !loading ? (
          <p className="text-ink-secondary text-sm">
            尚未自定义群号，玩家端使用默认群号。保存后将使用这里的设置。
          </p>
        ) : null}

        <InkInput
          label="QQ 群号"
          value={groupNumber}
          onChange={setGroupNumber}
          placeholder="1107586928"
          hint="仅支持 5 到 12 位数字。"
          disabled={loading || saving}
        />

        <div className="admin-form-actions">
          <InkButton
            type="button"
            variant="primary"
            disabled={loading || saving}
            onClick={() => void submit()}
          >
            {saving ? '保存中…' : '保存'}
          </InkButton>
          <InkButton
            type="button"
            variant="secondary"
            disabled={loading || saving}
            onClick={() => void load()}
          >
            重新加载
          </InkButton>
        </div>
      </AdminSection>
      <AdminSection
        title="展示预览"
        description="显示当前输入的内容，保存后才会对玩家生效。"
      >
        <div className="admin-readout">
          <p className="text-ink-secondary text-xs tracking-[0.16em]">
            QQ 群号
          </p>
          <p className="text-ink mt-2 text-2xl tracking-[0.18em]">
            {groupNumber || '1107586928'}
          </p>
        </div>
      </AdminSection>
    </div>
  );
}
