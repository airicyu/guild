import { Link } from "react-router-dom";
import { DiscoveryPhasePill, SessionDot } from "../../components/PhasePill";
import type { IdeaListItem } from "../../types/discovery";

interface IdeaCardProps {
  idea: IdeaListItem;
}

export function IdeaCard({ idea }: IdeaCardProps) {
  const className = [
    "block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-sm transition",
    "cursor-pointer hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] hover:shadow",
  ].join(" ");

  return (
    <Link to={`/ideas/${encodeURIComponent(idea.id)}`} className={className}>
      <p className="truncate font-mono text-xs text-[var(--color-text)]">{idea.id}</p>
      {idea.scratchPreview && (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {idea.scratchPreview}
        </p>
      )}
    </Link>
  );
}

export function DiscoveringCard({ idea }: IdeaCardProps) {
  const needsAttention =
    idea.phase === "presenting" || idea.phase === "awaiting_approval";

  const className = [
    "block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-sm transition",
    "cursor-pointer hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] hover:shadow",
    needsAttention ? "border-[var(--phase-blocked)]/40" : "",
  ].join(" ");

  return (
    <Link to={`/ideas/${encodeURIComponent(idea.id)}`} className={className}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-[var(--color-text)]">{idea.id}</p>
          {idea.phase && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DiscoveryPhasePill phase={idea.phase} />
              {needsAttention && (
                <span className="text-[10px] uppercase tracking-wide text-[var(--phase-blocked)]">
                  Awaiting guild master
                </span>
              )}
            </div>
          )}
          {idea.scratchPreview && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
              {idea.scratchPreview}
            </p>
          )}
        </div>
        <SessionDot live={idea.sessionLive} />
      </div>
    </Link>
  );
}
