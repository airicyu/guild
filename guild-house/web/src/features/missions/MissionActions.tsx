import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Pause, Play, RotateCcw, Terminal } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { nextToastId, ToastStack, type ToastMessage } from "../../components/Toast";
import { ApiError, archiveMission, pauseMission, restoreMission, resumeMission } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import type { MissionSummaryResponse } from "../../types/mission";

interface MissionActionsProps {
  missionId: string;
  summary: MissionSummaryResponse;
  onOpenTerminal?: () => void;
}

export function MissionActions({ missionId, summary, onOpenTerminal }: MissionActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: nextToastId() }]);
  }, []);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.missionSummary(missionId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.missionSession(missionId) });
    // Board + hall badges reflect pause/archive/restore side effects.
    void queryClient.invalidateQueries({ queryKey: queryKeys.board });
    void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.queue });
    void queryClient.invalidateQueries({ queryKey: queryKeys.outbox });
  }, [queryClient, missionId]);

  const onMutationError = useCallback(
    (err: unknown, action: string) => {
      const apiErr = err instanceof ApiError ? err : null;
      addToast({
        tone: "error",
        title: `${action} failed`,
        detail: apiErr?.message ?? (err instanceof Error ? err.message : String(err)),
      });
    },
    [addToast],
  );

  const archiveMutation = useMutation({
    mutationFn: () => archiveMission(missionId),
    onSuccess: () => {
      setArchiveOpen(false);
      addToast({ tone: "success", title: "Mission archived", detail: missionId });
      invalidate();
      navigate("/hall");
    },
    onError: (err) => onMutationError(err, "Archive"),
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseMission(missionId),
    onSuccess: () => {
      addToast({ tone: "info", title: "Mission paused" });
      invalidate();
    },
    onError: (err) => onMutationError(err, "Pause"),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeMission(missionId),
    onSuccess: () => {
      addToast({ tone: "success", title: "Mission resumed" });
      invalidate();
    },
    onError: (err) => onMutationError(err, "Resume"),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreMission(missionId),
    onSuccess: () => {
      addToast({ tone: "success", title: "Session restored" });
      invalidate();
    },
    onError: (err) => onMutationError(err, "Restore"),
  });

  if (summary.board !== "working" && summary.board !== "done") return null;

  const phase = summary.checkpoint?.phase;
  const isDone = phase === "done" || summary.board === "done";
  const isPaused = phase === "paused";
  const canPause = summary.board === "working" && phase && !isDone && !isPaused;
  const canResume = summary.board === "working" && (isPaused || summary.restoreRequired);
  // Archive only from done board with archiveReady — POST /missions/:id/archive (specs/product.md).
  const showArchive = summary.board === "done" && summary.archiveReady;
  const pending =
    archiveMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    restoreMutation.isPending;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {showArchive && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setArchiveOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--phase-done)]/50 bg-[var(--phase-done)]/10 px-3 py-1.5 text-sm font-medium text-[var(--phase-done)] hover:bg-[var(--phase-done)]/20"
          >
            <Archive size={16} />
            Archive
          </button>
        )}

        {canPause && (
          <button
            type="button"
            disabled={pending}
            onClick={() => pauseMutation.mutate()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
          >
            <Pause size={16} />
            Pause
          </button>
        )}

        {canResume && (
          <button
            type="button"
            disabled={pending}
            onClick={() => resumeMutation.mutate()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
          >
            <Play size={16} />
            Resume
          </button>
        )}

        {summary.board === "working" && summary.restoreRequired && (
          <button
            type="button"
            disabled={pending}
            onClick={() => restoreMutation.mutate()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--phase-blocked)]/40 px-3 py-1.5 text-sm text-[var(--phase-blocked)] hover:bg-[var(--phase-blocked)]/10"
          >
            <RotateCcw size={16} />
            Restore session
          </button>
        )}

        {summary.board === "working" && (
          <button
            type="button"
            disabled={summary.restoreRequired && !summary.sessionLive}
            title={
              summary.restoreRequired
                ? "Restore session before opening terminal"
                : "Attach to PO session"
            }
            onClick={onOpenTerminal}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Terminal size={16} />
            Terminal
          </button>
        )}
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title="Archive mission?"
        message={`Move ${missionId} to the archive board. The mission room stays on disk.`}
        confirmLabel="Archive"
        pending={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setArchiveOpen(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
