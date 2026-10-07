import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminIcon';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  side?: 'left' | 'right';
  className?: string;
}

export function AdminDrawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  busy = false,
  side = 'right',
  className = '',
}: AdminDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`admin-ui admin-drawer admin-drawer--${side} ${className}`}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      {isOpen && (
        <>
          <header className="admin-drawer-header">
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label="关闭面板"
              onClick={onClose}
              disabled={busy}
            >
              <AdminIcon name="close" />
            </button>
          </header>
          <div className="admin-drawer-content">{children}</div>
          {footer && <footer className="admin-drawer-footer">{footer}</footer>}
        </>
      )}
    </dialog>,
    document.body,
  );
}
