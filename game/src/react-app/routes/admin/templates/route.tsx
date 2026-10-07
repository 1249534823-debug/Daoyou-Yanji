import { AdminSection } from '../_components/AdminSection';
import { TemplatesTable } from './_components/TemplatesTable';

export default function TemplatesPage() {
  return (
    <div className="admin-form-page">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">TEMPLATES</p>
        <h2 className="font-heading text-ink mt-2 text-4xl">模板中心</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          管理 email / game_mail 模板，支持变量占位符 `{'{{varName}}'}`。
        </p>
      </header>

      <AdminSection title="模板列表" icon="message">
        <TemplatesTable />
      </AdminSection>
    </div>
  );
}
