import type {
  EventsResponse,
  MissionArtifactActionResponse,
  MissionBriefResponse,
  MissionOutboxResponse,
  MissionRoomFileResponse,
  MissionSessionResponse,
  MissionSummaryResponse,
} from "../../types/mission";
import { apiFetch } from "./client";

export function fetchMissionSummary(id: string) {
  return apiFetch<MissionSummaryResponse>(`/missions/${encodeURIComponent(id)}/summary`);
}

export function fetchMissionBrief(id: string) {
  return apiFetch<MissionBriefResponse>(`/missions/${encodeURIComponent(id)}/brief`);
}

/** ?ensureLive=true restores PO --bg job before attach; use only from terminal tab (specs/product.md). */
export function fetchMissionSession(id: string, options?: { ensureLive?: boolean }) {
  const qs = options?.ensureLive ? "?ensureLive=true" : "";
  return apiFetch<MissionSessionResponse>(`/missions/${encodeURIComponent(id)}/session${qs}`);
}

export function fetchMissionEvents(id: string) {
  return apiFetch<EventsResponse>(`/missions/${encodeURIComponent(id)}/events`);
}

export function fetchMissionOutbox(id: string) {
  return apiFetch<MissionOutboxResponse>(`/missions/${encodeURIComponent(id)}/outbox`);
}

export function archiveMission(id: string) {
  return apiFetch<{ ok: true; missionId: string }>(
    `/missions/${encodeURIComponent(id)}/archive`,
    { method: "POST" },
  );
}

export function pauseMission(id: string) {
  return apiFetch<{ ok: true; missionId: string }>(
    `/missions/${encodeURIComponent(id)}/pause`,
    { method: "POST" },
  );
}

export function resumeMission(id: string) {
  return apiFetch<{ ok: true; missionId: string }>(
    `/missions/${encodeURIComponent(id)}/resume`,
    { method: "POST" },
  );
}

export function restoreMission(id: string) {
  return apiFetch<{ ok: true; missionId: string }>(
    `/missions/${encodeURIComponent(id)}/restore`,
    { method: "POST" },
  );
}

export function markMissionOutboxRead(id: string, ids?: string[]) {
  return apiFetch<{ ok: true; missionId: string; marked: number }>(
    `/missions/${encodeURIComponent(id)}/outbox/read`,
    {
      method: "POST",
      body: ids && ids.length > 0 ? JSON.stringify({ ids }) : undefined,
    },
  );
}

/** Read-only mission room file (allowlisted paths — see docs/api.md). */
export function fetchMissionRoomFile(id: string, roomPath: string) {
  const segments = roomPath.split("/").map((s) => encodeURIComponent(s)).join("/");
  return apiFetch<MissionRoomFileResponse>(
    `/missions/${encodeURIComponent(id)}/room/${segments}`,
  );
}

/** Guild master approve deliverables — awaiting_artifact_review → releasing (specs/product.md). */
export function approveArtifacts(id: string) {
  return apiFetch<MissionArtifactActionResponse>(
    `/missions/${encodeURIComponent(id)}/approve-artifacts`,
    { method: "POST" },
  );
}

export function rejectArtifacts(id: string, reason?: string) {
  return apiFetch<MissionArtifactActionResponse>(
    `/missions/${encodeURIComponent(id)}/reject-artifacts`,
    {
      method: "POST",
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  );
}

export function abortMission(id: string, reason?: string) {
  return apiFetch<MissionArtifactActionResponse>(
    `/missions/${encodeURIComponent(id)}/abort`,
    {
      method: "POST",
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  );
}
