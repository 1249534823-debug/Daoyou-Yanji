import { useId, type ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcon';

interface AdminSectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: AdminIconName;
  children: ReactNode;
  className?: string;
}

export function AdminSection({
  title,
  description,
  actions,
  icon,
  children,
  className = '',
}: AdminSectionProps) {
  const id = useId();
  return (
    <section className={`admin-feature-card ${className}`} aria-labelledby={id}>
      <header className="admin-feature-header">
        <div className="admin-feature-heading">
          {icon && (
            <span className="admin-feature-icon">
              <AdminIcon name={icon} />
            </span>
          )}
          <div>
            <h2 id={id}>{title}</h2>
            {description && (
              <div className="admin-feature-description">{description}</div>
            )}
          </div>
        </div>
        {actions && <div className="admin-feature-actions">{actions}</div>}
      </header>
      <div className="admin-feature-body admin-form-surface">{children}</div>
    </section>
  );
}

export function AdminDisclosure({
  title,
  description,
  actions,
  icon,
  children,
  className = '',
  defaultOpen = false,
}: AdminSectionProps & { defaultOpen?: boolean }) {
  return (
    <details
      className={`admin-feature-card admin-disclosure ${className}`}
      open={defaultOpen || undefined}
    >
      <summary className="admin-feature-header">
        <span className="admin-feature-heading">
          {icon && (
            <span className="admin-feature-icon">
              <AdminIcon name={icon} />
            </span>
          )}
          <span>
            <span className="admin-disclosure-title">{title}</span>
            {description && (
              <span className="admin-feature-description">{description}</span>
            )}
          </span>
        </span>
        <span className="admin-disclosure-indicator">
          <span className="admin-disclosure-expand">展开</span>
          <span className="admin-disclosure-collapse">收起</span>
          <AdminIcon name="chevron" />
        </span>
      </summary>
      <div className="admin-feature-body admin-form-surface">
        {actions && <div className="admin-form-actions">{actions}</div>}
        {children}
      </div>
    </details>
  );
}
