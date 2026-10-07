import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import { TemplateStatus } from '@shared/types/admin-broadcast';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AdminButton } from '../../_components/AdminButton';
import { AdminDisclosure, AdminSection } from '../../_components/AdminSection';

type TemplateChannel = 'email' | 'game_mail';

interface TemplateEditorFormProps {
  mode: 'create' | 'edit';
  templateId?: string;
  initialValue?: {
    channel: TemplateChannel;
    name: string;
    subjectTemplate: string;
    contentTemplate: string;
    defaultPayload: Record<string, string | number>;
    status: TemplateStatus;
  };
}

export function TemplateEditorForm({
  mode,
  templateId,
  initialValue,
}: TemplateEditorFormProps) {
  const { pushToast } = useInkUI();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [channel, setChannel] = useState<TemplateChannel>(
    initialValue?.channel ?? 'email',
  );
  const [name, setName] = useState(initialValue?.name ?? '');
  const [subjectTemplate, setSubjectTemplate] = useState(
    initialValue?.subjectTemplate ?? '',
  );
  const [contentTemplate, setContentTemplate] = useState(
    initialValue?.contentTemplate ?? '',
  );
  const [defaultPayloadText, setDefaultPayloadText] = useState(
    JSON.stringify(initialValue?.defaultPayload ?? {}, null, 2),
  );
  const [status, setStatus] = useState<TemplateStatus>(
    initialValue?.status ?? 'active',
  );

  const isEmail = useMemo(() => channel === 'email', [channel]);

  const submit = async () => {
    if (!name.trim() || !contentTemplate.trim()) {
      pushToast({ message: '请填写模板名称和正文模板', tone: 'warning' });
      return;
    }
    if (isEmail && !subjectTemplate.trim()) {
      pushToast({ message: 'email 模板必须填写主题模板', tone: 'warning' });
      return;
    }

    let defaultPayload: Record<string, string | number> = {};
    try {
      const parsed = JSON.parse(defaultPayloadText || '{}') as Record<
        string,
        unknown
      >;
      defaultPayload = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' || typeof v === 'number') {
          defaultPayload[k] = v;
        }
      });
    } catch {
      pushToast({
        message: '默认变量 JSON 格式错误',
        tone: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === 'create'
          ? '/api/admin/templates'
          : `/api/admin/templates/${templateId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          name: name.trim(),
          subjectTemplate: subjectTemplate.trim() || undefined,
          contentTemplate: contentTemplate.trim(),
          defaultPayload,
          status,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '保存模板失败');
      }

      pushToast({
        message: mode === 'create' ? '模板创建成功' : '模板更新成功',
        tone: 'success',
      });
      navigate('/admin/templates');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存模板失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-form-stack">
      <AdminSection
        title="模板基本信息"
        description="设置模板名称、发送频道和启用状态。"
      >
        <InkInput
          label="模板名称"
          value={name}
          onChange={(value) => setName(value)}
          placeholder="例如：新版本公告"
          disabled={loading}
        />
        <div className="admin-form-grid">
          <InkSelect
            label="模板频道"
            value={channel}
            onChange={(value) => setChannel(value as TemplateChannel)}
            disabled={loading || mode === 'edit'}
          >
            <option value="email">email</option>
            <option value="game_mail">game_mail</option>
          </InkSelect>
          <InkSelect
            label="状态"
            value={status}
            onChange={(value) => setStatus(value as TemplateStatus)}
            disabled={loading}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </InkSelect>
        </div>
      </AdminSection>

      <AdminSection
        title="内容编辑"
        description="填写发送时使用的标题与正文模板。"
      >
        <InkInput
          label={isEmail ? '主题模板（支持 {{var}}）' : '标题模板（可选）'}
          value={subjectTemplate}
          onChange={(value) => setSubjectTemplate(value)}
          placeholder={
            isEmail ? '例如：{{version}} 版本更新通知' : '例如：{{eventName}}'
          }
          disabled={loading}
        />
        <InkInput
          label="正文模板（支持 {{var}}）"
          value={contentTemplate}
          onChange={(value) => setContentTemplate(value)}
          placeholder="例如：道友您好，{{eventName}} 已开启..."
          multiline
          rows={10}
          disabled={loading}
        />
      </AdminSection>

      <AdminDisclosure
        title="默认变量"
        description="可选配置：为模板中的变量设置默认值。"
      >
        <InkInput
          label="默认变量（JSON）"
          value={defaultPayloadText}
          onChange={(value) => setDefaultPayloadText(value)}
          multiline
          rows={6}
          disabled={loading}
        />
      </AdminDisclosure>

      <AdminSection title="保存模板">
        <div className="admin-form-actions">
          <AdminButton variant="primary" onClick={submit} disabled={loading}>
            {loading
              ? '保存中...'
              : mode === 'create'
                ? '创建模板'
                : '保存修改'}
          </AdminButton>
          <AdminButton href="/admin/templates" variant="secondary">
            返回列表
          </AdminButton>
        </div>
      </AdminSection>
    </div>
  );
}
