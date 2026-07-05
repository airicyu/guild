import type {
  ApproveDiscoveryResponse,
  CreateIdeaResponse,
  DiscoveryOutboxResponse,
  IdeaDetail,
  IdeaDraftsResponse,
  IdeasResponse,
} from "../../types/discovery";
import type { MissionSessionResponse } from "../../types/mission";
import { apiFetch } from "./client";

type BoardNoteApiItem = {
  id: string;
  stage: string;
  briefPreview: string;
  phase?: string;
  sessionLive?: boolean;
  brief?: string;
  checkpoint?: IdeaDetail["checkpoint"];
  roomPath?: string | null;
  jobState?: IdeaDetail["jobState"];
  restoreRequired?: boolean;
};

function mapEarlyNote(n: BoardNoteApiItem, board: "backlog" | "ideas" | "discovering") {
  return {
    id: n.id,
    board,
    scratchPreview: n.briefPreview,
    phase: n.phase as IdeasResponse["ideas"][0]["phase"],
    sessionLive: n.sessionLive,
  };
}

async function fetchStageNotes(stage: string) {
  return apiFetch<{ notes: BoardNoteApiItem[]; count: number }>(
    `/mission-board-notes?stage=${encodeURIComponent(stage)}`,
  );
}

export function fetchIdeas() {
  return Promise.all([
    fetchStageNotes("ideas-backlog"),
    fetchStageNotes("ideas"),
    fetchStageNotes("discovering"),
  ]).then(([backlog, ideas, discovering]) => {
    const merged = [
      ...backlog.notes.map((n) => mapEarlyNote(n, "backlog")),
      ...ideas.notes.map((n) => mapEarlyNote(n, "ideas")),
      ...discovering.notes.map((n) => mapEarlyNote(n, "discovering")),
    ];
    return { ideas: merged, count: merged.length } satisfies IdeasResponse;
  });
}

export function createIdea(text: string, options?: { slug?: string; board?: "backlog" | "ideas" }) {
  const body: { text: string; slug?: string; board?: "backlog" | "ideas" } = { text };
  if (options?.slug) body.slug = options.slug;
  if (options?.board) body.board = options.board;
  return apiFetch<CreateIdeaResponse>("/ideas", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchIdea(id: string) {
  return apiFetch<BoardNoteApiItem>(`/mission-board-notes/${encodeURIComponent(id)}`).then(
    (note) =>
      ({
        id: note.id,
        board:
          note.stage === "ideas-backlog"
            ? "backlog"
            : (note.stage as "ideas" | "discovering"),
        scratch: note.brief ?? "",
        scratchPreview: note.briefPreview,
        phase: note.phase as IdeaDetail["phase"],
        sessionLive: note.sessionLive,
        checkpoint: note.checkpoint,
        roomPath: note.roomPath,
        jobState: note.jobState,
        restoreRequired: note.restoreRequired,
      }) satisfies IdeaDetail,
  );
}

export function fetchIdeaDrafts(id: string) {
  return apiFetch<IdeaDraftsResponse>(`/missions/${encodeURIComponent(id)}/drafts`);
}

export function fetchDiscoverySession(id: string, options?: { ensureLive?: boolean }) {
  const qs = options?.ensureLive ? "?ensureLive=true" : "";
  return apiFetch<MissionSessionResponse>(`/missions/${encodeURIComponent(id)}/session${qs}`);
}

export function restoreDiscovery(id: string) {
  return apiFetch<{ ok: true; ideaId: string }>(`/missions/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}

export function fetchDiscoveryOutbox(id: string) {
  return apiFetch<DiscoveryOutboxResponse>(`/missions/${encodeURIComponent(id)}/outbox`);
}

export function approveDiscovery(id: string) {
  return apiFetch<ApproveDiscoveryResponse>(
    `/missions/${encodeURIComponent(id)}/approve-discovery`,
    { method: "POST" },
  );
}

export function markDiscoveryOutboxRead(id: string, ids?: string[]) {
  return apiFetch<{ ok: true; ideaId: string; marked: number }>(
    `/missions/${encodeURIComponent(id)}/outbox/read`,
    {
      method: "POST",
      body: ids && ids.length > 0 ? JSON.stringify({ ids }) : undefined,
    },
  );
}
