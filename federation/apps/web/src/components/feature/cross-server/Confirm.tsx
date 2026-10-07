import { InkButton } from '@app/components/ui/InkButton';
import { useEffect, useRef, type ReactNode } from 'react';

export function CrossServerConfirm({
  title,
  children,
  pending,
  onClose,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="cross-server-confirm-title"
      className="bg-paper text-ink border-ink/20 backdrop:bg-ink/40 m-auto w-[calc(100%_-_2rem)] max-w-md border p-6 shadow-xl"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <h2
        id="cross-server-confirm-title"
        className="mb-4 text-lg font-semibold"
      >
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-7">{children}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <InkButton disabled={pending} onClick={onClose} className="min-h-11">
          返回
        </InkButton>
        <InkButton
          pending={pending}
          variant="primary"
          onClick={onConfirm}
          className="min-h-11"
        >
          确认
        </InkButton>
      </div>
    </dialog>
  );
}
