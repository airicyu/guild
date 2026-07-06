import { useQuery } from "@tanstack/react-query";
import { MissionCard } from "../features/missions/MissionCard";
import { ApiError, fetchMissions } from "../lib/api";
import { missionToCardData } from "../lib/board";
import { queryKeys } from "../lib/queryKeys";

export function HallPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.missions,
    queryFn: fetchMissions,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });

  const missions = (data?.missions ?? []).filter((m) => m.board === "working");
  const apiError = error instanceof ApiError ? error : null;

  return (
    <div>
      <h2 className="guild-display text-2xl font-bold text-[var(--color-text)]">Working missions</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Missions in active execution
      </p>

      {isLoading && (
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading missions…</p>
      )}

      {isError && (
        <div className="guild-glass mt-6 rounded-lg border border-[var(--phase-blocked)]/30 p-4 text-sm text-[var(--phase-blocked)]">
          {apiError?.status === 401 ? "Unauthorized — check API key." : (error as Error).message}
        </div>
      )}

      {!isLoading && !isError && missions.length === 0 && (
        <div className="guild-glass mt-6 rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
          No working missions
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {missions.map((m) => (
          <MissionCard key={m.id} mission={missionToCardData(m)} />
        ))}
      </div>
    </div>
  );
}
