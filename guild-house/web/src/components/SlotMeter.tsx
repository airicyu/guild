interface SlotMeterProps {
  label: string;
  used: number;
  max: number;
  available: number;
  hint?: string;
}

export function SlotMeter({ label, used, max, available, hint }: SlotMeterProps) {
  const pct = max > 0 ? Math.round((used / max) * 100) : 0;

  return (
    <div className="guild-glass w-72 shrink-0 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="shrink-0 text-[var(--color-text-muted)]">{label}</span>
        <span className="shrink-0 whitespace-nowrap font-mono text-[var(--color-text)]">
          {used}/{max}
          <span className="ml-1 text-[var(--color-text-muted)]">({available} free)</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && (
        <p className="mt-1.5 text-[10px] leading-snug text-[var(--color-text-muted)]">{hint}</p>
      )}
    </div>
  );
}
