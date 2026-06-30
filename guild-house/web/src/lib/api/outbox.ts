import type { OutboxResponse } from "../../types/mission";
import { apiFetch } from "./client";
import { markMissionOutboxRead } from "./missions";

export function fetchOutbox() {
  return apiFetch<OutboxResponse>("/outbox");
}

export function markOutboxItemRead(missionId: string, entryId: string) {
  return markMissionOutboxRead(missionId, [entryId]);
}
