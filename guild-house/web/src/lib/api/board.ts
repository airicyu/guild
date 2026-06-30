import type { BoardResponse, MissionsResponse, QueueResponse, TickResult } from "../../types/mission";
import { apiFetch } from "./client";

export function fetchBoard() {
  return apiFetch<BoardResponse>("/board");
}

export function fetchMissions() {
  return apiFetch<MissionsResponse>("/missions");
}

export function fetchQueue() {
  return apiFetch<QueueResponse>("/queue");
}

export function ringBell() {
  return apiFetch<TickResult>("/bell", { method: "POST" });
}

export function promoteParking(folder: string) {
  return apiFetch<{ ok: true; folder: string; stage: "queued" }>(
    `/board/parking/${encodeURIComponent(folder)}/promote`,
    { method: "POST" },
  );
}
