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

export function fetchIdeas() {
  return apiFetch<IdeasResponse>("/ideas");
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
  return apiFetch<IdeaDetail>(`/ideas/${encodeURIComponent(id)}`);
}

export function fetchIdeaDrafts(id: string) {
  return apiFetch<IdeaDraftsResponse>(`/ideas/${encodeURIComponent(id)}/drafts`);
}

/** ?ensureLive=true restores intake --bg session before terminal attach. */
export function fetchDiscoverySession(id: string, options?: { ensureLive?: boolean }) {
  const qs = options?.ensureLive ? "?ensureLive=true" : "";
  return apiFetch<MissionSessionResponse>(`/discoveries/${encodeURIComponent(id)}/session${qs}`);
}

export function restoreDiscovery(id: string) {
  return apiFetch<{ ok: true; ideaId: string }>(
    `/discoveries/${encodeURIComponent(id)}/restore`,
    { method: "POST" },
  );
}

export function fetchDiscoveryOutbox(id: string) {
  return apiFetch<DiscoveryOutboxResponse>(`/discoveries/${encodeURIComponent(id)}/outbox`);
}

export function approveDiscovery(id: string) {
  return apiFetch<ApproveDiscoveryResponse>(`/discoveries/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });
}

export function markDiscoveryOutboxRead(id: string, ids?: string[]) {
  return apiFetch<{ ok: true; ideaId: string; marked: number }>(
    `/discoveries/${encodeURIComponent(id)}/outbox/read`,
    {
      method: "POST",
      body: ids && ids.length > 0 ? JSON.stringify({ ids }) : undefined,
    },
  );
}
