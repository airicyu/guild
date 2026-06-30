import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { MarkdownView } from "../../components/MarkdownView";
import type { MissionBriefResponse } from "../../types/mission";
import { MissionBriefMetadata } from "./MissionBriefMetadata";
import { normalizeBriefContent } from "./normalizeBrief";

type MissionBriefTabProps = {
  briefQuery: UseQueryResult<MissionBriefResponse, Error>;
};

export function MissionBriefTab({ briefQuery }: MissionBriefTabProps) {
  const normalized = useMemo(
    () => (briefQuery.data ? normalizeBriefContent(briefQuery.data.content) : null),
    [briefQuery.data],
  );

  return (
    <section className="guild-glass rounded-lg p-5 md:p-6">
      {briefQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading brief…</p>
      )}
      {briefQuery.isError && (
        <p className="text-sm text-[var(--phase-blocked)]">{(briefQuery.error as Error).message}</p>
      )}
      {normalized && (
        <article className="mx-auto max-w-3xl">
          {normalized.displayTitle && (
            <h1 className="mb-5 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              {normalized.displayTitle}
            </h1>
          )}
          <MissionBriefMetadata metadata={normalized.metadata} />
          <MarkdownView content={normalized.body} />
        </article>
      )}
      {!briefQuery.isLoading && !briefQuery.data && !briefQuery.isError && (
        <p className="text-sm text-[var(--color-text-muted)]">No mission brief found</p>
      )}
    </section>
  );
}
