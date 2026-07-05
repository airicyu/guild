import type { IdeaListItem } from "../types/discovery";
import type {
  BoardResponse,
  BoardStage,
  MissionCardData,
  MissionListItem,
  MissionPhase,
} from "../types/mission";

/** Board column order matches Plan 3 lifecycle (ideas → … → done). See specs/product.md. */
function isMissionPhase(p: string): p is MissionPhase {
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

export function buildMissionMap(missions: MissionListItem[]): Map<string, MissionListItem> {
  return new Map(missions.map((m) => [m.id, m]));
}

export function buildIdeaMap(ideas: IdeaListItem[]): Map<string, IdeaListItem> {
  return new Map(ideas.map((i) => [i.id, i]));
}

export function missionToCardData(m: MissionListItem): MissionCardData {
  return {
    id: m.id,
    stage: m.board,
    phase: isMissionPhase(m.phase) ? m.phase : undefined,
    sessionLive: m.sessionLive,
    restoreRequired: m.restoreRequired,
    awaitingGuildMaster: m.awaitingGuildMaster,
    archiveReady: m.archiveReady,
  };
}

export function toCardData(
  id: string,
  stage: BoardStage,
  missionMap: Map<string, MissionListItem>,
): MissionCardData {
  if (stage !== "working" && stage !== "done" && stage !== "aborted") {
    return { id, stage };
  }

  // Board list may lag missions poll — sensible defaults so working cards still render.
  const live = missionMap.get(id);
  if (!live) {
    const defaultPhase =
      stage === "working" ? "running" : stage === "aborted" ? "aborted" : "done";
    return { id, stage, phase: defaultPhase, sessionLive: false };
  }

  return {
    id,
    stage,
    phase: isMissionPhase(live.phase) ? live.phase : undefined,
    sessionLive: live.sessionLive,
    restoreRequired: live.restoreRequired,
    awaitingGuildMaster: live.awaitingGuildMaster,
    archiveReady: live.archiveReady,
  };
}

export type BoardColumnDef =
  | { title: string; stage: "ideas-backlog" | "ideas" | "discovering"; ids: string[]; kind: "idea" }
  | { title: string; stage: BoardStage; ids: string[]; kind: "mission" };

export function boardColumns(board: BoardResponse): BoardColumnDef[] {
  return [
    {
      title: "Backlog",
      stage: "ideas-backlog",
      ids: board["ideas-backlog"] ?? [],
      kind: "idea",
    },
    { title: "Ideas", stage: "ideas", ids: board.ideas, kind: "idea" },
    { title: "Discovering", stage: "discovering", ids: board.discovering, kind: "idea" },
    { title: "Parking", stage: "parking", ids: board.parking, kind: "mission" },
    { title: "Queued", stage: "queued", ids: board.queued, kind: "mission" },
    { title: "Working", stage: "working", ids: board.working, kind: "mission" },
    { title: "Done", stage: "done", ids: board.done, kind: "mission" },
  ];
}

/** Guild master can approve only after intake lead presents draft missions. */
export function canApproveDiscovery(phase?: string): boolean {
  return (
    phase === "mission_plan_presenting" ||
    phase === "mission_plan_awaiting_approval" ||
    phase === "presenting" ||
    phase === "awaiting_approval"
  );
}

/** Guild master can approve mission deliverables after PO signals artifacts_ready_for_review. */
export function canApproveArtifacts(phase?: string): boolean {
  return phase === "awaiting_artifact_review";
}
