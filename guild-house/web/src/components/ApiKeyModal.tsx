import { useEffect, useState } from "react";
import {
  hasConfiguredApiKey,
  hasEnvApiKey,
  hasStoredApiKey,
  setApiKey,
} from "../lib/auth";

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ open, onClose }: ApiKeyModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const configured = hasConfiguredApiKey();

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      if (configured) {
        onClose();
        return;
      }
      setError("Enter an API key.");
      return;
    }

    setApiKey(trimmed);
    onClose();
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="guild-glass w-full max-w-md rounded-xl p-6 shadow-xl">
        <h2 className="guild-display text-lg font-semibold text-[var(--color-accent)]">API key</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Must match <code className="text-[var(--color-text)]">GUILD_API_KEY</code> in{" "}
          <code className="text-[var(--color-text)]">guild-house/.env</code>. Saved in{" "}
          <code className="text-[var(--color-text)]">localStorage</code> (overrides{" "}
          <code className="text-[var(--color-text)]">web/.env.local</code>).
        </p>
        {configured && (
          <p className="mt-2 text-xs text-[var(--phase-running)]">
            {hasStoredApiKey()
              ? "Key saved in this browser."
              : hasEnvApiKey()
                ? "Using key from VITE_GUILD_API_KEY."
                : "Key configured."}{" "}
            Leave blank and save to keep the current key; type a new value to replace it.
          </p>
        )}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={configured ? "••••••••••••••••" : "Paste GUILD_API_KEY"}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            autoFocus
          />
          {error && <p className="text-xs text-[var(--phase-blocked)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Cancel
            </button>
            <button type="submit" className="guild-btn-primary rounded-lg px-4 py-2 text-sm">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
