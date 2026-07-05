import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Pause, Play, RotateCcw, Terminal, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { nextToastId, ToastStack, type ToastMessage } from "../../components/Toast";
import { invalidateMissionCloseoutQueries } from "./invalidateMissionQueries";
import {
  ApiError,
  abortMission,
  archiveMission,
  pauseMission,
  rejectArtifacts,
  restoreMission,
  resumeMission,
} from "../../lib/api";
import { formatGuildMasterNotifyDetail, guildMasterWakeEnabled } from "../../lib/guildMasterNotify";
import { useHealth } from "../../providers/AppProviders";
import type { MissionSummaryResponse } from "../../types/mission";

interface MissionActionsProps {
  missionId: string;
  summary: MissionSummaryResponse;
  onOpenTerminal?: () => void;
}

export function MissionActions({ missionId, summary, onOpenTerminal }: MissionActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const health = useHealth().data;
  const channelPushEnabled = health?.channelPushEnabled === true;
  const wakeEnabled = guildMasterWakeEnabled({
    channelPushEnabled,
    sessionPokeEnabled: health?.sessionPokeEnabled,
  });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [abortOpen, setAbortOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [abortReason, setAbortReason] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: nextToastId() }]);
  }, []);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const invalidate = useCallback(() => {
    invalidateMissionCloseoutQueries(queryClient, missionId);
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

  const rejectMutation = useMutation({
    mutationFn: () => rejectArtifacts(missionId, rejectReason.trim() || undefined),
    onSuccess: (result) => {
      setRejectOpen(false);
      setRejectReason("");
      addToast({
        tone: "info",
        title: "Artifacts rejected",
        detail: formatGuildMasterNotifyDetail(result.notify) || "Mission blocked — PO awaits directive",
      });
      invalidate();
    },
    onError: (err) => onMutationError(err, "Reject"),
  });

  const abortMutation = useMutation({
    mutationFn: () => abortMission(missionId, abortReason.trim() || undefined),
    onSuccess: (result) => {
      setAbortOpen(false);
      setAbortReason("");
      addToast({
        tone: "info",
        title: "Mission aborted",
        detail: formatGuildMasterNotifyDetail(result.notify) || "Moved to aborted board",
      });
      invalidate();
      navigate("/hall");
    },
    onError: (err) => onMutationError(err, "Abort"),
  });

  if (summary.board !== "working" && summary.board !== "done" && summary.board !== "aborted") {
    return null;
  }

  const phase = summary.checkpoint?.phase;
  const isDone = phase === "done" || summary.board === "done";
  const isAborted = phase === "aborted" || summary.board === "aborted";
  const isPaused = phase === "paused";
  const canPause = summary.board === "working" && phase && !isDone && !isPaused && !isAborted;
  const canResume = summary.board === "working" && (isPaused || summary.restoreRequired);
  const canReject =
    wakeEnabled && summary.board === "working" && phase === "awaiting_artifact_review";
  const canAbort = summary.board === "working" && !isDone && !isAborted;
  // Archive from done or aborted board with archiveReady — POST /missions/:id/archive (specs/product.md).
  const showArchive = (summary.board === "done" || summary.board === "aborted") && summary.archiveReady;
  const pending =
    archiveMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    restoreMutation.isPending ||
    rejectMutation.isPending ||
    abortMutation.isPending;

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

        {canReject && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--phase-blocked)]/40 px-3 py-1.5 text-sm text-[var(--phase-blocked)] hover:bg-[var(--phase-blocked)]/10"
          >
            <XCircle size={16} />
            Reject artifacts
          </button>
        )}

        {canAbort && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setAbortOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--phase-aborted)]/50 px-3 py-1.5 text-sm text-[var(--phase-aborted)] hover:bg-[var(--color-surface-hover)]"
          >
            <XCircle size={16} />
            Abort mission
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
        message={`Move ${missionId} to the archive board. The mission room moves to mission-rooms/achive/.`}
        confirmLabel="Archive"
        pending={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setArchiveOpen(false)}
      />

      <ConfirmDialog
        open={rejectOpen}
        title="Reject artifacts?"
        message={
          <div className="space-y-3">
            <p>Mission stays on working with phase blocked. PO will await your remediation directive.</p>
            <label className="block text-sm">
              <span className="text-[var(--color-text-muted)]">Reason (optional)</span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="What needs to change before re-review?"
              />
            </label>
          </div>
        }
        confirmLabel="Reject artifacts"
        pending={rejectMutation.isPending}
        onConfirm={() => rejectMutation.mutate()}
        onCancel={() => {
          setRejectOpen(false);
          setRejectReason("");
        }}
      />

      <ConfirmDialog
        open={abortOpen}
        title="Abort mission?"
        message={
          <div className="space-y-3">
            <p>Stops the PO session and moves mission to aborted. Frees an execution slot immediately.</p>
            <label className="block text-sm">
              <span className="text-[var(--color-text-muted)]">Reason (optional)</span>
              <textarea
                value={abortReason}
                onChange={(e) => setAbortReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="Why is this mission being closed early?"
              />
            </label>
          </div>
        }
        confirmLabel="Abort mission"
        pending={abortMutation.isPending}
        onConfirm={() => abortMutation.mutate()}
        onCancel={() => {
          setAbortOpen(false);
          setAbortReason("");
        }}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
