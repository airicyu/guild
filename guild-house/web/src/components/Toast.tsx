import { useEffect } from "react";
import { X } from "lucide-react";

export interface ToastMessage {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  detail?: string;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const toneBorder = {
  success: "border-[var(--phase-running)]/40",
  error: "border-[var(--phase-blocked)]/40",
  info: "border-[var(--color-accent)]/40",
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 8000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`guild-glass pointer-events-auto rounded-lg border p-4 shadow-lg ${toneBorder[toast.tone]}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{toast.title}</p>
          {toast.detail && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{toast.detail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

let toastId = 0;

export function nextToastId() {
  toastId += 1;
  return toastId;
}
