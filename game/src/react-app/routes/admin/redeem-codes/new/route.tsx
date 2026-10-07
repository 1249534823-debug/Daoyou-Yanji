import { AdminPageHeader } from '../../_components/AdminPage';
import { RedeemCodeCreateForm } from '../_components/RedeemCodeCreateForm';
export default function NewRedeemCodePage() {
  return (
    <div className="admin-form-page admin-form-surface">
      <AdminPageHeader
        title="新建兑换码"
        description="配置奖励与领取条件，核对后创建。"
      />
      <RedeemCodeCreateForm />
    </div>
  );
}
