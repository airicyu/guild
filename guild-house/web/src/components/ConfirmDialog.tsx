import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="guild-glass w-full max-w-md rounded-lg p-5 shadow-xl">
        <h3 className="guild-display text-lg font-bold text-[var(--color-text)]">{title}</h3>
        <div className="mt-2 text-sm text-[var(--color-text-muted)]">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="guild-btn-primary rounded-lg px-3 py-1.5 text-sm"
          >
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
