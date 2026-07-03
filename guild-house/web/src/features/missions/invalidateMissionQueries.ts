import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";

/** Invalidate board/hall/summary after guild-master close-out or lifecycle actions. */
export function invalidateMissionCloseoutQueries(queryClient: QueryClient, missionId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.missionSummary(missionId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.missionSession(missionId) });
  void queryClient.invalidateQueries({ queryKey: ["mission-room-file", missionId] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.board });
  void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
  void queryClient.invalidateQueries({ queryKey: queryKeys.queue });
  void queryClient.invalidateQueries({ queryKey: queryKeys.outbox });
}
