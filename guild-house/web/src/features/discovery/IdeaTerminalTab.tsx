import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { DiscoveryTerminal } from "../terminal/DiscoveryTerminal";
import type { IdeaDetail } from "../../types/discovery";
import type { MissionSessionResponse } from "../../types/mission";

type IdeaTerminalTabProps = {
  idea: IdeaDetail;
  sessionQuery: UseQueryResult<MissionSessionResponse, Error>;
  restoreMutation: UseMutationResult<{ ok: true; ideaId: string }, Error, void>;
};

export function IdeaTerminalTab({ idea, sessionQuery, restoreMutation }: IdeaTerminalTabProps) {
  if (idea.board !== "discovering") {
    return (
      <div className="guild-glass rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
        Terminal is available once the idea is on the discovering board.
      </div>
    );
  }

  return (
    <DiscoveryTerminal
      ideaId={idea.id}
      restoreRequired={idea.restoreRequired ?? sessionQuery.data?.restoreRequired ?? false}
      sessionLive={sessionQuery.data?.live ?? idea.sessionLive ?? false}
      sessionLoading={sessionQuery.isLoading}
      onRestore={() => restoreMutation.mutate()}
      restorePending={restoreMutation.isPending}
    />
  );
}
