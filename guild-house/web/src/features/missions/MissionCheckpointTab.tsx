import type { UseQueryResult } from "@tanstack/react-query";
import { CopyButton } from "../../components/CopyButton";
import type { MissionSessionResponse, MissionSummaryResponse } from "../../types/mission";
import { formatTs } from "./utils";

type MissionCheckpointTabProps = {
  summary: MissionSummaryResponse;
  sessionQuery: UseQueryResult<MissionSessionResponse, Error>;
};

export function MissionCheckpointTab({ summary, sessionQuery }: MissionCheckpointTabProps) {
  return (
    <section className="space-y-4">
      {summary.checkpoint ? (
        <div className="guild-glass rounded-lg p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Phase</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{summary.checkpoint.phase}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Round</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">{summary.checkpoint.round}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Picked up</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">
                {formatTs(summary.checkpoint.picked_up_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Job state</dt>
              <dd className="mt-0.5 text-[var(--color-text)]">
                {summary.checkpoint.claude_session?.job_state ?? summary.jobState ?? "—"}
              </dd>
            </div>
          </dl>

          {summary.checkpoint.last_signal && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Last signal
              </h3>
              <p className="mt-2 text-sm text-[var(--color-text)]">
                <span className="font-mono text-[var(--color-accent)]">
                  {summary.checkpoint.last_signal.type}
                </span>
                {summary.checkpoint.last_signal.summary && (
                  <span className="text-[var(--color-text-muted)]">
                    {" "}
                    — {summary.checkpoint.last_signal.summary}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {summary.checkpoint.last_signal.by} · {formatTs(summary.checkpoint.last_signal.at)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">No checkpoint on disk</p>
      )}

      {summary.board === "working" && (
        <div className="guild-glass rounded-lg p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Session commands
          </h3>
          {sessionQuery.isLoading && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Loading session…</p>
          )}
          {sessionQuery.data && (
            <ul className="mt-3 space-y-2">
              {sessionQuery.data.attachCmd && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <code className="text-xs text-[var(--color-text-muted)]">{sessionQuery.data.attachCmd}</code>
                  <CopyButton text={sessionQuery.data.attachCmd} label="Attach" />
                </li>
              )}
              <li className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-[var(--color-text-muted)]">{sessionQuery.data.resumeCmd}</code>
                <CopyButton text={sessionQuery.data.resumeCmd} label="Resume" />
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-[var(--color-text-muted)]">{sessionQuery.data.logsCmd}</code>
                <CopyButton text={sessionQuery.data.logsCmd} label="Logs" />
              </li>
            </ul>
          )}
          {sessionQuery.isError && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Session info unavailable</p>
          )}
        </div>
      )}
    </section>
  );
}
