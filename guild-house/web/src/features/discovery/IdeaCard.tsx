import { ArrowUpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { DiscoveryPhasePill, SessionDot } from "../../components/PhasePill";
import type { IdeaListItem } from "../../types/discovery";

interface IdeaCardProps {
  idea: IdeaListItem;
}

interface BacklogIdeaCardProps extends IdeaCardProps {
  onPromote: (ideaId: string) => void;
  promoting?: boolean;
}

export function BacklogIdeaCard({ idea, onPromote, promoting }: BacklogIdeaCardProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-sm">
      <Link
        to={`/ideas/${encodeURIComponent(idea.id)}`}
        className="block transition hover:opacity-90"
      >
        <p className="truncate font-mono text-xs text-[var(--color-text)]">{idea.id}</p>
        {idea.scratchPreview && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {idea.scratchPreview}
          </p>
        )}
      </Link>
      <button
        type="button"
        disabled={promoting}
        onClick={() => onPromote(idea.id)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:opacity-50"
      >
        <ArrowUpCircle size={14} className="text-[var(--color-accent)]" />
        {promoting ? "Promoting…" : "Promote to Ideas"}
      </button>
    </div>
  );
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
