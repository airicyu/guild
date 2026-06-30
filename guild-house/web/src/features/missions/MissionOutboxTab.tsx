import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type { MissionOutboxResponse } from "../../types/mission";
import { formatTs } from "./utils";

type MissionOutboxTabProps = {
  outboxQuery: UseQueryResult<MissionOutboxResponse, Error>;
  markOutboxMutation: UseMutationResult<
    { ok: true; missionId: string; marked: number },
    Error,
    string[] | undefined
  >;
};

export function MissionOutboxTab({ outboxQuery, markOutboxMutation }: MissionOutboxTabProps) {
  return (
    <section>
      {outboxQuery.data && outboxQuery.data.unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            disabled={markOutboxMutation.isPending}
            onClick={() => markOutboxMutation.mutate(undefined)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
          >
            Mark all read
          </button>
        </div>
      )}
      {outboxQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading outbox…</p>
      )}
      {outboxQuery.data?.entries.length === 0 && (
        <div className="guild-glass rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
          No outbox entries
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {outboxQuery.data?.entries.map((entry) => (
          <li
            key={entry.id}
            className={[
              "guild-glass rounded-lg p-4",
              !entry.read ? "border-[var(--phase-blocked)]/40" : "",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">{formatTs(entry.ts)}</span>
              <div className="flex items-center gap-2">
                {!entry.read && (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--phase-blocked)]">
                      Unread
                    </span>
                    <button
                      type="button"
                      disabled={markOutboxMutation.isPending}
                      onClick={() => markOutboxMutation.mutate([entry.id])}
                      className="text-[10px] uppercase tracking-wide text-[var(--color-accent)] hover:underline"
                    >
                      Mark read
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text)]">{entry.question}</p>
            {entry.context && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{entry.context}</p>
            )}
            <p className="mt-2 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              {entry.from} · {entry.urgency}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
