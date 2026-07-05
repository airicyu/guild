import { useQuery } from "@tanstack/react-query";
import { DiscoveringCard } from "../features/discovery/IdeaCard";
import { ApiError, fetchIdeas } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

export function DiscoveringHallPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.ideas,
    queryFn: fetchIdeas,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });

  const discovering = (data?.ideas ?? []).filter((i) => i.board === "discovering");
  const apiError = error instanceof ApiError ? error : null;

  return (
    <div>
      <h2 className="guild-display text-2xl font-bold text-[var(--color-text)]">Discovering</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Active intake rooms · <code className="text-xs">GET /mission-board-notes?stage=discovering</code>
      </p>

      {isLoading && (
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading discovery rooms…</p>
      )}

      {isError && (
        <div className="guild-glass mt-6 rounded-lg border border-[var(--phase-blocked)]/30 p-4 text-sm text-[var(--phase-blocked)]">
          {apiError?.status === 401 ? "Unauthorized — check API key." : (error as Error).message}
        </div>
      )}

      {!isLoading && !isError && discovering.length === 0 && (
        <div className="guild-glass mt-6 rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
          No ideas in discovery — submit an idea on the board and ring the bell
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {discovering.map((idea) => (
          <DiscoveringCard key={idea.id} idea={idea} />
        ))}
      </div>
    </div>
  );
}
