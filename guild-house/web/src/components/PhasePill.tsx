import type { DiscoveryPhase } from "../types/discovery";
import type { MissionPhase } from "../types/mission";

const discoveryLabels: Record<DiscoveryPhase, string> = {
  exploring: "Exploring",
  drafting: "Drafting",
  presenting: "Presenting",
  awaiting_approval: "Awaiting approval",
  closed: "Closed",
};

export function DiscoveryPhasePill({ phase }: { phase: DiscoveryPhase }) {
  return (
    <span className={`phase-pill phase-pill--discovery-${phase}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {discoveryLabels[phase]}
    </span>
  );
}

const labels: Record<MissionPhase, string> = {
  evaluating: "Evaluating",
  running: "Running",
  blocked: "Blocked",
  paused: "Paused",
  awaiting_artifact_review: "Awaiting review",
  artifacts_approved: "Approved",
  releasing: "Releasing",
  retrospective: "Retrospective",
  done: "Done",
  aborted: "Aborted",
};

export function PhasePill({ phase }: { phase: MissionPhase }) {
  return (
    <span className={`phase-pill phase-pill--${phase}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current`} />
      {labels[phase]}
    </span>
  );
}

export function SessionDot({
  live,
  restoreRequired,
}: {
  live?: boolean;
  restoreRequired?: boolean;
}) {
  if (restoreRequired) return <span className="session-restore" title="Restore required" />;
  if (live) return <span className="session-live" title="PO session live" />;
  return <span className="session-dead" title="PO not live" />;
}
