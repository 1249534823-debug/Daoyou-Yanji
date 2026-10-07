import Link from '@app/components/router/AppLink';
import type { InkButtonProps } from '@app/components/ui/InkButton';

export function AdminButton({
  children,
  pending = false,
  pendingLabel = '处理中…',
  onClick,
  href,
  disabled = false,
  variant = 'default',
  className = '',
  type = 'button',
}: Omit<InkButtonProps, 'variant'> & {
  variant?: InkButtonProps['variant'] | 'danger';
}) {
  const unavailable = Boolean(disabled || pending);
  const content = pending ? pendingLabel : children;
  const classes = `admin-btn ${variant === 'primary' ? 'admin-btn-primary' : variant === 'danger' ? 'admin-btn-danger' : variant === 'ghost' ? 'admin-btn-quiet' : ''} ${className}`;
  return href && !unavailable ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <button
      type={type}
      className={classes}
      disabled={unavailable}
      aria-busy={pending || undefined}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
