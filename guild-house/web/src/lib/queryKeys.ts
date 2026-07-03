/**
 * TanStack Query key factory — keep in sync with invalidation call sites.
 * Prefix keys (e.g. discovery-outbox) invalidate all ids when passed without the id segment.
 */
export const queryKeys = {
  board: ["board"] as const,
  missions: ["missions"] as const,
  ideas: ["ideas"] as const,
  queue: ["queue"] as const,
  outbox: ["outbox"] as const,
  health: ["health"] as const,
  missionSummary: (id: string) => ["mission-summary", id] as const,
  missionBrief: (id: string) => ["mission-brief", id] as const,
  missionSession: (id: string) => ["mission-session", id] as const,
  missionEvents: (id: string) => ["mission-events", id] as const,
  missionOutbox: (id: string) => ["mission-outbox", id] as const,
  missionRoomFile: (id: string, path: string) => ["mission-room-file", id, path] as const,
  idea: (id: string) => ["idea", id] as const,
  ideaDrafts: (id: string) => ["idea-drafts", id] as const,
  discoveryOutbox: (id: string) => ["discovery-outbox", id] as const,
  discoverySession: (id: string) => ["discovery-session", id] as const,
};
