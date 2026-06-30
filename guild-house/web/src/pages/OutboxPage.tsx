import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError, fetchOutbox, markDiscoveryOutboxRead, markOutboxItemRead } from "../lib/api";
import { formatTs } from "../lib/format";
import { queryKeys } from "../lib/queryKeys";
import type { OutboxItem } from "../types/mission";

function outboxKey(item: OutboxItem) {
  return `${item.ideaId ?? item.missionId}-${item.id}`;
}

function outboxLink(item: OutboxItem) {
  if (item.ideaId) {
    return `/ideas/${encodeURIComponent(item.ideaId)}`;
  }
  return `/missions/${encodeURIComponent(item.missionId!)}`;
}

function outboxLabel(item: OutboxItem) {
  return item.ideaId ?? item.missionId ?? "unknown";
}

export function OutboxPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.outbox,
    queryFn: fetchOutbox,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: async (item: OutboxItem) => {
      // Global outbox aggregates discovery + mission escalations — route to the right API.
      if (item.ideaId) {
        await markDiscoveryOutboxRead(item.ideaId, [item.id]);
        return;
      }
      await markOutboxItemRead(item.missionId!, item.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outbox });
      // Per-idea outbox tabs use discoveryOutbox(id) — prefix invalidates all.
      void queryClient.invalidateQueries({ queryKey: ["discovery-outbox"] });
    },
  });

  const items = data?.items ?? [];
  const apiError = error instanceof ApiError ? error : null;

  return (
    <div>
      <h2 className="guild-display text-2xl font-bold text-[var(--color-text)]">Outbox</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Unread escalations across discovering ideas and working missions
      </p>

      {isLoading && (
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading outbox…</p>
      )}

      {isError && (
        <div className="guild-glass mt-6 rounded-lg border border-[var(--phase-blocked)]/30 p-4 text-sm text-[var(--phase-blocked)]">
          {apiError?.status === 401 ? "Unauthorized — check API key." : (error as Error).message}
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="guild-glass mt-6 rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
          No unread escalations
        </div>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {items.map((item) => (
          <li key={outboxKey(item)} className="guild-glass rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={outboxLink(item)}
                  className="font-mono text-sm text-[var(--color-accent)] hover:underline"
                >
                  {outboxLabel(item)}
                </Link>
                {item.ideaId && (
                  <span className="rounded bg-[var(--board-discovering-accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--board-discovering-accent)]">
                    Discovery
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">{formatTs(item.ts)}</span>
                <button
                  type="button"
                  disabled={markReadMutation.isPending}
                  onClick={() => markReadMutation.mutate(item)}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Mark read
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text)]">{item.question}</p>
            {item.context && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.context}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
              <span className="text-[var(--color-text-muted)]">from {item.from}</span>
              <span className="text-[var(--phase-blocked)]">{item.urgency}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
