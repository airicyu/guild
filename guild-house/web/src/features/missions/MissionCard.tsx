import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PhasePill, SessionDot } from "../../components/PhasePill";
import type { BoardStage, MissionCardData } from "../../types/mission";

interface MissionCardProps {
  mission: MissionCardData;
  compact?: boolean;
  onPromote?: (folder: string) => void;
  promotePending?: boolean;
}

export function MissionCard({ mission, compact, onPromote, promotePending }: MissionCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-[var(--color-text)]">{mission.id}</p>
          {!compact && mission.phase && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PhasePill phase={mission.phase} />
              {mission.awaitingGuildMaster && (
                <span className="text-[10px] uppercase tracking-wide text-[var(--phase-blocked)]">
                  Awaiting guild master
                </span>
              )}
            </div>
          )}
          {!compact && !mission.phase && mission.stage === "queued" && (
            <p className="mt-2 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              Awaiting bell
            </p>
          )}
        </div>
        {mission.stage === "working" && (
          <SessionDot live={mission.sessionLive} restoreRequired={mission.restoreRequired} />
        )}
      </div>
      {mission.stage === "parking" && onPromote && (
        <button
          type="button"
          disabled={promotePending}
          onClick={(e) => {
            e.stopPropagation();
            onPromote(mission.id);
          }}
          className="mt-2 w-full rounded-md border border-[var(--board-parking-accent)]/40 bg-white/80 px-2 py-1 text-xs font-medium text-[var(--board-parking-accent)] hover:bg-white disabled:opacity-50"
        >
          {promotePending ? "Promoting…" : "Promote → queued"}
        </button>
      )}
    </>
  );

  const isClickable = mission.stage === "working" || mission.stage === "done" || mission.stage === "archive";

  const className = [
    "block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-sm transition",
    "hover:border-[var(--color-border-strong)] hover:shadow",
    mission.awaitingGuildMaster ? "border-[var(--phase-blocked)]/40" : "",
    isClickable ? "cursor-pointer hover:bg-[var(--color-surface-hover)]" : "",
  ].join(" ");

  if (isClickable) {
    return (
      <Link to={`/missions/${encodeURIComponent(mission.id)}`} className={className}>
        {inner}
      </Link>
    );
  }

  return <article className={className}>{inner}</article>;
}

interface BoardColumnProps {
  title: string;
  count: number;
  stage: BoardStage;
  children: ReactNode;
}

export function BoardColumn({ title, count, stage, children }: BoardColumnProps) {
  return (
    <section
      className={`board-column board-column--${stage} flex min-w-[240px] max-w-[320px] flex-1 flex-col rounded-xl border-2 p-3`}
      style={{
        backgroundColor: "var(--board-bg)",
        borderColor: "var(--board-border)",
      }}
    >
      <header
        className="mb-3 flex items-center gap-2 border-b pb-3"
        style={{ borderColor: "var(--board-border)" }}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--board-accent)" }}
          aria-hidden
        />
        <h3
          className="flex-1 text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--board-accent)" }}
        >
          {title}
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{
            backgroundColor: "var(--color-bg-elevated)",
            color: "var(--board-accent)",
            border: "1px solid var(--board-border)",
          }}
        >
          {count}
        </span>
      </header>
      <div
        className="flex min-h-[10rem] flex-col gap-2 rounded-lg border p-2"
        style={{
          borderColor: "var(--board-border)",
          backgroundColor: "rgba(255, 255, 255, 0.55)",
        }}
      >
        {children}
      </div>
    </section>
  );
}
