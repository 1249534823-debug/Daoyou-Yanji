import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES } from '@shared/types/constants';
import { useEffect, useState } from 'react';
import { AdminButton } from '../../_components/AdminButton';
import { AdminDisclosure, AdminSection } from '../../_components/AdminSection';

interface EmailTemplateOption {
  id: string;
  name: string;
}

interface EmailBroadcastResult {
  dryRun?: boolean;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  errors?: string[];
  sampleRecipients?: Array<{ recipientKey: string }>;
}

export function EmailBroadcastForm() {
  const { pushToast } = useInkUI();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [payloadText, setPayloadText] = useState('{}');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [hasActiveCultivator, setHasActiveCultivator] = useState('');
  const [realmMin, setRealmMin] = useState('');
  const [realmMax, setRealmMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailBroadcastResult | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(
          '/api/admin/templates?channel=email&status=active',
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
    if (!templateId && (!subject.trim() || !content.trim())) {
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

    setLoading(true);
    try {
      const response = await fetch('/api/admin/broadcast/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId || undefined,
          subject: subject.trim() || undefined,
          content: content.trim() || undefined,
          payload,
          filters: {
            registeredFrom: registeredFrom || undefined,
            registeredTo: registeredTo || undefined,
            hasActiveCultivator:
              hasActiveCultivator === ''
                ? undefined
                : hasActiveCultivator === 'true',
            realmMin: realmMin || undefined,
            realmMax: realmMax || undefined,
          },
          dryRun,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '邮件群发失败');
      }

      setResult(data);
      pushToast({
        message: dryRun ? '预览完成' : '邮件同步群发完成',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '邮件群发失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-form-stack">
      <AdminSection
        title="邮件内容"
        description="选择模板，或手动填写主题和正文。"
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
          label="主题（手动填写）"
          value={subject}
          onChange={(value) => setSubject(value)}
          placeholder="例如：万界道友•衍极界版本更新公告"
          disabled={loading}
        />
        <InkInput
          label="内容（手动填写）"
          value={content}
          onChange={(value) => setContent(value)}
          placeholder="请输入邮件正文"
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
        description="按注册时间、角色状态和境界筛选收件人。"
      >
        <div className="admin-form-grid">
          <InkInput
            label="注册时间起"
            type="date"
            value={registeredFrom}
            onChange={(value) => setRegisteredFrom(value)}
            disabled={loading}
          />
          <InkInput
            label="注册时间止"
            type="date"
            value={registeredTo}
            onChange={(value) => setRegisteredTo(value)}
            disabled={loading}
          />
        </div>
        <InkSelect
          label="活跃角色"
          value={hasActiveCultivator}
          onChange={(value) => setHasActiveCultivator(value)}
          disabled={loading}
        >
          <option value="">不限</option>
          <option value="true">仅有活跃角色</option>
          <option value="false">仅无活跃角色</option>
        </InkSelect>
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
      </AdminSection>

      <AdminSection title="发送操作">
        <InkNotice tone="info">
          可选模板 + 人群筛选。当前为同步执行，建议先 dry run 预估人数。
        </InkNotice>
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
            {loading ? '执行中...' : '确认同步群发邮件'}
          </AdminButton>
        </div>
      </AdminSection>

      {result && (
        <AdminSection title={result.dryRun ? '预览结果' : '发送结果'}>
          <div className="admin-field-group" role="status" aria-live="polite">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {result.totalRecipients !== undefined && (
                <p>
                  收件人数：<strong>{result.totalRecipients}</strong>
                </p>
              )}
              {result.sent !== undefined && (
                <p>
                  发送成功：<strong>{result.sent}</strong>
                </p>
              )}
              {result.failed !== undefined && (
                <p>
                  发送失败：<strong>{result.failed}</strong>
                </p>
              )}
            </div>
            {Boolean(result.failed) && (
              <InkNotice tone="warning">
                存在发送失败的邮件，请展开执行详情查看。
              </InkNotice>
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
