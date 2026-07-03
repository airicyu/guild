import { formatTs } from "../../lib/format";
import type { BoardStage, MissionPhase } from "../../types/mission";

export { formatTs };

export type MissionTabId = "brief" | "checkpoint" | "closeout" | "events" | "outbox" | "terminal";

export const MISSION_TABS: { id: MissionTabId; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "checkpoint", label: "Checkpoint" },
  { id: "closeout", label: "Close-out" },
  { id: "events", label: "Events" },
  { id: "outbox", label: "Outbox" },
  { id: "terminal", label: "Terminal" },
];

/** Parking / queued — brief only until bell scaffolds mission room (design §13.2). */
export function isIntakeBoard(board?: BoardStage): boolean {
  return board === "parking" || board === "queued";
}

export function missionTabsForBoard(board: BoardStage) {
  if (isIntakeBoard(board)) {
    return MISSION_TABS.filter((t) => t.id === "brief");
  }
  return MISSION_TABS;
}

export function isMissionPhase(p: string): p is MissionPhase {
  return [
    "evaluating",
    "running",
    "blocked",
    "paused",
    "awaiting_artifact_review",
    "artifacts_approved",
    "releasing",
    "retrospective",
    "done",
    "aborted",
  ].includes(p);
}

export function eventTypeClass(type: string) {
  switch (type) {
    case "milestone":
    case "directive":
    case "evaluator_done":
    case "round_note":
      return "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5";
    case "status":
    case "evidence":
      return "border-[var(--phase-running)]/30 bg-[var(--phase-running)]/5";
    case "qa_pass":
      return "border-[var(--phase-running)]/40 bg-[var(--phase-running)]/10";
    case "qa_fail":
      return "border-[var(--phase-blocked)]/30 bg-[var(--phase-blocked)]/5";
    default:
      return "border-[var(--color-border)]";
  }
}
