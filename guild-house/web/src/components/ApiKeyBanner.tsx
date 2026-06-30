import { KeyRound } from "lucide-react";

interface ApiKeyBannerProps {
  onOpenSettings: () => void;
}

export function ApiKeyBanner({ onOpenSettings }: ApiKeyBannerProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--phase-blocked)]/30 bg-[var(--phase-blocked)]/10 px-6 py-2.5"
      role="alert"
    >
      <p className="text-sm text-[var(--color-text)]">
        <span className="font-medium text-[var(--phase-blocked)]">Unauthorized</span>
        {" — "}
        API key does not match guild-house. Set the same value as{" "}
        <code className="text-xs">GUILD_API_KEY</code> in <code className="text-xs">guild-house/.env</code>
        , or add <code className="text-xs">VITE_GUILD_API_KEY</code> to <code className="text-xs">web/.env.local</code>.
      </p>
      <button
        type="button"
        onClick={onOpenSettings}
        className="guild-btn-primary flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
      >
        <KeyRound size={16} />
        Set API key
      </button>
    </div>
  );
}
