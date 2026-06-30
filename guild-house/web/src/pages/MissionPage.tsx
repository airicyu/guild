import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MissionActions } from "../features/missions/MissionActions";
import { PhasePill, SessionDot } from "../components/PhasePill";
import { MissionBriefTab } from "../features/missions/MissionBriefTab";
import { MissionCheckpointTab } from "../features/missions/MissionCheckpointTab";
import { MissionEventsTab } from "../features/missions/MissionEventsTab";
import { MissionOutboxTab } from "../features/missions/MissionOutboxTab";
import { MissionTerminalTab } from "../features/missions/MissionTerminalTab";
import { isMissionPhase, MISSION_TABS, type MissionTabId } from "../features/missions/utils";
import {
  ApiError,
  fetchMissionBrief,
  fetchMissionEvents,
  fetchMissionOutbox,
  fetchMissionSession,
  fetchMissionSummary,
  markMissionOutboxRead,
  restoreMission,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

/**
 * Mission room — tab-lazy queries, session restore, terminal attach.
 * Locked semantics: specs/product.md (attach = live --bg PO; GET session never spawns).
 */
export function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<MissionTabId>("brief");
  const queryClient = useQueryClient();

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
    enabled: Boolean(id) && tab === "brief",
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.missionSummary(id!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.missionSession(id!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
    },
  });

  const summary = summaryQuery.data;
  const apiError =
    summaryQuery.error instanceof ApiError ? summaryQuery.error : null;

  const title = summary?.briefTitle ?? id;
  const phase = summary?.checkpoint?.phase;
  const showPhase = phase && isMissionPhase(phase);

  return (
    <div>
      <Link
        to="/hall"
        className="mb-4 flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
      >
        <ArrowLeft size={14} />
        Back to missions
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
              </div>
              <div className="flex flex-wrap items-center gap-3">
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

            <MissionActions
              missionId={summary.id}
              summary={summary}
              onOpenTerminal={() => setTab("terminal")}
            />
          </header>

          <nav className="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
            {MISSION_TABS.map(({ id: tabId, label }) => (
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

          {tab === "brief" && <MissionBriefTab briefQuery={briefQuery} />}
          {tab === "checkpoint" && (
            <MissionCheckpointTab summary={summary} sessionQuery={sessionQuery} />
          )}
          {tab === "events" && <MissionEventsTab eventsQuery={eventsQuery} />}
          {tab === "terminal" && (
            <MissionTerminalTab
              summary={summary}
              sessionQuery={sessionQuery}
              restoreMutation={restoreMutation}
            />
          )}
          {tab === "outbox" && (
            <MissionOutboxTab outboxQuery={outboxQuery} markOutboxMutation={markOutboxMutation} />
          )}
        </>
      )}
    </div>
  );
}
