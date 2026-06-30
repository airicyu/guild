import type { BriefMetadata } from "./normalizeBrief";
import { hasBriefMetadata } from "./normalizeBrief";

type MissionBriefMetadataProps = {
  metadata: BriefMetadata;
};

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs">
      <span className="font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[var(--color-text)]">{value}</span>
    </span>
  );
}

function formatExtraValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

export function MissionBriefMetadata({ metadata }: MissionBriefMetadataProps) {
  if (!hasBriefMetadata(metadata)) return null;

  const badges = [
    metadata.autonomy && { label: "Autonomy", value: metadata.autonomy },
    metadata.priority && { label: "Priority", value: metadata.priority },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <details className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        Mission metadata
      </summary>
      <div className="space-y-3 border-t border-[var(--color-border)] px-4 py-3">
        {metadata.intent && (
          <p className="text-sm leading-relaxed text-[var(--color-text)]">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Intent
            </span>
            {metadata.intent}
          </p>
        )}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <MetaBadge key={badge.label} label={badge.label} value={badge.value} />
            ))}
          </div>
        )}
        {metadata.constraints && metadata.constraints.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Constraints
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {metadata.constraints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {Object.entries(metadata.extra).map(([key, value]) => (
          <p key={key} className="text-sm text-[var(--color-text-muted)]">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide">{key}</span>
            {formatExtraValue(value)}
          </p>
        ))}
      </div>
    </details>
  );
}
