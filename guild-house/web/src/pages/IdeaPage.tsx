import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DiscoveryPhasePill, SessionDot } from "../components/PhasePill";
import { nextToastId, ToastStack, type ToastMessage } from "../components/Toast";
import { IdeaDraftsTab } from "../features/discovery/IdeaDraftsTab";
import { IdeaOutboxTab } from "../features/discovery/IdeaOutboxTab";
import { IdeaScratchTab } from "../features/discovery/IdeaScratchTab";
import { IdeaTerminalTab } from "../features/discovery/IdeaTerminalTab";
import { IDEA_TABS, type IdeaTabId } from "../features/discovery/utils";
import {
  ApiError,
  approveDiscovery,
  fetchDiscoveryOutbox,
  fetchDiscoverySession,
  fetchIdea,
  fetchIdeaDrafts,
  restoreDiscovery,
} from "../lib/api";
import { canApproveDiscovery } from "../lib/board";
import { queryKeys } from "../lib/queryKeys";

/**
 * Discovery idea room — approve moves drafts to parking; terminal mirrors mission attach rules.
 */
export function IdeaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<IdeaTabId>("scratch");
  const [approveOpen, setApproveOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const ideaQuery = useQuery({
    queryKey: queryKeys.idea(id!),
    queryFn: () => fetchIdea(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const draftsQuery = useQuery({
    queryKey: queryKeys.ideaDrafts(id!),
    queryFn: () => fetchIdeaDrafts(id!),
    enabled: Boolean(id) && tab === "drafts",
    refetchInterval: 5_000,
  });

  const outboxQuery = useQuery({
    queryKey: queryKeys.discoveryOutbox(id!),
    queryFn: () => fetchDiscoveryOutbox(id!),
    enabled: Boolean(id) && tab === "outbox",
    refetchInterval: 5_000,
  });

  // Terminal tab only: discovering board + ensureLive restores intake lead session before WS attach.
  const sessionQuery = useQuery({
    queryKey: queryKeys.discoverySession(id!),
    queryFn: () => fetchDiscoverySession(id!, { ensureLive: tab === "terminal" }),
    enabled: Boolean(id) && ideaQuery.data?.board === "discovering" && tab === "terminal",
    refetchInterval: tab === "terminal" ? 5_000 : false,
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreDiscovery(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discoverySession(id!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.idea(id!) });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveDiscovery(id!),
    onSuccess: (result) => {
      setApproveOpen(false);
      setToasts((prev) => [
        ...prev,
        {
          id: nextToastId(),
          tone: "success",
          title: "Discovery approved",
          detail: `Moved to parking: ${result.parkingFolders.join(", ")}`,
        },
      ]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
      // Approved ideas leave discovering — return to board.
      navigate("/");
    },
    onError: (err) => {
      setToasts((prev) => [
        ...prev,
        {
          id: nextToastId(),
          tone: "error",
          title: "Approve failed",
          detail: err instanceof Error ? err.message : String(err),
        },
      ]);
    },
  });

  const idea = ideaQuery.data;
  const apiError = ideaQuery.error instanceof ApiError ? ideaQuery.error : null;
  const phase = idea?.checkpoint?.phase ?? idea?.phase;
  // Approve only when intake lead has presented packages (see lib/board.canApproveDiscovery).
  const showApprove = idea?.board === "discovering" && canApproveDiscovery(phase);

  return (
    <div>
      <Link
        to="/discovering"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={16} />
        Discovering
      </Link>

      {ideaQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading idea…</p>
      )}

      {ideaQuery.isError && (
        <div className="guild-glass rounded-lg border border-[var(--phase-blocked)]/30 p-4 text-sm text-[var(--phase-blocked)]">
          {apiError?.status === 404
            ? "Idea not found on board."
            : (ideaQuery.error as Error).message}
        </div>
      )}

      {idea && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="guild-display text-2xl font-bold text-[var(--color-text)]">{idea.id}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  {idea.board}
                </span>
                {phase && <DiscoveryPhasePill phase={phase} />}
                {idea.board === "discovering" && <SessionDot live={idea.sessionLive} />}
                {idea.checkpoint?.awaiting_guild_master && (
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--phase-blocked)]">
                    Awaiting guild master
                  </span>
                )}
              </div>
            </div>
            {showApprove && (
              <button
                type="button"
                onClick={() => setApproveOpen(true)}
                disabled={approveMutation.isPending}
                className="guild-btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"
              >
                <CheckCircle size={18} />
                {approveMutation.isPending ? "Approving…" : "Approve"}
              </button>
            )}
          </div>

          <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
            {IDEA_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "px-4 py-2 text-sm font-medium transition",
                  tab === t.id
                    ? "border-b-2 border-[var(--color-accent)] text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                ].join(" ")}
              >
                {t.label}
                {t.id === "outbox" && outboxQuery.data && outboxQuery.data.unreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--phase-blocked)] px-1.5 py-0.5 text-[10px] text-white">
                    {outboxQuery.data.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "scratch" && <IdeaScratchTab idea={idea} />}
          {tab === "drafts" && <IdeaDraftsTab draftsQuery={draftsQuery} />}
          {tab === "outbox" && <IdeaOutboxTab outboxQuery={outboxQuery} />}
          {tab === "terminal" && (
            <IdeaTerminalTab
              idea={idea}
              sessionQuery={sessionQuery}
              restoreMutation={restoreMutation}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={approveOpen}
        title="Approve discovery"
        message={`Copy draft missions to Parking and close discovery for ${id}?`}
        confirmLabel="Approve"
        pending={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
        onCancel={() => setApproveOpen(false)}
      />

      <ToastStack
        toasts={toasts}
        onDismiss={(toastId) => setToasts((prev) => prev.filter((t) => t.id !== toastId))}
      />
    </div>
  );
}
