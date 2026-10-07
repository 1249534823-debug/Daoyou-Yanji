import { AdminSection } from '../_components/AdminSection';
import { FeedbackTable } from './_components/FeedbackTable';

export default function FeedbackPage() {
  return (
    <div className="admin-form-page">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">FEEDBACK</p>
        <h2 className="font-heading text-ink mt-2 text-4xl">用户反馈</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          查看和管理用户提交的 Bug 反馈和意见建议。
        </p>
      </header>

      <AdminSection title="反馈列表" icon="message">
        <FeedbackTable />
      </AdminSection>
    </div>
  );
}
