import type {
  EventsResponse,
  MissionBriefResponse,
  MissionOutboxResponse,
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
