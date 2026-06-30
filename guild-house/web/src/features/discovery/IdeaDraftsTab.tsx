import type { UseQueryResult } from "@tanstack/react-query";
import type { IdeaDraftsResponse } from "../../types/discovery";

type IdeaDraftsTabProps = {
  draftsQuery: UseQueryResult<IdeaDraftsResponse, Error>;
};

export function IdeaDraftsTab({ draftsQuery }: IdeaDraftsTabProps) {
  return (
    <div className="space-y-3">
      {draftsQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading drafts…</p>
      )}
      {draftsQuery.isError && (
        <p className="text-sm text-[var(--phase-blocked)]">{(draftsQuery.error as Error).message}</p>
      )}
      {draftsQuery.data?.count === 0 && (
        <div className="guild-glass rounded-lg p-6 text-center text-sm text-[var(--color-text-muted)]">
          No draft missions yet under <code>artifacts/missions/</code>
        </div>
      )}
      {draftsQuery.data?.drafts.map((draft) => (
        <article
          key={draft.folder}
          className="guild-glass rounded-lg border border-[var(--color-border)] p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-[var(--color-text)]">{draft.title ?? draft.folder}</h3>
              <p className="mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">{draft.folder}</p>
            </div>
            {!draft.hasMissionMd && (
              <span className="text-[10px] uppercase text-[var(--phase-blocked)]">Missing mission.md</span>
            )}
          </div>
          {draft.preview && (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {draft.preview}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
