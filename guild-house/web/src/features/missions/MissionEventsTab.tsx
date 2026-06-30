import type { UseQueryResult } from "@tanstack/react-query";
import type { EventsResponse } from "../../types/mission";
import { eventTypeClass, formatTs } from "./utils";

type MissionEventsTabProps = {
  eventsQuery: UseQueryResult<EventsResponse, Error>;
};

export function MissionEventsTab({ eventsQuery }: MissionEventsTabProps) {
  return (
    <section>
      {eventsQuery.isLoading && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading events…</p>
      )}
      {eventsQuery.data?.entries.length === 0 && (
        <div className="guild-glass rounded-lg p-8 text-center text-sm text-[var(--color-text-muted)]">
          No events logged
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {eventsQuery.data?.entries.map((entry, i) => (
          <li
            key={`${entry.ts}-${i}`}
            className={`guild-glass rounded-lg border p-3 ${eventTypeClass(entry.type)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[var(--color-text)]">{entry.from}</span>
              <span className="text-[var(--color-text-muted)]">
                {entry.type} · {formatTs(entry.ts)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{entry.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
