import { AdminButton as InkButton } from '../_components/AdminButton';
import { AdminPageHeader } from '../_components/AdminPage';
import { RedeemCodesTable } from './_components/RedeemCodesTable';
export default function RedeemCodesPage() {
  return (
    <div className="admin-form-page admin-form-surface">
      <AdminPageHeader
        title="兑换码"
        description="查看领取情况，管理奖励与有效期。"
        actions={
          <InkButton href="/admin/redeem-codes/new" variant="primary">
            新建兑换码
          </InkButton>
        }
      />
      <RedeemCodesTable />
    </div>
  );
}
