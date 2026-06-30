import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { MissionTerminal } from "../terminal/MissionTerminal";
import type { MissionSessionResponse, MissionSummaryResponse } from "../../types/mission";

type MissionTerminalTabProps = {
  summary: MissionSummaryResponse;
  sessionQuery: UseQueryResult<MissionSessionResponse, Error>;
  restoreMutation: UseMutationResult<{ ok: true; missionId: string }, Error, void>;
};

export function MissionTerminalTab({ summary, sessionQuery, restoreMutation }: MissionTerminalTabProps) {
  // Done/archive missions have no live PO — attach is working-board only.
  if (summary.board !== "working") {
    return (
      <section className="guild-glass rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
        Terminal attach is only available for working missions.
      </section>
    );
  }

  return (
    <section>
      <MissionTerminal
        missionId={summary.id}
        restoreRequired={summary.restoreRequired ?? sessionQuery.data?.restoreRequired ?? false}
        sessionLive={sessionQuery.data?.live ?? summary.sessionLive ?? false}
        sessionLoading={sessionQuery.isLoading}
        onRestore={() => restoreMutation.mutate()}
        restorePending={restoreMutation.isPending}
      />
    </section>
  );
}
