import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpCircle, CheckCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MissionActions } from "../features/missions/MissionActions";
import { PhasePill, SessionDot } from "../components/PhasePill";
import { nextToastId, ToastStack, type ToastMessage } from "../components/Toast";
import { MissionBriefTab } from "../features/missions/MissionBriefTab";
import { MissionCheckpointTab } from "../features/missions/MissionCheckpointTab";
import { MissionCloseoutTab } from "../features/missions/MissionCloseoutTab";
import { MissionEventsTab } from "../features/missions/MissionEventsTab";
import { MissionOutboxTab } from "../features/missions/MissionOutboxTab";
import { MissionTerminalTab } from "../features/missions/MissionTerminalTab";
import { invalidateMissionCloseoutQueries } from "../features/missions/invalidateMissionQueries";
import {
  isIntakeBoard,
  isMissionPhase,
  missionTabsForBoard,
  type MissionTabId,
} from "../features/missions/utils";
import {
  ApiError,
  approveArtifacts,
  fetchMissionBrief,
  fetchMissionEvents,
  fetchMissionOutbox,
  fetchMissionSession,
  fetchMissionSummary,
  markMissionOutboxRead,
  promoteParking,
  restoreMission,
} from "../lib/api";
import { canApproveArtifacts } from "../lib/board";
import { formatGuildMasterNotifyDetail, guildMasterWakeEnabled } from "../lib/guildMasterNotify";
import { queryKeys } from "../lib/queryKeys";
import { useHealth } from "../providers/AppProviders";

/**
 * Mission room — tab-lazy queries, session restore, terminal attach.
 * Locked semantics: specs/product.md (attach = live --bg PO; GET session never spawns).
 */
export function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<MissionTabId>("brief");
  const [approveOpen, setApproveOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const queryClient = useQueryClient();
  const healthQuery = useHealth();
  const channelPushEnabled = healthQuery.data?.channelPushEnabled === true;
  const sessionPokeEnabled = healthQuery.data?.sessionPokeEnabled === true;
  const wakeEnabled = guildMasterWakeEnabled({
    channelPushEnabled,
    sessionPokeEnabled,
  });

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: nextToastId() }]);
  }, []);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const summaryQuery = useQuery({
    queryKey: queryKeys.missionSummary(id!),
    queryFn: () => fetchMissionSummary(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  // Tab-lazy: avoid fetching brief/events/outbox until the tab is opened.
  const briefQuery = useQuery({
    queryKey: queryKeys.missionBrief(id!),
    queryFn: () => fetchMissionBrief(id!),
    enabled:
      Boolean(id) &&
      (tab === "brief" ||
        summaryQuery.data?.board === "parking" ||
        summaryQuery.data?.board === "queued"),
  });

  // PO session exists only on working board. ensureLive on terminal tab restores PO before attach.
  const sessionQuery = useQuery({
    queryKey: queryKeys.missionSession(id!),
    queryFn: () => fetchMissionSession(id!, { ensureLive: tab === "terminal" }),
    enabled:
      Boolean(id) &&
      (tab === "checkpoint" || tab === "terminal") &&
      summaryQuery.data?.board === "working",
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.missionEvents(id!),
    queryFn: () => fetchMissionEvents(id!),
    enabled: Boolean(id) && tab === "events",
    refetchInterval: 3_000,
  });

  const outboxQuery = useQuery({
    queryKey: queryKeys.missionOutbox(id!),
    queryFn: () => fetchMissionOutbox(id!),
    enabled: Boolean(id) && tab === "outbox",
    refetchInterval: 5_000,
  });

  const markOutboxMutation = useMutation({
    mutationFn: (ids?: string[]) => markMissionOutboxRead(id!, ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.missionOutbox(id!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.missionSummary(id!) });
      // Global outbox badge in Layout nav.
      void queryClient.invalidateQueries({ queryKey: queryKeys.outbox });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreMission(id!),
    onSuccess: () => {
      invalidateMissionCloseoutQueries(queryClient, id!);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveArtifacts(id!),
    onSuccess: (result) => {
      setApproveOpen(false);
      addToast({
        tone: "success",
        title: "Artifacts approved",
        detail: formatGuildMasterNotifyDetail(result.notify),
      });
      invalidateMissionCloseoutQueries(queryClient, id!);
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : null;
      addToast({
        tone: "error",
        title: "Approve failed",
        detail: apiErr?.message ?? (err instanceof Error ? err.message : String(err)),
      });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: () => promoteParking(id!),
    onSuccess: () => {
      setPromoteOpen(false);
      addToast({
        tone: "success",
        title: "Promoted to queued",
        detail: "Ring the bell on the board when ready to start execution",
      });
      invalidateMissionCloseoutQueries(queryClient, id!);
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : null;
      addToast({
        tone: "error",
        title: "Promote failed",
        detail: apiErr?.message ?? (err instanceof Error ? err.message : String(err)),
      });
    },
  });

  const summary = summaryQuery.data;
  const apiError =
    summaryQuery.error instanceof ApiError ? summaryQuery.error : null;

  const title = summary?.briefTitle ?? id;
  const phase = summary?.checkpoint?.phase;
  const showPhase = phase && isMissionPhase(phase);
  const showApprove =
    summary?.board === "working" && canApproveArtifacts(phase) && wakeEnabled;
  const approveNeedsAttach =
    summary?.board === "working" && canApproveArtifacts(phase) && !wakeEnabled;
  const showPromote = summary?.board === "parking";
  const intake = isIntakeBoard(summary?.board);
  const visibleTabs = summary ? missionTabsForBoard(summary.board) : [];
  const backTo = intake ? "/" : "/hall";
  const backLabel = intake ? "Back to board" : "Back to missions";

  return (
    <div>
      <Link
        to={backTo}
        className="mb-4 flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
      >
        <ArrowLeft size={14} />
        {backLabel}
      </Link>

      {summaryQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading mission…</p>
      )}

      {summaryQuery.isError && (
        <div className="guild-glass rounded-lg border border-[var(--phase-blocked)]/30 p-4 text-sm text-[var(--phase-blocked)]">
          {apiError?.status === 401 ? "Unauthorized — check API key." : (summaryQuery.error as Error).message}
        </div>
      )}

      {summary && (
        <>
          <header className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="guild-display text-2xl font-bold text-[var(--color-text)]">{title}</h2>
                <p className="mt-1 font-mono text-sm text-[var(--color-text-muted)]">{summary.id}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {showPhase && <PhasePill phase={phase} />}
                  {summary.board === "working" && (
                    <SessionDot
                      live={summary.sessionLive ?? false}
                      restoreRequired={summary.restoreRequired ?? false}
                    />
                  )}
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    {summary.board}
                  </span>
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
                  {approveMutation.isPending ? "Approving…" : "Approve artifacts"}
                </button>
              )}
              {showPromote && (
                <button
                  type="button"
                  onClick={() => setPromoteOpen(true)}
                  disabled={promoteMutation.isPending}
                  className="guild-btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"
                >
                  <ArrowUpCircle size={18} />
                  {promoteMutation.isPending ? "Promoting…" : "Promote to queued"}
                </button>
              )}
            </div>

            {summary.board === "parking" && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Review the mission brief below. Promote when ready to queue for execution.
              </p>
            )}

            {summary.board === "queued" && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Awaiting an execution slot —{" "}
                <Link to="/" className="text-[var(--color-accent)] hover:underline">
                  ring the bell on the board
                </Link>{" "}
                to start this mission.
              </p>
            )}

            {approveNeedsAttach && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Artifact approve is disabled in the Web UI while session poke and channel push are
                off — use Guild Desk or terminal attach, then direct the PO via inbox.
              </p>
            )}

            {summary.squadMembers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.squadMembers.map((member) => (
                  <span
                    key={member}
                    className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                  >
                    {member}
                  </span>
                ))}
              </div>
            )}

            {summary.awaitingGuildMaster && (
              <p className="mt-3 text-sm text-[var(--phase-blocked)]">Awaiting guild master decision</p>
            )}

            {!intake && (
              <MissionActions
                missionId={summary.id}
                summary={summary}
                onOpenTerminal={() => setTab("terminal")}
              />
            )}
          </header>

          {visibleTabs.length > 1 && (
            <nav className="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
              {visibleTabs.map(({ id: tabId, label }) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setTab(tabId)}
                className={[
                  "px-4 py-2 text-sm font-medium transition-colors",
                  tab === tabId
                    ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                ].join(" ")}
              >
                {label}
                {tabId === "outbox" && summary.outboxUnreadCount > 0 && (
                  <span className="ml-1.5 text-[var(--phase-blocked)]">({summary.outboxUnreadCount})</span>
                )}
              </button>
            ))}
            </nav>
          )}

          {(intake || tab === "brief") && <MissionBriefTab briefQuery={briefQuery} />}
          {!intake && tab === "checkpoint" && (
            <MissionCheckpointTab summary={summary} sessionQuery={sessionQuery} />
          )}
          {!intake && tab === "closeout" && <MissionCloseoutTab missionId={summary.id} summary={summary} />}
          {!intake && tab === "events" && <MissionEventsTab eventsQuery={eventsQuery} />}
          {!intake && tab === "terminal" && (
            <MissionTerminalTab
              summary={summary}
              sessionQuery={sessionQuery}
              restoreMutation={restoreMutation}
            />
          )}
          {!intake && tab === "outbox" && (
            <MissionOutboxTab outboxQuery={outboxQuery} markOutboxMutation={markOutboxMutation} />
          )}
        </>
      )}

      <ConfirmDialog
        open={promoteOpen}
        title="Promote to queued?"
        message={`Move ${id} from parking to the execution queue. Ring the bell on the board when you want the orchestrator to pick it up.`}
        confirmLabel="Promote to queued"
        pending={promoteMutation.isPending}
        onConfirm={() => promoteMutation.mutate()}
        onCancel={() => setPromoteOpen(false)}
      />

      <ConfirmDialog
        open={approveOpen}
        title="Approve artifacts?"
        message={`Accept deliverables for ${id}? The PO will proceed with artifact release — mission stays on working until final dismiss.`}
        confirmLabel="Approve artifacts"
        pending={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
        onCancel={() => setApproveOpen(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
