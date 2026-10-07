import { EmailBroadcastForm } from './EmailBroadcastForm';

export default function AdminEmailBroadcastPage() {
  return (
    <div className="admin-form-page">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">BROADCAST</p>
        <h2 className="font-heading text-ink mt-2 text-4xl">邮箱群发</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          面向已认证邮箱用户同步群发，支持模板、基础筛选与 dry run 预估。
        </p>
      </header>

      <div className="admin-form-host">
        <EmailBroadcastForm />
      </div>
    </div>
  );
}
