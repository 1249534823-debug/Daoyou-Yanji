import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { AdminButton } from '../../_components/AdminButton';
import {
  AdminPlayerPicker,
  type AdminPlayerChoice,
} from '../../_components/AdminPlayerPicker';
import { AdminDisclosure, AdminSection } from '../../_components/AdminSection';
import { RewardSelectionEditor } from '../../_components/RewardSelectionEditor';
import {
  parseRewardSelectionDrafts,
  type RewardSelectionDraft,
} from '../../_components/RewardSelectionEditor.helpers';

interface GameMailTemplateOption {
  id: string;
  name: string;
}

interface GameMailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  success?: boolean;
  mailType?: string;
  rewardSummary?: string[];
  sampleRecipients?: Array<{ recipientKey: string }>;
}

export function GameMailBroadcastForm({
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
}) {
  const { pushToast } = useInkUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [payloadText, setPayloadText] = useState('{}');
  const [rewardSelections, setRewardSelections] = useState<
    RewardSelectionDraft[]
  >([]);
  const [recipientMode, setRecipientMode] = useState<'single' | 'group'>(
    'single',
  );
  const [targetPlayer, setTargetPlayer] = useState<AdminPlayerChoice | null>(
    null,
  );
  const submitting = useRef(false);
  const operation = useRef<{ signature: string; requestId: string } | null>(
    null,
  );
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [realmMin, setRealmMin] = useState('');
  const [realmMax, setRealmMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GameMailBroadcastResult | null>(null);
  const [templates, setTemplates] = useState<GameMailTemplateOption[]>([]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(
          '/api/admin/templates?channel=game_mail&status=active',
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '加载模板失败');
        setTemplates(
          (data.templates ?? []).map((item: { id: string; name: string }) => ({
            id: item.id,
            name: item.name,
          })),
        );
      } catch {
        // 模板加载失败不阻塞手动发送
      }
    };
    loadTemplates();
  }, []);

  const submit = async (dryRun: boolean) => {
    if (submitting.current) return;
    if (recipientMode === 'single' && !targetPlayer) {
      pushToast({ message: '请先搜索并选择收件玩家', tone: 'warning' });
      return;
    }
    if (!templateId && (!title.trim() || !content.trim())) {
      pushToast({ message: '请填写标题和内容，或选择模板', tone: 'warning' });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadText || '{}');
    } catch {
      pushToast({ message: '变量 JSON 格式错误', tone: 'warning' });
      return;
    }

    let parsedRewardSelections;
    try {
      parsedRewardSelections = parseRewardSelectionDrafts(rewardSelections, {
        allowEmpty: true,
        allowSectContribution: true,
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '奖励配置错误',
        tone: 'warning',
      });
      return;
    }

    submitting.current = true;
    setLoading(true);
    onBusyChange?.(true);
    try {
      const body = {
        templateId: templateId || undefined,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
        rewardSelections: parsedRewardSelections,
        payload,
        filters: {
          targetCultivatorId:
            recipientMode === 'single' ? targetPlayer?.id : undefined,
          cultivatorCreatedFrom: createdFrom || undefined,
          cultivatorCreatedTo: createdTo || undefined,
          realmMin: realmMin || undefined,
          realmMax: realmMax || undefined,
        },
        dryRun,
      };
      const signature = JSON.stringify(body);
      if (!dryRun && operation.current?.signature !== signature) {
        operation.current = { signature, requestId: crypto.randomUUID() };
      }
      const response = await fetch('/api/admin/broadcast/game-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ...(!dryRun ? { requestId: operation.current?.requestId } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '游戏邮件群发失败');
      }

      if (!dryRun) operation.current = null;
      setResult(data);
      pushToast({
        message: dryRun
          ? '预览完成'
          : recipientMode === 'single'
            ? '邮件已发送给所选玩家'
            : '游戏邮件同步群发完成',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '游戏邮件群发失败',
        tone: 'danger',
      });
    } finally {
      submitting.current = false;
      setLoading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="admin-form-stack">
      <AdminSection
        title="邮件内容"
        description="选择模板，或手动填写标题和正文。"
      >
        <InkSelect
          label="模板（可选）"
          value={templateId}
          onChange={(value) => setTemplateId(value)}
          disabled={loading}
        >
          <option value="">不使用模板（手动填写）</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </InkSelect>
        <InkInput
          label="邮件标题（手动填写）"
          value={title}
          onChange={(value) => setTitle(value)}
          placeholder="例如：版本维护补偿"
          disabled={loading}
        />
        <InkInput
          label="邮件内容（手动填写）"
          value={content}
          onChange={(value) => setContent(value)}
          placeholder="请输入游戏内邮件正文"
          multiline
          rows={8}
          disabled={loading}
        />
        <AdminDisclosure
          title="模板变量"
          description="使用模板时，可展开填写 JSON 变量。"
        >
          <InkInput
            label="模板变量（JSON）"
            value={payloadText}
            onChange={(value) => setPayloadText(value)}
            multiline
            rows={4}
            disabled={loading}
          />
        </AdminDisclosure>
      </AdminSection>

      <AdminSection
        title="收件人范围"
        description="指定玩家时按名称搜索并点选；选择群发后可使用时间与境界筛选。"
      >
        <InkSelect
          label="发送范围"
          value={recipientMode}
          disabled={loading}
          onChange={(mode) => {
            setRecipientMode(mode === 'group' ? 'group' : 'single');
            setResult(null);
          }}
        >
          <option value="single">指定玩家</option>
          <option value="group">按条件群发</option>
        </InkSelect>
        {recipientMode === 'single' ? (
          <AdminPlayerPicker
            value={targetPlayer}
            onChange={(player) => {
              setTargetPlayer(player);
              setResult(null);
            }}
            disabled={loading}
          />
        ) : (
          <fieldset className="admin-field-group space-y-4">
            <legend>群发筛选条件</legend>
            <div className="admin-form-grid">
              <InkInput
                label="角色创建时间起"
                type="date"
                value={createdFrom}
                onChange={(value) => setCreatedFrom(value)}
                disabled={loading}
              />
              <InkInput
                label="角色创建时间止"
                type="date"
                value={createdTo}
                onChange={(value) => setCreatedTo(value)}
                disabled={loading}
              />
            </div>
            <div className="admin-form-grid">
              <InkSelect
                label="境界下限"
                value={realmMin}
                onChange={(value) => setRealmMin(value)}
                disabled={loading}
              >
                <option value="">不限</option>
                {REALM_VALUES.map((realm) => (
                  <option key={realm} value={realm}>
                    {realm}
                  </option>
                ))}
              </InkSelect>
              <InkSelect
                label="境界上限"
                value={realmMax}
                onChange={(value) => setRealmMax(value)}
                disabled={loading}
              >
                <option value="">不限</option>
                {REALM_VALUES.map((realm) => (
                  <option key={realm} value={realm}>
                    {realm}
                  </option>
                ))}
              </InkSelect>
            </div>
          </fieldset>
        )}
      </AdminSection>

      <AdminSection
        title="附件奖励"
        description="可选模板 + 人群筛选。奖励支持灵石、声望、宗门贡献与V6 道装、丹药与材料，留空时发送纯公告。"
      >
        <RewardSelectionEditor
          value={rewardSelections}
          onChange={setRewardSelections}
          disabled={loading}
          allowEmpty
          allowSectContribution
        />
        {rewardSelections.some(
          (reward) => reward.type === 'sect_contribution',
        ) && (
          <InkNotice tone="muted">
            宗门贡献需加入宗门后领取；未加入宗门时，邮件及全部附件会保留待领。
          </InkNotice>
        )}
      </AdminSection>

      <AdminSection title="发送操作">
        <div className="admin-form-actions">
          <AdminButton
            variant="secondary"
            onClick={() => submit(true)}
            disabled={loading}
          >
            预览发送人数
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => submit(false)}
            disabled={loading}
          >
            {loading
              ? '执行中...'
              : recipientMode === 'single'
                ? '确认发送给所选玩家'
                : '确认同步群发游戏邮件'}
          </AdminButton>
        </div>
      </AdminSection>

      {result && (
        <AdminSection title={result.dryRun ? '预览结果' : '发送结果'}>
          <div
            className="admin-field-group space-y-2"
            role="status"
            aria-live="polite"
          >
            {result.totalRecipients !== undefined && (
              <p className="text-sm">
                收件人数：<strong>{result.totalRecipients}</strong>
              </p>
            )}
            {result.success !== undefined && (
              <InkNotice tone={result.success ? 'info' : 'danger'}>
                执行状态：{result.success ? '成功' : '失败'}
              </InkNotice>
            )}
            {result.rewardSummary && result.rewardSummary.length > 0 && (
              <p className="text-sm">
                奖励内容：{result.rewardSummary.join('、')}
              </p>
            )}
          </div>
          <AdminDisclosure
            title="执行详情"
            description="查看完整返回结果与收件人样例。"
          >
            <pre className="max-w-full overflow-x-auto rounded-lg bg-black/5 p-3 text-xs leading-5">
              {JSON.stringify(result, null, 2)}
            </pre>
          </AdminDisclosure>
        </AdminSection>
      )}
    </div>
  );
}
