import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock, Lightbulb } from "lucide-react";
import { useCallback, useState } from "react";
import { DiscoveringCard, IdeaCard } from "../features/discovery/IdeaCard";
import { SubmitIdeaModal } from "../features/discovery/SubmitIdeaModal";
import { BoardColumn, MissionCard } from "../features/missions/MissionCard";
import { SlotMeter } from "../components/SlotMeter";
import { nextToastId, ToastStack, type ToastMessage } from "../components/Toast";
import {
  ApiError,
  createIdea,
  fetchBoard,
  fetchIdeas,
  fetchMissions,
  fetchQueue,
  promoteParking,
  ringBell,
} from "../lib/api";
import { boardColumns, buildIdeaMap, buildMissionMap, toCardData } from "../lib/board";
import { queryKeys } from "../lib/queryKeys";
import { useHealth } from "../providers/AppProviders";
import type { TickResult } from "../types/mission";

function bellToasts(result: TickResult): Omit<ToastMessage, "id">[] {
  const toasts: Omit<ToastMessage, "id">[] = [];

  if (result.discoveriesStarted.length > 0) {
    toasts.push({
      tone: "success",
      title: "Discovery started",
      detail: result.discoveriesStarted.join(", "),
    });
  }
  if (result.missionsStarted.length > 0) {
    toasts.push({
      tone: "success",
      title: "Missions started",
      detail: result.missionsStarted.join(", "),
    });
  }
  if (result.queuedDiscovery.length > 0) {
    toasts.push({
      tone: "info",
      title: "Discovery slots full",
      detail: `Queued: ${result.queuedDiscovery.join(", ")}`,
    });
  }
  if (result.queuedExecution.length > 0) {
    toasts.push({
      tone: "info",
      title: "Execution slots full",
      detail: `Queued: ${result.queuedExecution.join(", ")}`,
    });
  }
  if (result.errors.length > 0) {
    toasts.push({
      tone: "error",
      title: "Bell errors",
      detail: result.errors.map((e) => `${e.id}: ${e.error}`).join("; "),
    });
  }
  if (toasts.length === 0) {
    toasts.push({
      tone: "info",
      title: "Nothing to pick up",
      detail: "No ideas or queued missions waiting",
    });
  }

  return toasts;
}

export function BoardPage() {
  const queryClient = useQueryClient();
  const healthQuery = useHealth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: nextToastId() }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const invalidateBoard = useCallback(() => {
    // Bell/promote/submit shift board folders and slot meters — refresh the lot.
    void queryClient.invalidateQueries({ queryKey: queryKeys.board });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
    void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.queue });
    void queryClient.invalidateQueries({ queryKey: queryKeys.outbox });
  }, [queryClient]);

  const boardQuery = useQuery({
    queryKey: queryKeys.board,
    queryFn: fetchBoard,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const ideasQuery = useQuery({
    queryKey: queryKeys.ideas,
    queryFn: fetchIdeas,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions,
    queryFn: fetchMissions,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const queueQuery = useQuery({
    queryKey: queryKeys.queue,
    queryFn: fetchQueue,
    refetchInterval: 10_000,
  });

  const bellMutation = useMutation({
    mutationFn: ringBell,
    onSuccess: (result) => {
      invalidateBoard();
      for (const toast of bellToasts(result)) {
        addToast(toast);
      }
    },
    onError: (err) => {
      addToast({
        tone: "error",
        title: "Bell failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: promoteParking,
    onSuccess: (result) => {
      invalidateBoard();
      addToast({
        tone: "success",
        title: "Promoted to queued",
        detail: result.folder,
      });
    },
    onError: (err) => {
      addToast({
        tone: "error",
        title: "Promote failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({ text, slug }: { text: string; slug?: string }) => createIdea(text, slug),
    onSuccess: (result) => {
      setSubmitOpen(false);
      invalidateBoard();
      addToast({
        tone: "success",
        title: "Idea submitted",
        detail: result.ideaId,
      });
    },
    onError: (err) => {
      addToast({
        tone: "error",
        title: "Submit failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const { data: board, isLoading, isError, error } = boardQuery;
  const missionMap = buildMissionMap(missionsQuery.data?.missions ?? []);
  const ideaMap = buildIdeaMap(ideasQuery.data?.ideas ?? []);
  const columns = board ? boardColumns(board) : null;
  const discoverySlots = queueQuery.data?.discovery.slots;
  const executionSlots = queueQuery.data?.execution.slots;
  const tickMinutes = healthQuery.data?.tickIntervalMinutes ?? 0;

  const apiError = error instanceof ApiError ? error : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="guild-display text-2xl font-bold text-[var(--color-text)]">Mission board</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Ideas → discovery → parking → execution
            {tickMinutes > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--color-accent)]">
                <Clock size={12} aria-hidden />
                Auto-tick every {tickMinutes} min
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {discoverySlots && (
            <SlotMeter
              label="Discovery slots"
              used={discoverySlots.used}
              max={discoverySlots.max}
              available={discoverySlots.available}
            />
          )}
          {executionSlots && (
            <SlotMeter
              label="Execution slots"
              used={executionSlots.used}
              max={executionSlots.max}
              available={executionSlots.available}
              hint="Done missions on done board do not consume slots"
            />
          )}
          <button
            type="button"
            onClick={() => setSubmitOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)]"
          >
            <Lightbulb size={18} className="text-[var(--color-accent)]" />
            Submit idea
          </button>
          <button
            type="button"
            disabled={bellMutation.isPending}
            onClick={() => bellMutation.mutate()}
            className="guild-btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"
          >
            <Bell size={18} className={bellMutation.isPending ? "animate-pulse" : ""} />
            {bellMutation.isPending ? "Ringing…" : "Ring bell"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">Loading board…</p>}

      {isError && (
        <div className="guild-glass rounded-lg border border-[var(--phase-blocked)]/30 p-4 text-sm text-[var(--phase-blocked)]">
          {apiError?.status === 401 ? "Unauthorized — check API key in the header." : (error as Error).message}
          <p className="mt-2 text-[var(--color-text-muted)]">
            Ensure guild-house runs on port 3847 and the API key matches <code>.env</code>.
          </p>
        </div>
      )}

      {columns && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <BoardColumn key={col.title} title={col.title} count={col.ids.length} stage={col.stage}>
              {col.ids.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">Empty</p>
              ) : col.kind === "idea" ? (
                col.ids.map((id) => {
                  const idea = ideaMap.get(id) ?? {
                    id,
                    board: col.stage as "ideas" | "discovering",
                    scratchPreview: "",
                  };
                  return col.stage === "discovering" ? (
                    <DiscoveringCard key={id} idea={idea} />
                  ) : (
                    <IdeaCard key={id} idea={idea} />
                  );
                })
              ) : (
                col.ids.map((id) => (
                  <MissionCard
                    key={id}
                    mission={toCardData(id, col.stage, missionMap)}
                    onPromote={col.stage === "parking" ? (folder) => promoteMutation.mutate(folder) : undefined}
                    promotePending={col.stage === "parking" ? promoteMutation.isPending : undefined}
                  />
                ))
              )}
            </BoardColumn>
          ))}
        </div>
      )}

      <SubmitIdeaModal
        open={submitOpen}
        pending={submitMutation.isPending}
        onClose={() => setSubmitOpen(false)}
        onSubmit={(text, slug) => submitMutation.mutate({ text, slug })}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
