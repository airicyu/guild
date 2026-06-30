import type { UseQueryResult } from "@tanstack/react-query";
import { formatTs } from "../../lib/format";
import type { DiscoveryOutboxResponse } from "../../types/discovery";

type IdeaOutboxTabProps = {
  outboxQuery: UseQueryResult<DiscoveryOutboxResponse, Error>;
};

export function IdeaOutboxTab({ outboxQuery }: IdeaOutboxTabProps) {
  return (
    <div className="space-y-3">
      {outboxQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading outbox…</p>
      )}
      {outboxQuery.isError && (
        <p className="text-sm text-[var(--phase-blocked)]">{(outboxQuery.error as Error).message}</p>
      )}
      {outboxQuery.data?.entries.length === 0 && (
        <div className="guild-glass rounded-lg p-6 text-center text-sm text-[var(--color-text-muted)]">
          Outbox empty
        </div>
      )}
      {outboxQuery.data?.entries.map((entry) => (
        <article
          key={entry.id}
          className={[
            "guild-glass rounded-lg border p-4 text-sm",
            entry.read
              ? "border-[var(--color-border)] opacity-75"
              : "border-[var(--phase-blocked)]/30",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text)]">{entry.from}</span>
            <span>·</span>
            <span>{formatTs(entry.ts)}</span>
            <span
              className={[
                "rounded px-1.5 py-0.5 uppercase",
                entry.urgency === "high"
                  ? "bg-[var(--phase-blocked)]/10 text-[var(--phase-blocked)]"
                  : "bg-[var(--color-surface-muted)]",
              ].join(" ")}
            >
              {entry.urgency}
            </span>
            {!entry.read && <span className="text-[var(--phase-blocked)]">Unread</span>}
          </div>
          <p className="mt-2 text-[var(--color-text)]">{entry.question}</p>
          {entry.context && <p className="mt-2 text-[var(--color-text-muted)]">{entry.context}</p>}
        </article>
      ))}
    </div>
  );
}
